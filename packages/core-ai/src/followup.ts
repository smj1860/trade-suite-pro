import Anthropic from '@anthropic-ai/sdk';
import type { TradeType } from '@trades-saas/core-types';
import { aiCall } from './client';
import type { AiCallResult } from './client';

// =============================================================================
// AI FOLLOW-UP GENERATOR — LeadLock
//
// Generates contextual follow-up messages for each step of the sequence.
// Messages sound like the actual contractor wrote them — not a CRM.
//
// Used for:
//   - Missed-call first reply (immediate, within 90 seconds)
//   - Day 1 / 3 / 5 / 10 follow-up sequence
//   - Post-estimate nudges
// =============================================================================

export type FollowUpTone = 'warm' | 'professional' | 'casual';

export interface GenerateFollowUpInput {
  step:               number;     // 0-indexed
  total_steps:        number;
  trigger:            'missed_call' | 'estimate_sent' | 'no_response';
  days_since_contact: number;

  customer_name:      string;
  business_name:      string;
  tech_name?:         string;

  trade_type:         TradeType;
  job_title?:         string;
  estimate_amount?:   number;     // cents

  channel:            'sms' | 'email';
  tone:               FollowUpTone;

  previous_messages?: string[];
}

export type FollowUpStepType =
  | 'nudge'         // Day 1 first contact
  | 'detail'        // Day 3-5 with estimate details
  | 'close_loop'    // Day 10 clearing schedule
  | 'future_need';  // Day 10 timing issue — reactivate in 90 days

export interface GeneratedFollowUp {
  body:        string;
  subject?:    string;    // email only
  html?:       string;    // email only
  char_count:  number;
  step_type:   FollowUpStepType;
  notes:       string;
}

// ─── System prompt [CACHED] ───────────────────────────────────────────────────

function buildFollowUpSystemPrompt(): Anthropic.TextBlockParam[] {
  return [
    {
      type: 'text',
      text: `You are the LeadLock Messaging Engine. You generate high-conversion follow-up messages for trade pros (HVAC, Roofing, Plumbing, Electrical).

## THE "FIELD-TECH" VOICE
- Authenticity: Write like a tech standing in a driveway. Use "I" (the tech) or "We" (the small business).
- Zero Fluff: No corporate speak. No "valued customers" or "service offerings."
- The Banned List: Never use "Checking in," "Touching base," "Circling back," or "I hope this finds you well."
- Direct Replacements:
  - Instead of "Following up on the estimate" use "Did you get a chance to look over that [trade] quote?"
  - Instead of "Let us know" use "Reply here if you want to get this scheduled."
  - Instead of "Reaching out" use "Wanted to check in on [specific job]."

## TECHNICAL CONSTRAINTS

### SMS (Telnyx Optimized)
- Hard Limit: 160 chars. Target: 120-140 chars to ensure single-segment delivery.
- GSM 7-bit Only: No emojis, no smart quotes (""), no em-dashes (-). Use standard apostrophe (') and hyphen (-).
- Structure: [Specific Reference to the job] + [One low-friction question or action].
- One CTA only. No pleasantries that waste characters.

### EMAIL (Resend / Clean HTML)
- Subject: Specific and low-pressure. Format: "{business_name}: {job_title}" or "Quick question about your {trade} work."
  Never: "Following up!" or generic subjects.
- Body: 3 sentences max in plain text.
- HTML: Use only <p>, <a>, and <br> tags. No <div> or complex nesting.

## SEQUENCE ARCHITECTURE
- The Nudge (Step 0 / Day 1): Focus on the specific job. Assume they are busy, not ignoring you.
- The Detail (Steps 1-2 / Day 3-5): Mention the estimate amount if sent. Offer to answer a technical question.
- The Pivot (Final step / Day 10): "Closing the loop." TWO BRANCHES based on context:
  - If estimate was sent: mention you are clearing the schedule. Creates soft urgency.
  - If no estimate / timing issue: pivot to REFERRAL / FUTURE NEED tone.
    Goal is to stay top-of-mind for next season without being pushy.
    Suggested: "If the timing isn\'t right, no problem - reply \'next season\' and I\'ll check back."
    This captures future-intent leads rather than discarding them.
  Set step_type: "close_loop" for standard pivot, "future_need" for timing-based pivot.

## OUTPUT
Return valid JSON only in <json> tags.`,
      cache_control: { type: 'ephemeral' },
    } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
  ];
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateFollowUp(
  input: GenerateFollowUpInput
): Promise<AiCallResult<GeneratedFollowUp>> {

  const tradeLabel = input.trade_type.replace(/_/g, ' ');
  const isFinalStep = input.step === input.total_steps - 1;

  // Resolve all conditional values server-side
  const estimateContext = input.estimate_amount != null
    ? `Quote sent: $${(input.estimate_amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : 'No estimate sent yet';

  const messageHistory = input.previous_messages?.length
    ? input.previous_messages.map((m, i) => `${i + 1}. "${m}"`).join('\n')
    : 'This is the first message in the sequence.';

  const sequenceLabel = isFinalStep
    ? `${input.step + 1} of ${input.total_steps} - THE PIVOT (final message, closing the loop)`
    : input.step === 0
      ? `1 of ${input.total_steps} - THE NUDGE (first contact)`
      : `${input.step + 1} of ${input.total_steps} - THE DETAIL`;

  const userContent = `# TASK
Generate a ${input.channel.toUpperCase()} follow-up message for sequence step ${sequenceLabel}.

# DATA CONTEXT
- Customer: ${input.customer_name}
- Tech/Business: ${input.tech_name ? `${input.tech_name} @ ${input.business_name}` : input.business_name}
- Job Detail: ${tradeLabel} - ${input.job_title ?? tradeLabel + ' inquiry'}
- Trigger: ${input.trigger.replace(/_/g, ' ')} (${input.days_since_contact} days since last contact)
- ${estimateContext}

# MESSAGE HISTORY
${messageHistory}

# OUTPUT REQUIREMENTS
- Tone: ${input.tone} (default "boots on the ground" feel)
- Channel: ${input.channel.toUpperCase()}
${input.channel === 'sms' ? '- SMS Max: 160 chars (target 140). GSM 7-bit only.' : '- Email: 3-sentence body max. Subject must be specific and low-pressure.'}

Write the ${input.channel} message now.

<json>
{
  "body": "string",${input.channel === 'email' ? '\n  "subject": "string",\n  "html": "string",' : ''}
  "char_count": integer,
  "step_type": "nudge | detail | close_loop | future_need",
  "notes": "string"
}
</json>`;

  return aiCall<GeneratedFollowUp>({
    system:   buildFollowUpSystemPrompt(),
    messages: [{ role: 'user', content: userContent }],
  });
}

// =============================================================================
// MISSED-CALL INSTANT REPLY
//
// Fires within 90 seconds of a missed call via Telnyx webhook.
// Role/constraints live in the system prompt — not mixed into the user message.
// =============================================================================

export interface MissedCallReplyInput {
  customer_name?:  string;
  business_name:   string;
  trade_type:      TradeType;
  booking_url:     string;
}

export interface MissedCallReply {
  body:       string;
  char_count: number;
}

export async function generateMissedCallReply(
  input: MissedCallReplyInput
): Promise<AiCallResult<MissedCallReply>> {

  // Resolve the opening server-side per the caller ID availability
  const customerContext = input.customer_name
    ? `Customer name is known: ${input.customer_name}. Start with "Hi ${input.customer_name}, sorry I missed you"`
    : 'Customer name is unknown. Start with "Sorry we missed your call"';

  return aiCall<MissedCallReply>({
    system: [
      {
        type: 'text',
        text: `Role: You are a professional trades contractor (HVAC, plumbing, electrical, roofing) who is currently on a job but wants to help this caller.
Task: Generate a single missed-call auto-reply SMS.
Constraints:
1. Max 140 chars. Hard limit.
2. No exclamation marks.
3. Sentence case only.
4. Sound like a real person on a job site, not an automated system.
5. One CTA only (reply or booking link).
6. GSM 7-bit only - no smart quotes, no em-dashes, no emojis.
Output: Valid JSON only in <json> tags.`,
        cache_control: { type: 'ephemeral' },
      } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content:
          `Business: ${input.business_name}\n` +
          `Trade: ${input.trade_type.replace(/_/g, ' ')}\n` +
          `${customerContext}\n` +
          `Booking link: ${input.booking_url}\n\n` +
          `<json>{"body": "string", "char_count": integer}</json>`,
      },
    ],
  });
}
