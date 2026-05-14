import Anthropic from '@anthropic-ai/sdk';
import type { TradeType } from '@trades-saas/core-types';
import { aiCall } from './client';
import type { AiCallResult } from './client';

// =============================================================================
// AI ESTIMATE GENERATOR — OmniBid
// Architecture: Inngest Worker -> Claude Sonnet -> Supabase/PowerSync Sync
//
// KEY ARCHITECTURE DECISIONS:
//
// 1. NO AI TOTALS — Claude outputs unit_price_cents + quantity per line item only.
//    All sums are computed by the application layer with guaranteed-correct
//    integer math. The DB trigger on estimate_line_items enforces this.
//    Reason: LLMs reliably hallucinate arithmetic ($150 + $150 = $350).
//
// 2. THINKING TAG — Voice parser requires Claude to show its addition in a
//    <thinking> block before outputting JSON. This catches egregious errors
//    and the app layer always recomputes independently anyway.
//
// 3. SHARED TRADE KNOWLEDGE — One constant used by both system prompts.
//    Update TRADE_KNOWLEDGE_BLOCK once; both functions stay in sync.
//
// 4. REGIONAL CONTEXT — App layer injects cost-of-living coefficient and
//    market name. Claude's "fair pricing" logic adjusts accordingly.
// =============================================================================

// ─── Stripe tax category ──────────────────────────────────────────────────────
//
// App-layer mapping (verify with your Stripe tax settings):
//   service_labor      -> txcd_20030000  (installation, repair, maintenance)
//   tangible_property  -> txcd_99999999  (general tangible personal property)
//   equipment          -> txcd_37010001  (HVAC) / txcd_37020000 (electrical)
//   exempt             -> no tax code needed

export type TaxCategory =
  | 'service_labor'
  | 'tangible_property'
  | 'equipment'
  | 'exempt';

// ─── Regional context ─────────────────────────────────────────────────────────
//
// Injected by app layer. Org can override defaults in settings.
// Default for Lake Martin/Auburn area: index ~87 (below national avg).

export interface RegionalContext {
  market_name:          string;   // e.g. "Auburn/Lake Martin, AL"
  cost_of_living_index: number;   // 100 = national baseline
  labor_market_note?:   string;   // e.g. "Rural market, limited competition"
}

export const DEFAULT_REGIONAL_CONTEXT: RegionalContext = {
  market_name:          'Auburn/Lake Martin, AL',
  cost_of_living_index: 87,
  labor_market_note:    'Rural/small-city market. Price competitively but not at cost.',
};

// ─── Output interfaces ────────────────────────────────────────────────────────

export interface AiLineItemMetadata {
  is_taxable:   boolean;
  tax_category: TaxCategory;
}

export interface AiLineItem {
  description:        string;
  category:           'labor' | 'materials' | 'equipment' | 'other';
  tier:               'single' | 'good' | 'better' | 'best';
  quantity:           number;
  unit:               string;
  unit_price_cents:   number;       // integer cents — NO totals; app layer computes
  is_customer_facing: boolean;
  is_inferred:        boolean;
  needs_review:       boolean;
  metadata:           AiLineItemMetadata;
}

export interface AiEstimateSummaries {
  // NOTE: sms_short total is a placeholder — app layer substitutes computed total
  sms_short:          string;
  email_body_html:    string;
  internal_rationale: string;
}

export interface AiWorkflowTriggers {
  requires_follow_up: boolean;
  parts_to_order:     string[];
  urgency_score:      1 | 2 | 3 | 4 | 5;
}

export interface AiEstimateConfidence {
  score:  'high' | 'medium' | 'low';
  reason: string;
}

export interface AiEstimateResult {
  line_items:        AiLineItem[];
  summaries:         AiEstimateSummaries;
  workflow_triggers: AiWorkflowTriggers;
  confidence:        AiEstimateConfidence;
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface GenerateEstimateInput {
  job_title:        string;
  job_description:  string;
  trade_type:       TradeType;
  location:         string | null;
  regional_context: RegionalContext;    // always inject — use DEFAULT_REGIONAL_CONTEXT if unknown

  customer_name:    string;
  existing_assets:  Array<{
    name:         string;
    make:         string | null;
    model:        string | null;
    install_date: string | null;
    notes:        string | null;
  }>;

  labor_rate_per_hour: number;
  default_markup_pct:  number;
  tax_rate:            number;

  tier_mode:         'single' | 'good_better_best';
  special_notes?:    string;
  voice_transcript?: string;
}

// =============================================================================
// SHARED TRADE KNOWLEDGE BLOCK
//
// Single source of truth used by BOTH generateEstimate() and parseVoiceToLineItems().
// Update here once — both system prompts stay in sync automatically.
// =============================================================================

const TRADE_KNOWLEDGE_BLOCK = `TRADE KNOWLEDGE:

HVAC:
- Tune-up / maintenance: 1.5-2 hrs labor. Parts: filter $15-40, capacitor $30-80 if needed
- Refrigerant recharge: $150-300 depending on type (R-410A vs R-22) + 0.5 hr labor
- Full system replacement (standard split, 3-ton): 6-10 hrs labor, equipment $1,200-2,500
- Emergency service call: add $75-125 premium to base labor rate
- R-22 systems: flag as legacy, recommend upgrade, price refrigerant at $50-100/lb

PLUMBING:
- Faucet replacement (standard): 1-1.5 hrs, fixture $80-200
- Water heater (40 gal tank): 2-3 hrs, unit $450-800 + disposal $50
- Drain clearing (standard): 1-2 hrs + $30-60 equipment fee
- Toilet replacement: 1.5-2 hrs, fixture $200-500
- Emergency burst pipe: minimum 2 hrs + materials

ELECTRICAL:
- Panel upgrade (100A to 200A): 4-8 hrs + permit allowance $100-300
- Outlet/switch replacement: 0.5 hr each
- Ceiling fan installation (with box): 1.5-2 hrs
- GFCI installation: 0.5-1 hr each
- EV charger (Level 2, hardwired): 2-4 hrs + materials $200-400

ROOFING:
- Roof inspection: 0.5-1 hr
- Shingle repair (up to 10 sq ft): 1-2 hrs + materials
- Full reroof (1,500 sq ft): price per square ($350-600/square installed)
- Gutter cleaning: $1-2 per linear foot

GENERAL CONTRACTOR:
- Drywall repair (small, under 1 sq ft): 1-2 hrs
- Door installation (pre-hung): 2-3 hrs
- Painting (interior, per room): 4-8 hrs`;

// ─── System prompt [CACHED] ───────────────────────────────────────────────────

function buildEstimateSystemPrompt(): Anthropic.TextBlockParam[] {
  return [
    {
      type: 'text',
      text: `You are OmniBid, a specialized AI Estimator for skilled trades service calls.
Your goal is to transform job context and field transcripts into structured line items
optimized for a SQLite/PowerSync local-first database.

CORE PRINCIPLES:
- Price fairly for the contractor - not the lowest bid, the right bid
- Account for real-world labor time including setup, cleanup, and callbacks
- Use the regional cost-of-living index provided to calibrate pricing
- Flag uncertainty clearly rather than guessing silently

MATH RULE (critical):
You output ONLY unit_price_cents and quantity per line item.
You do NOT output any subtotals, totals, or sums — the application layer computes
all arithmetic with guaranteed-correct integer math. Do not attempt to sum line items.

DATA HIERARCHY - prioritize inputs in this order:
1. VOICE TRANSCRIPT (highest authority - the tech is standing next to the equipment)
2. FIELD NOTES (second authority)
3. JOB DESCRIPTION (baseline context only)

LOCAL-FIRST RESILIENCE:
If known equipment is listed but the voice transcript mentions different equipment,
trust the voice transcript. The asset list may be stale. Mark with needs_review: true.

ACTION-PART SPLIT (critical):
Every action verb (installed, replaced, ran, repaired, cleaned) must produce TWO line items:
- A "labor" line item for the time
- A "materials" or "equipment" line item for the part or material
Never combine labor and parts into a single line item.

LABOR HEURISTICS - use when duration is not stated:
- Minor task (outlet, filter, small repair): 60 minutes
- Moderate task (faucet, capacitor, tune-up): 120 minutes
- Major task (water heater, panel work, system replacement): 180+ minutes
Adjust upward for "difficult access," "tight space," or "old wiring" in field notes.

${TRADE_KNOWLEDGE_BLOCK}

GOOD/BETTER/BEST GUIDANCE:
- Good: standard materials, meets code, gets the job done
- Better: upgraded materials, includes warranty, often the right call
- Best: premium materials, longest warranty, includes preventive measures
Each tier must have meaningfully different value - not just a price bump.

TAX CATEGORY GUIDANCE:
- service_labor: any labor charge (often exempt from sales tax)
- tangible_property: parts and materials (usually taxable)
- equipment: major installed equipment (varies by state)
- exempt: warranties, permits, disposal fees

INTEGRATION SPECS:
- TELNYX sms_short: under 160 chars, GSM 7-bit only. Use "~$TOTAL" as placeholder where the app will substitute the computed total
- RESEND email_body_html: inline styles only, no CSS classes. Use #093b31 for headings and accents. Use "$[COMPUTED_TOTAL]" as placeholder for totals
- ALL PRICES: integer CENTS only per line item. No sums. No dollar signs in JSON numeric values.

URGENCY SCORING:
- 1: Routine maintenance, flexible scheduling
- 2: Should schedule within 2 weeks
- 3: Should schedule within 1 week
- 4: Urgent - 48-hour response
- 5: Emergency - same day

OUTPUT: Return ONLY a valid JSON object within <json> tags. No conversational filler.`,
      cache_control: { type: 'ephemeral' },
    } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
  ];
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateEstimate(
  input: GenerateEstimateInput
): Promise<AiCallResult<AiEstimateResult>> {

  const assetList = input.existing_assets.length > 0
    ? input.existing_assets.map(a =>
        `- ${a.name}` +
        (a.make ? ` (${a.make} ${a.model ?? ''})` : '') +
        (a.install_date ? `, installed ${a.install_date}` : '') +
        (a.notes ? ` - ${a.notes}` : '')
      ).join('\n')
    : 'None reported';

  const voiceSection = input.voice_transcript
    ? `### 2A. TECH VOICE TRANSCRIPT (highest priority)\n"${input.voice_transcript}"`
    : '### 2A. TECH VOICE TRANSCRIPT\nNone provided.';

  const notesSection = input.special_notes
    ? `### 2B. TECH FIELD NOTES\n${input.special_notes}`
    : '### 2B. TECH FIELD NOTES\nNone provided.';

  const estimateMode = input.tier_mode === 'good_better_best'
    ? 'Good / Better / Best (generate all three tiers)'
    : 'Single price';

  const laborRateCents = Math.round(input.labor_rate_per_hour * 100);
  const rc = input.regional_context;

  const userContent = `Generate an estimate for the following job.

### 1. ESTIMATE CONFIGURATION
- MODE: ${estimateMode}
- LABOR RATE: $${input.labor_rate_per_hour}/hr (${laborRateCents} cents/hr)
- MATERIAL MARKUP: ${input.default_markup_pct}%
- TAX JURISDICTION: ${input.location ?? 'Not specified'}

### 1A. REGIONAL PRICING CONTEXT
- Market: ${rc.market_name}
- Cost of living index: ${rc.cost_of_living_index} (national baseline: 100)
${rc.labor_market_note ? `- Market note: ${rc.labor_market_note}` : ''}
Adjust unit_price_cents proportionally to this index relative to national averages.
Example: if index is 87, price a $100 national-average part at ~$87.

### 2. CORE INPUTS (PRIORITIZE IN ORDER SHOWN)
${voiceSection}

${notesSection}

### 2C. JOB DESCRIPTION (baseline context)
Job: ${input.job_title}
${input.job_description}

### 3. PROPERTY & ASSET CONTEXT
- CUSTOMER: ${input.customer_name}
- KNOWN EQUIPMENT:
${assetList}
(If the Voice Transcript mentions equipment not listed here, trust the transcript.)

### 4. TECHNICAL INSTRUCTIONS
1. DATA EXTRACTION: Extract part names, quantities, and model numbers from the voice transcript first.
2. ACTION-PART SPLIT: Every action verb produces one labor line item AND one materials/equipment line item.
3. LABOR ESTIMATION: Use trade standards for ${input.trade_type.replace(/_/g, ' ')} but adjust for field notes.
4. NO TOTALS: Output unit_price_cents and quantity only. Do not sum. Do not output totals.
5. TAX CATEGORY: Assign tax_category to every line item.
6. COMMS: In sms_short use "~$TOTAL" as placeholder. In email_body_html use "$[COMPUTED_TOTAL]".
7. WORKFLOW TRIGGERS: requires_follow_up, parts_to_order, urgency 1-5.

### 5. FINAL CHECK
- All prices in CENTS (integer) per item. No sums anywhere in JSON.
- No markdown outside the <json> tags.
- needs_review: true on any inferred line item.

<json>
{
  "line_items": [
    {
      "description": "string",
      "category": "labor | materials | equipment | other",
      "tier": "single | good | better | best",
      "quantity": number,
      "unit": "string",
      "unit_price_cents": integer,
      "is_customer_facing": boolean,
      "is_inferred": boolean,
      "needs_review": boolean,
      "metadata": {
        "is_taxable": boolean,
        "tax_category": "service_labor | tangible_property | equipment | exempt"
      }
    }
  ],
  "summaries": {
    "sms_short": "string - use ~$TOTAL placeholder for the total amount",
    "email_body_html": "string - use $[COMPUTED_TOTAL] placeholder for totals",
    "internal_rationale": "string"
  },
  "workflow_triggers": {
    "requires_follow_up": boolean,
    "parts_to_order": ["string"],
    "urgency_score": 1
  },
  "confidence": {
    "score": "high | medium | low",
    "reason": "string"
  }
}
</json>`;

  return aiCall<AiEstimateResult>({
    system:   buildEstimateSystemPrompt(),
    messages: [{ role: 'user', content: userContent }],
  });
}

// =============================================================================
// VOICE-TO-LINE-ITEMS PARSER
//
// Separate function and schema — flat SQLite-compatible output.
// THINKING TAG: Claude must show addition in <thinking> before JSON.
// Application layer always recomputes total from line items — thinking output
// is a sanity check and audit trail only, never the authoritative total.
// IDs assigned by application layer (crypto.randomUUID()), not Claude.
// =============================================================================

export interface VoiceLineItem {
  description:      string;
  category:         'labor' | 'material' | 'diagnostic';
  quantity:         number;
  unit_price_cents: number;
  is_inferred:      boolean;
  needs_review:     boolean;
}

export interface VoiceParseResult {
  line_items: VoiceLineItem[];
  summary: {
    total_cents:      number;    // Claude's sum — app always recomputes independently
    confidence_score: number;    // 0.0 – 1.0
    ai_logic_notes:   string;
  };
}

export async function parseVoiceToLineItems(
  transcript:          string,
  trade_type:          TradeType,
  labor_rate_per_hour: number
): Promise<AiCallResult<VoiceParseResult>> {
  const laborRateCents = Math.round(labor_rate_per_hour * 100);

  return aiCall<VoiceParseResult>({
    system: [
      {
        type: 'text',
        text: `You are a specialized parser for ${trade_type.replace(/_/g, ' ')} field transcripts.
Your goal is to transform spoken estimate descriptions into a flat SQLite-compatible line-item schema.

ACTION-PART SPLIT:
Every action verb (installed, replaced, ran, repaired, cleaned) produces TWO items:
- A "labor" item for the time
- A "material" item for the part

${TRADE_KNOWLEDGE_BLOCK}

LABOR HEURISTICS (apply when duration is not stated):
- Minor task: 60 minutes
- Moderate task: 120 minutes
- Major task: 180+ minutes

DATA INTEGRITY:
- All prices in CENTS (integer). Never floats.
- is_inferred: true if quantity or price was not explicitly stated
- needs_review: true if the tech should verify before the estimate is sent
- confidence_score: 0.0 (pure guess) to 1.0 (every value explicitly stated)
- Use category "diagnostic" for inspection fees or trip charges.

THINKING REQUIREMENT:
Before outputting JSON, show your arithmetic in a <thinking> block:
- List each line item with: quantity x unit_price_cents = item_total_cents
- Sum all item totals to get total_cents
- This catches arithmetic errors before they reach the customer

Respond with <thinking>...</thinking> first, then <json>...</json>.`,
        cache_control: { type: 'ephemeral' },
      } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content:
          `Trade: ${trade_type.replace(/_/g, ' ')}\n` +
          `Default labor rate: $${labor_rate_per_hour}/hr (${laborRateCents} cents/hr)\n\n` +
          `Transcript:\n"${transcript}"\n\n` +
          `Show your addition in <thinking> tags first, then output:\n` +
          `<json>\n` +
          `{\n` +
          `  "line_items": [\n` +
          `    {\n` +
          `      "description": "string",\n` +
          `      "category": "labor | material | diagnostic",\n` +
          `      "quantity": number,\n` +
          `      "unit_price_cents": integer,\n` +
          `      "is_inferred": boolean,\n` +
          `      "needs_review": boolean\n` +
          `    }\n` +
          `  ],\n` +
          `  "summary": {\n` +
          `    "total_cents": integer,\n` +
          `    "confidence_score": number,\n` +
          `    "ai_logic_notes": "string"\n` +
          `  }\n` +
          `}\n` +
          `</json>`,
      },
    ],
  });
}
