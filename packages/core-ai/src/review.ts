import Anthropic from '@anthropic-ai/sdk';
import { aiCall } from './client';
import type { AiCallResult } from './client';

// =============================================================================
// AI REVIEW RESPONSE GENERATOR — RepuGuard
//
// Drafts professional, human-sounding responses to customer reviews.
// Handles the full rating spectrum from glowing 5-stars to angry 1-stars.
//
// Key principle: the contractor reviews and personalizes before posting.
// The AI delivers 90% of the work — the human adds the final touch.
// =============================================================================

export type ReviewFlag = 'legal' | 'safety' | 'fake' | 'none';

export interface GenerateReviewResponseInput {
  platform:        'google' | 'yelp' | 'facebook' | 'direct';
  rating:          1 | 2 | 3 | 4 | 5;
  review_text:     string;
  reviewer_name:   string;

  business_name:   string;
  owner_name:      string;
  trade_type:      string;

  job_description?: string;

  response_style:  'formal' | 'friendly' | 'brief';
}

export interface GeneratedReviewResponse {
  response:      string;          // full response, ready to post (max 150 words)
  alt_response:  string;          // SMS-length version for owner notification (max 160 chars, GSM 7-bit)
  word_count:    number;
  tone_used:     string;
  flags:         ReviewFlag[];
  flag_reason:   string | null;   // rationale if any flag other than 'none' is raised
}

// ─── System prompt [CACHED] ───────────────────────────────────────────────────

function buildReviewSystemPrompt(): Anthropic.TextBlockParam[] {
  return [
    {
      type: 'text',
      text: `You are the RepuGuard Review Assistant. You write review responses for tradespeople (HVAC, Plumbing, Electrical, Roofing). You speak as the owner, not a PR firm.

## THE ANCHOR RULE (most important rule)
If the review mentions a specific detail - a technician's name, a specific repair, a timeline, a product - you MUST reference that detail in the response. This proves a human read the review and wrote the reply. Generic responses that could apply to any review will be rejected.

## UNIVERSAL CONSTRAINTS
- Use the reviewer's first name once, naturally, at the start.
- No corporate-speak. Banned phrases: "valued customer," "strive for excellence," "top-notch service," "we take pride in."
- Use neighborly, professional language - like a trusted local business owner, not a call center.
- Never mention the platform (Google, Yelp, Facebook) by name in the response.
- Sign off with the owner's first name only. Never "The [Business] Team."
- Max 150 words unless the situation genuinely demands more.

## STAR-RATING LOGIC

5-Stars:
- Specific, warm, not gushing.
- Reference the detail they mentioned.
- One sentence about looking forward to helping them again.
- Do NOT use "We strive to provide..." - it is hollow and overused.

4-Stars:
- Thank them warmly.
- Acknowledge you would love to earn that 5th star.
- Give them a direct way to share what was missing.

3-Stars:
- Treat as an opportunity, not an insult.
- Neutral and objective tone.
- Ask them to call or text directly to make it right.

1-2 Stars:
- Never argue. Never be defensive. Never blame the customer.
- Acknowledge their frustration is real, regardless of the facts.
- Express genuine concern, not corporate concern.
- Offer a direct resolution line using placeholder "[Phone Number]."
- Remember: future customers are reading this response.
- If the review has factual inaccuracies: acknowledge their experience, do not argue publicly. Correct it privately.

## FLAG LOGIC
Raise flags when:
- "legal": review contains legal threats or mentions of lawsuits
- "safety": review mentions injury, property damage, or safety hazards
- "fake": review appears fabricated or from a competitor
- "none": no issues detected

When raising a "fake" flag, flag_reason MUST describe the specific signals that triggered it.
Describe the pattern concretely so the contractor can use it in a platform dispute.
Example signals to describe: "No specific service details mentioned", "Account has no other reviews",
"Language matches a known competitor\'s negative campaign pattern", "Review posted same day as service
with no verifiable job record", "Generic praise/complaint that could apply to any business."
The contractor needs this context to decide whether to dispute with Google/Yelp and what evidence to provide.

If any flag other than "none" is raised, populate flag_reason with a clear explanation.

## ALT_RESPONSE
Always generate an alt_response: a condensed version under 160 characters, GSM 7-bit safe (no smart quotes, no em-dashes), for notifying the business owner via SMS that a new review needs attention.

## OUTPUT
Return ONLY a minified JSON object in <json> tags. No preamble.`,
      cache_control: { type: 'ephemeral' },
    } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
  ];
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateReviewResponse(
  input: GenerateReviewResponseInput
): Promise<AiCallResult<GeneratedReviewResponse>> {

  const starLabel = ['', '1-star', '2-star', '3-star', '4-star', '5-star'][input.rating];
  const sentiment = input.rating >= 4 ? 'positive' : input.rating === 3 ? 'mixed' : 'negative';

  // Resolve job description server-side
  const serviceContext = input.job_description ?? 'No specific job records found.';

  const userContent =
    `<business_info>\n` +
    `  Owner: ${input.owner_name}\n` +
    `  Company: ${input.business_name}\n` +
    `  Trade: ${input.trade_type}\n` +
    `</business_info>\n\n` +

    `<review_to_process>\n` +
    `  Rating: ${input.rating} Stars (${starLabel} - ${sentiment})\n` +
    `  Platform: ${input.platform}\n` +
    `  Reviewer: ${input.reviewer_name}\n` +
    `  Text: """${input.review_text}"""\n` +
    `</review_to_process>\n\n` +

    `<service_context>\n` +
    `  ${serviceContext}\n` +
    `</service_context>\n\n` +

    `<request_details>\n` +
    `  Style: ${input.response_style}\n` +
    `  Apply the ANCHOR RULE - reference any specific detail from the review text.\n` +
    `  Generate both the full response and the alt_response SMS notification.\n` +
    `</request_details>\n\n` +

    `<json>\n` +
    `{\n` +
    `  "response": "string (max 150 words, ready to post)",\n` +
    `  "alt_response": "string (max 160 chars, GSM 7-bit, for owner SMS notification)",\n` +
    `  "word_count": integer,\n` +
    `  "tone_used": "string",\n` +
    `  "flags": ["legal | safety | fake | none"],\n` +
    `  "flag_reason": "string or null"\n` +
    `}\n` +
    `</json>`;

  return aiCall<GeneratedReviewResponse>({
    system:   buildReviewSystemPrompt(),
    messages: [{ role: 'user', content: userContent }],
  });
}

// =============================================================================
// MONTHLY REPUTATION SUMMARY — RepuGuard
//
// Generates the narrative section of the monthly email report.
// Numeric data is computed from the DB; the written insight comes from here.
// =============================================================================

export interface ReputationSummaryInput {
  business_name:       string;
  period:              string;
  avg_rating:          number;
  total_reviews:       number;
  new_reviews:         number;
  rating_change:       number;
  top_positive_themes: string[];
  top_negative_themes: string[];
  response_rate:       number;
  // Sentiment delta: key = theme name, value = % change vs previous period
  // Positive = more mentions, negative = fewer. e.g. { "Professionalism": -20, "Punctuality": 35 }
  // Pass empty object if no previous period data is available.
  theme_delta:         Record<string, number>;
}

export interface ReputationSummary {
  headline:     string;
  summary:      string;
  action_items: string[];
}

export async function generateReputationSummary(
  input: ReputationSummaryInput
): Promise<AiCallResult<ReputationSummary>> {

  const ratingDelta = input.rating_change >= 0
    ? `+${input.rating_change.toFixed(1)}`
    : input.rating_change.toFixed(1);

  const positiveThemes = input.top_positive_themes.join(', ') || 'none this period';
  const negativeThemes = input.top_negative_themes.join(', ') || 'none this period';

  return aiCall<ReputationSummary>({
    system: [
      {
        type: 'text',
        text: `You write monthly reputation summary reports for small trades businesses.
Be direct and actionable. Surface what actually matters. Skip generic advice.
Tone: like a trusted advisor, not a marketing consultant.
Respond in <json> tags only.`,
        cache_control: { type: 'ephemeral' },
      } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content:
          `Business: ${input.business_name}\n` +
          `Period: ${input.period}\n` +
          `Average rating: ${input.avg_rating.toFixed(1)} (${ratingDelta} vs last month)\n` +
          `New reviews: ${input.new_reviews} (${input.total_reviews} total)\n` +
          `Response rate: ${input.response_rate}%\n` +
          `Positive themes: ${positiveThemes}\n` +
          `Negative themes: ${negativeThemes}\n` +
          (Object.keys(input.theme_delta).length > 0
            ? `Sentiment delta vs last month:\n${Object.entries(input.theme_delta)
                .map(([theme, delta]) => `- ${theme}: ${delta >= 0 ? '+' : ''}${delta}%`)
                .join('\n')}\n`
            : 'No previous period data for sentiment comparison.\n') +
          `<json>\n` +
          `{\n` +
          `  "headline": "string",\n` +
          `  "summary": "string",\n` +
          `  "action_items": ["string"]\n` +
          `}\n` +
          `</json>`,
      },
    ],
  });
}
