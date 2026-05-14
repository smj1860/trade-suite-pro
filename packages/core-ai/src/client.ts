import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// ANTHROPIC CLIENT
//
// Single instance shared across all AI functions.
// Model: claude-sonnet-4-20250514 — best balance of quality and cost for
// the three use cases (estimate generation, follow-ups, review responses).
//
// PROMPT CACHING
// Long system prompts (trade knowledge, tone guidelines) are marked with
// cache_control: { type: "ephemeral" }. Claude caches these for up to 5
// minutes between calls. For the estimate generator — which has a dense
// trade-specific system prompt — caching cuts input token cost by ~90%.
//
// USAGE TRACKING
// Every call returns a UsageRecord. Callers log this to the database so
// you can see per-org AI spend and attribute costs to modules.
// =============================================================================

export const MODEL = 'claude-sonnet-4-20250514' as const;

// Max tokens per response — enough for any estimate or message
export const MAX_TOKENS = 2048;

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;

  const apiKey =
    (typeof process !== 'undefined' && process.env['ANTHROPIC_API_KEY']) ||
    ((import.meta as unknown as Record<string, Record<string, string>>)
      .env?.['ANTHROPIC_API_KEY']);

  if (!apiKey) {
    throw new Error('[core-ai] Missing ANTHROPIC_API_KEY environment variable');
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

// ─── Usage tracking ───────────────────────────────────────────────────────────

export interface UsageRecord {
  model:                   string;
  input_tokens:            number;
  output_tokens:           number;
  cache_creation_tokens:   number;   // tokens written to cache (cost: 1.25x)
  cache_read_tokens:       number;   // tokens read from cache (cost: 0.10x)
  estimated_cost_usd:      number;
}

// Claude Sonnet 4 pricing (per million tokens)
const PRICING = {
  input:          3.00,
  output:        15.00,
  cache_write:    3.75,  // 1.25x input
  cache_read:     0.30,  // 0.10x input
} as const;

export function calculateUsage(
  usage: Anthropic.Usage & {
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  }
): UsageRecord {
  const cache_creation = usage.cache_creation_input_tokens ?? 0;
  const cache_read     = usage.cache_read_input_tokens ?? 0;
  const billable_input = usage.input_tokens - cache_read;

  const cost =
    (billable_input     / 1_000_000) * PRICING.input +
    (usage.output_tokens/ 1_000_000) * PRICING.output +
    (cache_creation     / 1_000_000) * PRICING.cache_write +
    (cache_read         / 1_000_000) * PRICING.cache_read;

  return {
    model:                 MODEL,
    input_tokens:          usage.input_tokens,
    output_tokens:         usage.output_tokens,
    cache_creation_tokens: cache_creation,
    cache_read_tokens:     cache_read,
    estimated_cost_usd:    Math.round(cost * 1_000_000) / 1_000_000,
  };
}

// ─── JSON extraction helper ───────────────────────────────────────────────────
//
// All AI functions instruct Claude to wrap JSON output in <json> tags.
// This is more reliable than raw JSON output — the tags survive reasoning
// text that Claude occasionally emits before the structured response.

export function extractJson<T>(text: string): T {
  const match = text.match(/<json>([\s\S]*?)<\/json>/);
  if (!match?.[1]) {
    throw new Error(
      `[core-ai] No <json> block found in response.\n` +
      `Raw response: ${text.slice(0, 500)}`
    );
  }
  try {
    return JSON.parse(match[1].trim()) as T;
  } catch (err) {
    throw new Error(
      `[core-ai] Failed to parse JSON from response: ${err}\n` +
      `JSON content: ${match[1].slice(0, 500)}`
    );
  }
}

// ─── Base AI call wrapper ─────────────────────────────────────────────────────

export interface AiCallResult<T> {
  data:  T;
  usage: UsageRecord;
}

export async function aiCall<T>(params: {
  system:   Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
}): Promise<AiCallResult<T>> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    system:     params.system,
    messages:   params.messages,
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    data:  extractJson<T>(text),
    usage: calculateUsage(response.usage),
  };
}
