import Anthropic from '@anthropic-ai/sdk';
import { aiCall } from './client';
import type { AiCallResult } from './client';

// =============================================================================
// JOB SUMMARY GENERATOR — Core
//
// Generates a professional job completion summary from:
//   - Tech field notes (internal + customer-facing)
//   - Work performed (estimate line items)
//   - Photo descriptions
//
// Used in:
//   - Customer completion report (emailed or SMS'd after job closes)
//   - Internal job record for the owner's reference
//   - RepuGuard review request context ("We just completed your HVAC tune-up")
// =============================================================================

export interface GenerateJobSummaryInput {
  job_title:        string;
  trade_type:       string;
  customer_name:    string;
  business_name:    string;

  // What was actually done
  line_items_completed: Array<{
    description: string;
    category:    string;
  }>;

  // Tech notes (customer-facing only)
  customer_notes: string[];

  // Photo descriptions (from vision.ts)
  photo_descriptions: string[];

  // Assets serviced
  assets_serviced: Array<{
    name:  string;
    make:  string | null;
    model: string | null;
  }>;

  // Output format
  format: 'customer_email' | 'customer_sms' | 'internal';
}

export interface GeneratedJobSummary {
  summary:          string;    // the main content
  subject?:         string;    // email subject if format = customer_email
  html?:            string;    // HTML if format = customer_email
  key_points:       string[];  // bullet list of what was done
  recommendations:  string[];  // follow-up items tech noted (warranties, future work)
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSummarySystemPrompt(): Anthropic.TextBlockParam[] {
  return [
    {
      type: 'text',
      text: `You write job completion summaries for small trades contractors.
The summary is sent to customers after a job is finished.

RULES:
- Be specific about what was done — customers want to know their money was well spent
- Use plain language, not trade jargon (say "cleaned the drain" not "snaked the P-trap")
- Customer email: warm, professional. Match length to content — if detail is sparse, a brief
  accurate summary is better than a padded one. Maximum 250 words. No minimum.
- Customer SMS: under 100 words, link to full report implied
- Internal: factual, include any liability notes or warranty items
- Recommendations should be genuine — not upsells for their own sake
- Never fabricate work that was not listed in the line items
- If line items are sparse, keep the summary brief rather than expanding with filler.
  A short honest summary beats a long vague one every time.

Respond in <json> tags only.`,
      cache_control: { type: 'ephemeral' },
    } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
  ];
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateJobSummary(
  input: GenerateJobSummaryInput
): Promise<AiCallResult<GeneratedJobSummary>> {
  const workPerformed = input.line_items_completed
    .map(li => `- ${li.description} (${li.category})`)
    .join('\n');

  const assetsContext = input.assets_serviced.length > 0
    ? `\nEQUIPMENT SERVICED:\n${input.assets_serviced.map(a =>
        `- ${a.name}${a.make ? ` (${a.make} ${a.model ?? ''})` : ''}`
      ).join('\n')}`
    : '';

  const notesContext = input.customer_notes.length > 0
    ? `\nTECH NOTES:\n${input.customer_notes.join('\n')}`
    : '';

  const photoContext = input.photo_descriptions.length > 0
    ? `\nPHOTO DOCUMENTATION:\n${input.photo_descriptions.join('\n')}`
    : '';

  const userContent = `Write a job completion summary.

JOB: ${input.job_title}
TRADE: ${input.trade_type}
CUSTOMER: ${input.customer_name}
BUSINESS: ${input.business_name}
FORMAT: ${input.format}

WORK COMPLETED:
${workPerformed}
${assetsContext}${notesContext}${photoContext}

<json>
{
  "summary": "string",
  ${input.format === 'customer_email' ? '"subject": "string",\n  "html": "string",' : ''}
  "key_points": ["string"],
  "recommendations": ["string"]
}
</json>`;

  return aiCall<GeneratedJobSummary>({
    system:   buildSummarySystemPrompt(),
    messages: [{ role: 'user', content: userContent }],
  });
}
