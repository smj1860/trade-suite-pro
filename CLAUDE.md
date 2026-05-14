# CLAUDE.md — TradeSuite Phase 2
> Execution file. Read completely, then work top to bottom without pausing for confirmation.
> The previous Claude Code session completed core infrastructure and LeadLock.
> This session finishes OmniBid, builds RepuGuard, and closes all remaining gaps.

---

## WHAT EXISTS — DO NOT RECREATE

Before writing any file, `cat` it first. These are confirmed complete:

```
packages/core-types/              ← complete
packages/core-auth/               ← complete
packages/core-sync/src/schema.ts  ← complete — AppSchema has all tables
packages/core-sync/src/client.ts  ← complete
packages/core-db/supabase/migrations/  ← 0001 and 0002 complete
supabase/migrations/20260514_leadlock.sql  ← complete
supabase/functions/telnyx-webhook/  ← complete
inngest/functions/leadlock-sequence.ts  ← complete
modules/leads/                    ← complete — all files
modules/estimates/src/types.ts    ← complete
modules/estimates/src/pages/      ← EstimatesPage.tsx and EstimateDetailPage.tsx complete
modules/estimates/src/components/PriceBookPicker.tsx  ← complete
modules/estimates/supabase/migrations/0001_omnibid_schema.sql  ← complete
apps/pwa/src/App.tsx              ← complete — all routes wired
apps/pwa/src/pages/settings/BillingPage.tsx  ← complete
apps/pwa/src/pages/DashboardPage.tsx  ← complete
```

---

## HARD RULES (never break these)

- Package prefix: `@trades-saas/` only
- Framework: Vite + React 18 — no Next.js patterns
- Font: Inter only — `font-display` and `font-mono` both map to Inter
- Colors: Tailwind token classes only — `bg-brand`, `bg-surface`, `bg-surface-raised`, `text-content`, `text-content-secondary`, `text-content-muted`, `text-brand`, `text-success`, `text-warning`, `text-danger`, `text-info`
- Reads: PowerSync `useQuery` from `@powersync/react` — never `supabase.from().select()` in components
- Money: stored as cents (`_cents`), displayed via `(cents/100).toLocaleString('en-US', {style:'currency',currency:'USD'})`
- `set_updated_at()` trigger function already exists — never redefine
- Edge Functions: Deno runtime — imports from `https://esm.sh/` or `https://deno.land/` only
- Touch targets: 48px minimum (`h-touch` class)

---

# TASK LIST

---

## TASK 1 — Verify and enforce Safety Orange theme

Check `packages/core-ui/src/tokens/index.ts`. It must contain `#FF6600` as the primary brand color and `#1A1A1A` as the base surface. If it contains `#093b31` (green) or `#f8f7f4` (light background), replace the entire file with:

```typescript
export const BRAND = {
  darkest: '#cc4400',
  dark:    '#FF6600',
  mid:     '#e65c00',
  light:   '#ff8533',
  pale:    '#fff0e6',
} as const;

export const ACCENT = {
  DEFAULT: '#C0C0C0',
  light:   '#d9d9d9',
  dark:    '#9a9a9a',
} as const;

export const SURFACE = {
  DEFAULT: '#1A1A1A',
  raised:  '#2D2D2D',
  sunken:  '#141414',
  border:  '#3d3d3d',
} as const;

export const TEXT = {
  DEFAULT:   '#FFFFFF',
  secondary: '#C0C0C0',
  muted:     '#6b6b6b',
  inverse:   '#1A1A1A',
} as const;

export const SEMANTIC = {
  danger:  '#f87171',
  warning: '#fbbf24',
  success: '#34d399',
  info:    '#60a5fa',
} as const;

export const STATUS_COLORS = {
  lead:      { bg: '#3d2e00', text: '#fbbf24', border: '#78590a', dot: '#fbbf24' },
  scheduled: { bg: '#1e2a3d', text: '#60a5fa', border: '#1d4070', dot: '#60a5fa' },
  active:    { bg: '#1a3d2e', text: '#34d399', border: '#166046', dot: '#34d399' },
  complete:  { bg: '#2d1a00', text: '#FF6600', border: '#7a3500', dot: '#FF6600' },
  closed:    { bg: '#242424', text: '#6b6b6b', border: '#3d3d3d', dot: '#6b6b6b' },
  cancelled: { bg: '#3d1a1a', text: '#f87171', border: '#7f1d1d', dot: '#f87171' },
} as const;

export const URGENCY_COLORS = {
  1: { bg: '#242424', text: '#6b6b6b', label: 'Routine'   },
  2: { bg: '#1e2a3d', text: '#60a5fa', label: '2 weeks'   },
  3: { bg: '#3d2e00', text: '#fbbf24', label: '1 week'    },
  4: { bg: '#3d1e0a', text: '#fb923c', label: 'Urgent'    },
  5: { bg: '#3d1a1a', text: '#f87171', label: 'Emergency' },
} as const;

export const FONTS = {
  display: '"Inter", system-ui, sans-serif',
  body:    '"Inter", system-ui, sans-serif',
  mono:    '"Inter", system-ui, sans-serif',
} as const;

export const TOUCH_TARGET       = '48px';
export const BOTTOM_NAV_HEIGHT  = '64px';
export const PAGE_HEADER_HEIGHT = '56px';

export const SHADOWS = {
  card:   '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  raised: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)',
  modal:  '0 20px 60px rgba(0,0,0,0.7)',
  orange: '0 4px 14px rgba(255,102,0,0.35)',
} as const;
```

Check `apps/pwa/index.html`. Must have:
- `<meta name="theme-color" content="#FF6600" />`
- Inter font link: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap`
- No Sora or DM Mono references

Check `apps/pwa/src/styles.css`. Must have `color-scheme: dark` on `html` and `background-color: var(--surface)` on `body`. If `--surface` is not `#1A1A1A`, update the CSS vars block to match the tokens above.

Check `packages/core-ui/tailwind.config.ts`. fontFamily must use Inter for all three keys (display, sans, mono). Update if needed.

---

## TASK 2 — Verify OmniBid hooks and components exist

```bash
cat modules/estimates/src/hooks/useEstimates.ts
cat modules/estimates/src/components/VoiceButton.tsx
cat modules/estimates/src/components/LineItemRow.tsx
```

### If `useEstimates.ts` is missing or a stub, create it:

```typescript
// modules/estimates/src/hooks/useEstimates.ts
import { useQuery } from '@powersync/react';
import { useCallback } from 'react';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { Estimate, EstimateItem, EstimateStatus, PriceBookItem, VoiceParseResult } from '../types';

const supabase = getSupabaseClient();

export function useEstimates(filter?: EstimateStatus) {
  const where = filter ? `WHERE status = '${filter}'` : '';
  return useQuery<Estimate>(
    `SELECT * FROM estimates ${where} ORDER BY created_at DESC`
  );
}

export function useEstimate(estimateId: string) {
  return useQuery<Estimate>(
    'SELECT * FROM estimates WHERE id = ? LIMIT 1', [estimateId]
  );
}

export function useEstimateItems(estimateId: string) {
  return useQuery<EstimateItem>(
    'SELECT * FROM estimate_line_items WHERE estimate_id = ? ORDER BY sort_order ASC',
    [estimateId]
  );
}

export function usePriceBook(search?: string) {
  if (search && search.length > 1) {
    return useQuery<PriceBookItem>(
      `SELECT * FROM price_book WHERE active = 1
       AND (LOWER(name) LIKE LOWER(?) OR LOWER(COALESCE(category,'')) LIKE LOWER(?))
       ORDER BY category, name LIMIT 30`,
      [`%${search}%`, `%${search}%`]
    );
  }
  return useQuery<PriceBookItem>(
    'SELECT * FROM price_book WHERE active = 1 ORDER BY category, name'
  );
}

export function useEstimateStats() {
  const { data } = useQuery<{
    draft: number; sent: number; accepted: number; total_value_cents: number;
  }>(`
    SELECT
      COUNT(CASE WHEN status = 'draft'    THEN 1 END) AS draft,
      COUNT(CASE WHEN status = 'sent'     THEN 1 END) AS sent,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) AS accepted,
      COALESCE(SUM(CASE WHEN status IN ('sent','viewed','accepted') THEN total_cents END), 0)
        AS total_value_cents
    FROM estimates
  `);
  return data?.[0] ?? { draft: 0, sent: 0, accepted: 0, total_value_cents: 0 };
}

export function useEstimateActions() {
  const addLineItem = useCallback(async (item: Omit<EstimateItem, 'id' | 'created_at'>) => {
    const { error } = await supabase.from('estimate_line_items').insert(item);
    if (error) throw error;
  }, []);

  const updateLineItem = useCallback(async (
    id: string,
    patch: Partial<Pick<EstimateItem, 'quantity' | 'unit_price_cents' | 'total_cents' | 'description'>>
  ) => {
    const { error } = await supabase.from('estimate_line_items').update(patch).eq('id', id);
    if (error) throw error;
  }, []);

  const removeLineItem = useCallback(async (id: string) => {
    const { error } = await supabase.from('estimate_line_items').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const sendEstimate = useCallback(async (estimateId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/omnibid-send-estimate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ estimate_id: estimateId }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ payment_link_url: string }>;
  }, []);

  const parseVoice = useCallback(async (orgId: string, audioBlob: Blob): Promise<VoiceParseResult> => {
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    form.append('org_id', orgId);
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/omnibid-voice-parse`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
        body: form,
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<VoiceParseResult>;
  }, []);

  return { addLineItem, updateLineItem, removeLineItem, sendEstimate, parseVoice };
}
```

### If `VoiceButton.tsx` is missing or a stub, create it:

```tsx
// modules/estimates/src/components/VoiceButton.tsx
import { useRef } from 'react';

interface Props {
  state: 'idle' | 'recording' | 'parsing';
  onStart: () => void;
  onRecorded: (blob: Blob) => void;
}

export function VoiceButton({ state, onStart, onRecorded }: Props) {
  const mrRef     = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mrRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      onRecorded(new Blob(chunksRef.current, { type: 'audio/webm' }));
    };
    mr.start();
    onStart();
  }

  function stopRecording() { mrRef.current?.stop(); }

  if (state === 'parsing') return (
    <div className="flex items-center gap-2 text-field-xs text-content-secondary">
      <span className="w-4 h-4 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
      Parsing...
    </div>
  );

  return (
    <button
      onPointerDown={state === 'idle' ? startRecording : undefined}
      onPointerUp={state === 'recording' ? stopRecording : undefined}
      onPointerLeave={state === 'recording' ? stopRecording : undefined}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all select-none shadow-orange ${
        state === 'recording'
          ? 'bg-danger scale-110 animate-pulse'
          : 'bg-brand hover:bg-brand-mid active:scale-95'
      }`}
      title={state === 'idle' ? 'Hold to record' : 'Release to stop'}
    >
      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    </button>
  );
}
```

### If `LineItemRow.tsx` is missing or a stub, create it:

```tsx
// modules/estimates/src/components/LineItemRow.tsx
import type { EstimateItem } from '../types';

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

interface Props {
  item: EstimateItem;
  editable: boolean;
  onUpdate: (patch: Partial<Pick<EstimateItem, 'quantity' | 'unit_price_cents' | 'description'>>) => void;
  onRemove: () => void;
}

export function LineItemRow({ item, editable, onUpdate, onRemove }: Props) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded-card p-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-field-sm font-semibold text-content truncate">{item.description}</p>
          {item.category && (
            <p className="text-field-xs text-content-muted mt-0.5">{item.category}</p>
          )}
        </div>
        {editable && (
          <button onClick={onRemove} className="text-content-muted hover:text-danger transition-colors p-0.5 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2">
        {editable ? (
          <input
            type="number" value={item.quantity} min={0.001} step={0.5}
            onChange={e => {
              const q = parseFloat(e.target.value) || 1;
              onUpdate({ quantity: q, unit_price_cents: item.unit_price_cents });
            }}
            className="w-16 bg-surface-sunken text-content text-field-xs font-mono rounded px-2 py-1
                       border border-surface-border focus:border-brand outline-none text-center"
          />
        ) : (
          <span className="text-field-xs font-mono text-content-secondary">{item.quantity}</span>
        )}
        {item.unit && <span className="text-field-xs text-content-muted">{item.unit}</span>}
        <span className="text-field-xs text-content-muted mx-1">×</span>

        {editable ? (
          <div className="flex items-center">
            <span className="text-field-xs text-content-muted mr-0.5">$</span>
            <input
              type="number" value={(item.unit_price_cents / 100).toFixed(2)} min={0} step={0.01}
              onChange={e => onUpdate({ unit_price_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
              className="w-20 bg-surface-sunken text-content text-field-xs font-mono rounded px-2 py-1
                         border border-surface-border focus:border-brand outline-none text-right"
            />
          </div>
        ) : (
          <span className="text-field-xs font-mono text-content-secondary">{fmt(item.unit_price_cents)}</span>
        )}

        <span className="flex-1" />
        <span className="text-field-sm font-mono font-bold text-content">{fmt(item.total_cents)}</span>
      </div>
    </div>
  );
}
```

---

## TASK 3 — Stripe Edge Functions (CRITICAL — BillingPage is broken without these)

Both `core-auth/src/organization.ts` and `apps/pwa/src/pages/settings/BillingPage.tsx` call `supabase.functions.invoke('stripe-portal')`. This does not exist yet.

### `supabase/functions/stripe-portal/index.ts`

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';

const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { returnUrl } = await req.json() as { returnUrl: string };

  // Get org + Stripe customer ID
  const { data: member } = await supabase
    .from('org_members')
    .select('org_id, organizations(stripe_customer_id)')
    .eq('user_id', user.id)
    .single();

  const stripeCustomerId = (member?.organizations as any)?.stripe_customer_id;

  if (!stripeCustomerId) {
    return new Response(
      JSON.stringify({ error: 'No Stripe customer found. Please contact support.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: returnUrl,
  });

  return new Response(
    JSON.stringify({ url: session.url }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

### `supabase/functions/stripe-webhook/index.ts`

This is what writes `active_modules` to the org when a subscription is created, updated, or cancelled.

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';

const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Map Stripe product IDs → module names.
// Set these in Stripe dashboard → Products → each product's metadata: { module: 'leads' }
// Or hard-code them here using your actual product IDs.
async function getActiveModulesFromSubscription(subscription: Stripe.Subscription): Promise<string[]> {
  const modules: string[] = [];
  for (const item of subscription.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);
    const module  = product.metadata?.module;
    if (module && ['leads', 'estimates', 'reviews'].includes(module)) {
      modules.push(module);
    }
  }
  return modules;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const isActive   = subscription.status === 'active' || subscription.status === 'trialing';

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!org) {
    console.warn('stripe-webhook: no org found for customer', customerId);
    return;
  }

  const activeModules = isActive
    ? await getActiveModulesFromSubscription(subscription)
    : [];

  await supabase
    .from('organizations')
    .update({
      active_modules:           activeModules,
      stripe_subscription_id:   subscription.id,
    })
    .eq('id', org.id);

  console.log(`stripe-webhook: org ${org.id} → modules [${activeModules.join(', ')}]`);
}

serve(async (req) => {
  const sig     = req.headers.get('stripe-signature') ?? '';
  const body    = await req.text();
  const secret  = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error('stripe-webhook signature error:', err);
    return new Response('Webhook signature invalid', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded': {
        // Fire Inngest event for OmniBid payment confirmation
        const invoice = event.data.object as Stripe.Invoice;
        const meta    = (invoice as any).metadata ?? {};
        if (meta.estimate_id) {
          await fetch(Deno.env.get('INNGEST_EVENT_URL') ?? 'https://inn.gs/e', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('INNGEST_EVENT_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'omnibid/estimate.paid',
              data: {
                estimate_id: meta.estimate_id,
                org_id:      meta.org_id,
                amount_paid: invoice.amount_paid,
              },
            }),
          });
        }
        break;
      }

      default:
        // Ignore unhandled events
    }
  } catch (err) {
    console.error('stripe-webhook processing error:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
});
```

Deploy both:
```bash
supabase functions deploy stripe-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

In Stripe dashboard → Webhooks, add your webhook URL and subscribe to:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`

---

## TASK 4 — OmniBid Edge Functions

### `supabase/functions/omnibid-voice-parse/index.ts`

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function transcribeWithGemini(audioBase64: string, mimeType: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get('GOOGLE_API_KEY')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: audioBase64 } },
            { text: 'Transcribe this audio exactly. The speaker is a contractor describing work. Include all numbers and item names verbatim. Output only the transcription.' }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function structureWithClaude(transcript: string, priceBook: any[]): Promise<object> {
  const pbText = priceBook
    .map((i: any) => `- ID:${i.id} | "${i.name}" | ${i.unit} @ $${(i.unit_price / 100).toFixed(2)}`)
    .join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Parse contractor voice memos into structured estimate line items.
Price book:
${pbText || 'Empty — no price book configured.'}

Rules:
- Match items to price book when clearly matching. Set price_book_id to the ID, or null if no match.
- confidence: "high" = clear match, "medium" = likely, "low" = no match.
- Use quantities and units stated by the speaker. Default quantity: 1.
- Generate a short job title summarizing the work.
- unit_price is in dollars (not cents).
- Return ONLY valid JSON, no markdown.

Format: {"title":"string","items":[{"name":"string","quantity":number,"unit":"each|hour|sqft|lnft|ton|lb|ft","unit_price":number,"price_book_id":"uuid or null","confidence":"high|medium|low"}],"raw_transcript":"string"}`,
      messages: [{ role: 'user', content: `Parse this transcript:\n\n"${transcript}"` }],
    }),
  });

  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`);
  const data = await res.json() as any;
  const text = data.content?.find((b: any) => b.type === 'text')?.text ?? '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  let orgId: string, audioBlob: Blob, mimeType: string;
  try {
    const form = await req.formData();
    orgId     = form.get('org_id') as string;
    audioBlob = form.get('audio') as Blob;
    mimeType  = audioBlob.type || 'audio/webm';
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const { data: member } = await supabase
    .from('org_members').select('id').eq('org_id', orgId).eq('user_id', user.id).single();
  if (!member) return new Response('Forbidden', { status: 403 });

  try {
    const bytes     = await audioBlob.arrayBuffer();
    const b64       = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    const { data: pb } = await supabase
      .from('price_book').select('id, name, unit, unit_price, aliases')
      .eq('org_id', orgId).eq('active', true);

    const transcript = await transcribeWithGemini(b64, mimeType);
    const result     = await structureWithClaude(transcript, pb ?? []);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('omnibid-voice-parse error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### `supabase/functions/omnibid-send-estimate/index.ts`

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe           from 'https://esm.sh/stripe@14';
import { Resend }       from 'https://esm.sh/resend@3';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const stripe   = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const resend   = new Resend(Deno.env.get('RESEND_API_KEY')!);

function fmt(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { estimate_id } = await req.json() as { estimate_id: string };

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*, customers(*), organizations(*)')
    .eq('id', estimate_id)
    .single();

  if (!estimate) return new Response('Not found', { status: 404 });

  const { data: items } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', estimate_id)
    .order('sort_order');

  const customer = (estimate as any).customers;
  const org      = (estimate as any).organizations;

  if (!customer?.email) return new Response('Customer email required', { status: 400 });

  const { data: member } = await supabase
    .from('org_members').select('id').eq('org_id', estimate.org_id).eq('user_id', user.id).single();
  if (!member) return new Response('Forbidden', { status: 403 });

  try {
    // Create Stripe Payment Link
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: estimate.total_cents,
      product_data: { name: `${org.name} — Estimate ${estimate.estimate_number}` },
    });
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { estimate_id, org_id: estimate.org_id },
    });

    // Build HTML email
    const rows = (items ?? []).map((item: any) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #2d2d2d">${item.description}</td>
       <td style="padding:8px 0;border-bottom:1px solid #2d2d2d;text-align:right">${item.quantity} ${item.unit ?? ''}</td>
       <td style="padding:8px 0;border-bottom:1px solid #2d2d2d;text-align:right;font-weight:600">${fmt(item.total_cents)}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><body style="font-family:Inter,system-ui,sans-serif;background:#1A1A1A;color:#fff;max-width:600px;margin:0 auto;padding:32px 20px">
      <h1 style="font-size:24px;margin:0 0 4px">${org.name}</h1>
      <p style="color:#C0C0C0;margin:0 0 32px">${estimate.estimate_number}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead><tr style="border-bottom:2px solid #FF6600">
          <th style="text-align:left;padding-bottom:8px;color:#C0C0C0">Description</th>
          <th style="text-align:right;padding-bottom:8px;color:#C0C0C0">Qty</th>
          <th style="text-align:right;padding-bottom:8px;color:#C0C0C0">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:right;margin-bottom:32px">
        <p style="color:#C0C0C0">Subtotal: <strong style="color:#fff">${fmt(estimate.subtotal_cents)}</strong></p>
        <p style="color:#C0C0C0">Tax: <strong style="color:#fff">${fmt(estimate.tax_cents)}</strong></p>
        <p style="font-size:20px">Total: <strong style="color:#FF6600">${fmt(estimate.total_cents)}</strong></p>
      </div>
      ${estimate.customer_note ? `<div style="background:#2D2D2D;padding:16px;border-radius:8px;margin-bottom:32px"><p style="margin:0;color:#C0C0C0">Notes</p><p style="margin:8px 0 0">${estimate.customer_note}</p></div>` : ''}
      <div style="text-align:center;background:#FF6600;border-radius:12px;padding:32px">
        <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 16px">Ready to move forward?</p>
        <a href="${link.url}" style="display:inline-block;background:#fff;color:#FF6600;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">Accept &amp; Pay Online</a>
      </div>
    </body></html>`;

    await resend.emails.send({
      from:    `${org.name} <estimates@mail.tradesuite.com>`,
      to:      [customer.email],
      subject: `Your estimate from ${org.name} — ${estimate.estimate_number}`,
      html,
    });

    await supabase.from('estimates').update({
      status:   'sent',
      sent_at:  new Date().toISOString(),
      sent_via: 'email',
      pdf_url:  link.url,   // reusing field for payment link URL
    }).eq('id', estimate_id);

    return new Response(JSON.stringify({ payment_link_url: link.url }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('omnibid-send-estimate error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

Deploy:
```bash
supabase functions deploy omnibid-voice-parse
supabase functions deploy omnibid-send-estimate
```

---

## TASK 5 — OmniBid Inngest watcher

Create `inngest/functions/omnibid-estimate-watcher.ts`:

```typescript
import { inngest }      from '../client';
import { createClient } from '@supabase/supabase-js';
import { Resend }       from 'resend';
import Anthropic        from '@anthropic-ai/sdk';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const resend    = new Resend(process.env.RESEND_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const omnibidEstimateWatcher = inngest.createFunction(
  { id: 'omnibid-estimate-watcher', name: 'OmniBid: Estimate Watcher', retries: 3 },
  { event: 'omnibid/estimate.sent' },

  async ({ event, step }) => {
    const { estimate_id, org_id, customer_email, customer_name } = event.data;

    // Wait 48h for payment
    const paid = await step.waitForEvent('wait-for-payment', {
      event:   'omnibid/estimate.paid',
      match:   'data.estimate_id',
      timeout: '48h',
    });

    if (paid) {
      await step.run('mark-paid', async () => {
        getSupabase().from('estimates').update({
          status: 'paid', paid_at: new Date().toISOString(),
        }).eq('id', estimate_id);
      });
      return { status: 'paid' };
    }

    // Check if still actionable
    const { data: est } = await step.run('check-estimate', async () =>
      getSupabase().from('estimates')
        .select('status, estimate_number, total_cents, pdf_url, organizations(name)')
        .eq('id', estimate_id).single()
    );

    if (!est?.data || !['sent', 'viewed'].includes(est.data.status)) {
      return { status: 'already_actioned' };
    }

    const orgName = (est.data.organizations as any)?.name ?? 'us';
    const payUrl  = est.data.pdf_url ?? '';
    const total   = `$${(est.data.total_cents / 100).toFixed(2)}`;

    // Generate follow-up email with Claude
    await step.run('send-followup', async () => {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: `Write a 2-sentence follow-up email for ${orgName}. Friendly, not pushy. No emojis. Return only the body text.`,
        messages: [{ role: 'user', content: `Follow up on estimate ${est.data.estimate_number} (${total}). Not responded in 48h. Include: ${payUrl}${customer_name ? `. Customer: ${customer_name}` : ''}` }],
      });
      const body = (msg.content[0] as any).text?.trim() ?? '';

      await resend.emails.send({
        from:    `${orgName} <estimates@mail.tradesuite.com>`,
        to:      [customer_email],
        subject: `Following up — Estimate ${est.data.estimate_number}`,
        text:    `${body}\n\n— ${orgName}`,
      });
    });

    // Wait 5 more days
    const latePaid = await step.waitForEvent('wait-for-late-payment', {
      event:   'omnibid/estimate.paid',
      match:   'data.estimate_id',
      timeout: '120h',
    });

    if (latePaid) {
      await step.run('mark-paid-late', async () => {
        getSupabase().from('estimates').update({
          status: 'paid', paid_at: new Date().toISOString(),
        }).eq('id', estimate_id);
      });
      return { status: 'paid_late' };
    }

    return { status: 'no_response' };
  }
);
```

Register this function in the Inngest serve handler alongside `leadlockSequence`.

---

## TASK 6 — Update PowerSync sync rules

Open `packages/core-sync/sync-rules.yaml`. Verify that `leads`, `lead_sequences`, `lead_messages`, `price_book`, `estimates`, `estimate_line_items`, `invoices`, and `invoice_payments` are all in the data section. If any are missing, add them:

```yaml
# Add under the existing org_data bucket's data: section if not present:
- SELECT * FROM leads          WHERE org_id = bucket.org_id
- SELECT * FROM lead_sequences WHERE org_id = bucket.org_id
- SELECT * FROM lead_messages  WHERE org_id = bucket.org_id AND sent_at > now() - interval '90 days'
- SELECT * FROM price_book     WHERE org_id = bucket.org_id AND active = true
- SELECT * FROM estimates      WHERE org_id = bucket.org_id
- SELECT * FROM estimate_line_items WHERE org_id = bucket.org_id
- SELECT * FROM invoices       WHERE org_id = bucket.org_id
- SELECT * FROM invoice_payments WHERE org_id = bucket.org_id
```

---

## TASK 7 — Build RepuGuard module (`modules/reviews/`)

RepuGuard sends review request SMS/email after a job is marked complete, then tracks whether the customer left a review.

### DB Migration — `supabase/migrations/20260515_repuguard.sql`

```sql
CREATE TABLE IF NOT EXISTS public.review_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id          uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'sent' | 'clicked' | 'reviewed' | 'failed'
  sent_via        text,         -- 'sms' | 'email'
  platform        text,         -- 'google' | 'yelp' | 'facebook' — where they were directed
  review_url      text,         -- the platform link clicked
  sent_at         timestamptz,
  clicked_at      timestamptz,
  reviewed_at     timestamptz,  -- set when platform webhook confirms (or manual)
  star_rating     int,          -- 1-5, set from platform webhook if available
  review_text     text,         -- scraped or webhook-provided review content
  inngest_run_id  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER review_requests_updated_at
  BEFORE UPDATE ON public.review_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ON public.review_requests (org_id, status, created_at DESC);
CREATE INDEX ON public.review_requests (customer_id);

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_requests_org"     ON public.review_requests
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "review_requests_service" ON public.review_requests
  TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.review_requests;

-- Add review_request tables to organizations: review platform links
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS google_review_url   text,
  ADD COLUMN IF NOT EXISTS yelp_review_url     text,
  ADD COLUMN IF NOT EXISTS facebook_review_url text,
  ADD COLUMN IF NOT EXISTS review_delay_hours  int NOT NULL DEFAULT 24;
  -- how long after job completion to send the review request
```

### Add to `packages/core-sync/src/schema.ts`

Add `review_requests` table to AppSchema:
```typescript
const review_requests = new Table(
  {
    org_id:      column.text,
    job_id:      column.text,
    customer_id: column.text,
    status:      column.text,
    sent_via:    column.text,
    platform:    column.text,
    review_url:  column.text,
    sent_at:     column.text,
    clicked_at:  column.text,
    reviewed_at: column.text,
    star_rating: column.integer,
    created_at:  column.text,
    updated_at:  column.text,
  },
  { indexes: { by_status: ['status', 'created_at'] } }
);
// Add to AppSchema: review_requests,
```

Also add to `packages/core-sync/sync-rules.yaml`:
```yaml
- SELECT * FROM review_requests WHERE org_id = bucket.org_id
```

### `modules/reviews/src/types.ts`

```typescript
export type ReviewRequestStatus = 'pending' | 'sent' | 'clicked' | 'reviewed' | 'failed';
export type ReviewPlatform = 'google' | 'yelp' | 'facebook';

export interface ReviewRequest {
  id: string;
  org_id: string;
  job_id: string | null;
  customer_id: string;
  status: ReviewRequestStatus;
  sent_via: string | null;
  platform: ReviewPlatform | null;
  review_url: string | null;
  sent_at: string | null;
  clicked_at: string | null;
  reviewed_at: string | null;
  star_rating: number | null;
  review_text: string | null;
  inngest_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewStats {
  total_sent: number;
  total_clicked: number;
  total_reviewed: number;
  avg_rating: number;
  click_rate: number;    // percentage
  review_rate: number;   // percentage
}
```

### `modules/reviews/src/hooks/useReviews.ts`

```typescript
import { useQuery } from '@powersync/react';
import { useCallback } from 'react';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { ReviewRequest, ReviewStats } from '../types';

const supabase = getSupabaseClient();

export function useReviewRequests() {
  return useQuery<ReviewRequest>(
    'SELECT * FROM review_requests ORDER BY created_at DESC'
  );
}

export function useReviewStats() {
  const { data } = useQuery<ReviewStats>(`
    SELECT
      COUNT(*)                                              AS total_sent,
      COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)   AS total_clicked,
      COUNT(CASE WHEN reviewed_at IS NOT NULL THEN 1 END)  AS total_reviewed,
      COALESCE(AVG(CASE WHEN star_rating IS NOT NULL THEN star_rating END), 0) AS avg_rating,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1)
        ELSE 0 END AS click_rate,
      CASE WHEN COUNT(*) > 0
        THEN ROUND(COUNT(CASE WHEN reviewed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1)
        ELSE 0 END AS review_rate
    FROM review_requests WHERE status != 'failed'
  `);
  return data?.[0] ?? { total_sent: 0, total_clicked: 0, total_reviewed: 0, avg_rating: 0, click_rate: 0, review_rate: 0 };
}

export function useReviewActions() {
  const sendRequest = useCallback(async (jobId: string, customerId: string, orgId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/repuguard-send-request`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_id: jobId, customer_id: customerId, org_id: orgId }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  return { sendRequest };
}
```

### `modules/reviews/src/pages/ReviewsPage.tsx`

```tsx
import { useReviewRequests, useReviewStats } from '../hooks/useReviews';
import type { ReviewRequest } from '../types';
import { formatDistanceToNow } from 'date-fns';

const STATUS_STYLE: Record<string, { text: string; label: string }> = {
  pending:  { text: 'text-content-muted',  label: 'Pending'  },
  sent:     { text: 'text-info',           label: 'Sent'     },
  clicked:  { text: 'text-warning',        label: 'Clicked'  },
  reviewed: { text: 'text-success',        label: 'Reviewed' },
  failed:   { text: 'text-danger',         label: 'Failed'   },
};

export function ReviewsPage() {
  const { data: requests, isLoading } = useReviewRequests();
  const stats = useReviewStats();

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-4 pt-6 pb-4 border-b border-surface-border">
        <h1 className="text-field-2xl font-extrabold text-content tracking-tight">RepuGuard</h1>
        <p className="text-field-xs text-content-secondary mt-0.5 mb-4">Review &amp; reputation autopilot</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <StatCard label="Sent"     value={stats.total_sent} />
          <StatCard label="Reviewed" value={stats.total_reviewed} />
          <StatCard label="Avg ★"   value={stats.avg_rating > 0 ? stats.avg_rating.toFixed(1) : '—'} highlight />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-raised rounded-card p-2 text-center">
            <p className="text-money-base font-bold text-content">{stats.click_rate}%</p>
            <p className="text-[10px] text-content-muted">Click rate</p>
          </div>
          <div className="bg-surface-raised rounded-card p-2 text-center">
            <p className="text-money-base font-bold text-content">{stats.review_rate}%</p>
            <p className="text-[10px] text-content-muted">Review rate</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
            <p className="text-field-sm font-bold text-content-secondary">No review requests yet</p>
            <p className="text-field-xs text-content-muted mt-1">
              Review requests are sent automatically when a job is marked complete
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {requests.map((r: ReviewRequest) => {
              const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
              return (
                <div key={r.id}
                  className="bg-surface-raised border border-surface-border rounded-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-field-sm font-semibold text-content capitalize">
                        {r.platform ?? 'Review'} Request
                      </p>
                      <p className="text-field-xs text-content-muted mt-0.5">
                        {r.sent_at
                          ? formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })
                          : formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-field-xs font-bold ${style.text}`}>{style.label}</p>
                      {r.star_rating && (
                        <p className="text-field-xs text-warning mt-0.5">{'★'.repeat(r.star_rating)}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-surface-raised rounded-card p-3 text-center">
      <p className={`text-money-base font-bold ${highlight ? 'text-brand' : 'text-content'}`}>{value}</p>
      <p className="text-[10px] text-content-muted mt-0.5">{label}</p>
    </div>
  );
}
```

### `modules/reviews/src/index.ts`

```typescript
export * from './types';
export * from './hooks/useReviews';
export { ReviewsPage } from './pages/ReviewsPage';
```

### Update `apps/pwa/src/pages/ReviewsPage.tsx`

```typescript
export { ReviewsPage as default } from '@trades-saas/reviews';
```

### `supabase/functions/repuguard-send-request/index.ts`

```typescript
import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic        from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const supabase   = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const anthropic  = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

async function generateSms(orgName: string, trade: string, customerFirstName: string | null, platform: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 160,
    system: `Write a short SMS asking a customer to leave a review. Under 140 chars. Warm, not pushy. No emojis. GSM-7 only. Return only the SMS text.`,
    messages: [{ role: 'user', content: `${orgName} (${trade}) completed work${customerFirstName ? ` for ${customerFirstName}` : ''}. Ask for a ${platform} review. Include {LINK} as a placeholder for the review URL.` }],
  });
  return (msg.content[0] as any).text?.trim() ?? `Thanks for choosing ${orgName}! We'd love your review: {LINK}`;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { job_id, customer_id, org_id } = await req.json() as { job_id: string; customer_id: string; org_id: string };

  const [orgRes, customerRes] = await Promise.all([
    supabase.from('organizations').select('name, trade_types, telnyx_number, google_review_url, yelp_review_url').eq('id', org_id).single(),
    supabase.from('customers').select('id, first_name, phone, email').eq('id', customer_id).single(),
  ]);

  const org      = orgRes.data;
  const customer = customerRes.data;

  if (!org || !customer) return new Response('Not found', { status: 404 });

  // Pick best available platform
  const platform   = org.google_review_url ? 'google' : org.yelp_review_url ? 'yelp' : 'google';
  const reviewUrl  = org.google_review_url ?? org.yelp_review_url ?? '';
  const trade      = org.trade_types?.[0] ?? 'home services';

  // Create the review_request record
  const { data: request } = await supabase.from('review_requests').insert({
    org_id, job_id: job_id || null, customer_id,
    platform, review_url: reviewUrl,
  }).select().single();

  if (!request) return new Response('Failed to create request', { status: 500 });

  // Send SMS if customer has phone and org has telnyx_number
  if (customer.phone && org.telnyx_number) {
    const template = await generateSms(org.name, trade, customer.first_name, platform);
    const smsBody  = template.replace('{LINK}', reviewUrl);

    await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('TELNYX_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: org.telnyx_number, to: customer.phone, text: smsBody }),
    });

    await supabase.from('review_requests').update({
      status: 'sent', sent_via: 'sms', sent_at: new Date().toISOString(),
    }).eq('id', request.id);
  }

  return new Response(JSON.stringify({ id: request.id }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Deploy:
```bash
supabase functions deploy repuguard-send-request
```

### `inngest/functions/repuguard-sequence.ts`

```typescript
import { inngest }      from '../client';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Triggered by a job_events row with event_type = 'job_completed'
// The serve endpoint must also listen for this event (add to inngest serve handler)
export const repuguardSequence = inngest.createFunction(
  { id: 'repuguard-review-sequence', name: 'RepuGuard: Review Request Sequence', retries: 3 },
  { event: 'repuguard/job.completed' },

  async ({ event, step }) => {
    const { job_id, customer_id, org_id, delay_hours } = event.data;
    const supabase = getSupabase();

    // Check org has review platform configured
    const { data: org } = await step.run('check-org-config', async () =>
      supabase.from('organizations')
        .select('google_review_url, yelp_review_url, telnyx_number, review_delay_hours')
        .eq('id', org_id).single()
    );

    if (!org?.data?.google_review_url && !org?.data?.yelp_review_url) {
      return { status: 'skipped', reason: 'No review platform configured' };
    }

    // Wait for configured delay (default 24h)
    const waitHours = delay_hours ?? org.data.review_delay_hours ?? 24;
    await step.sleep('wait-before-sending', `${waitHours}h`);

    // Send review request via Edge Function
    await step.run('send-review-request', async () => {
      await fetch(`${process.env.SUPABASE_URL}/functions/v1/repuguard-send-request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'x-supabase-service-role': 'true',
        },
        body: JSON.stringify({ job_id, customer_id, org_id }),
      });
    });

    return { status: 'sent' };
  }
);
```

---

## TASK 8 — Register all Inngest functions

Find the Inngest serve handler (likely `apps/pwa/src/pages/api/inngest.ts` or a standalone server file). Make sure all three functions are registered:

```typescript
import { serve }                   from 'inngest/next'; // or inngest/express, etc.
import { inngest }                 from '../../../inngest/client';
import { leadlockSequence }        from '../../../inngest/functions/leadlock-sequence';
import { omnibidEstimateWatcher }  from '../../../inngest/functions/omnibid-estimate-watcher';
import { repuguardSequence }       from '../../../inngest/functions/repuguard-sequence';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    leadlockSequence,
    omnibidEstimateWatcher,
    repuguardSequence,
  ],
});
```

If no serve handler exists yet, create one appropriate for the project setup (Vite doesn't have API routes — this may need to be a standalone Express/Hono server or a separate Vercel/Railway deployment).

---

## TASK 9 — Add `org_members` table reference check

The RLS policies in the migrations reference `public.org_members`. Verify this table exists in `packages/core-db/supabase/migrations/0001_core_schema.sql`. If the table is named differently (e.g., `organization_members`, `memberships`), update the RLS policies in the LeadLock and OmniBid migrations to use the correct table name.

---

## TASK 10 — Final checks

```bash
# Clean install
pnpm install

# Type-check everything
pnpm turbo typecheck

# Fix all errors — do not leave any unresolved

# Verify these files exist and are non-empty:
ls -la supabase/functions/stripe-portal/index.ts
ls -la supabase/functions/stripe-webhook/index.ts
ls -la supabase/functions/omnibid-voice-parse/index.ts
ls -la supabase/functions/omnibid-send-estimate/index.ts
ls -la supabase/functions/repuguard-send-request/index.ts
ls -la inngest/functions/omnibid-estimate-watcher.ts
ls -la inngest/functions/repuguard-sequence.ts
ls -la modules/estimates/src/hooks/useEstimates.ts
ls -la modules/estimates/src/components/VoiceButton.tsx
ls -la modules/estimates/src/components/LineItemRow.tsx
ls -la modules/reviews/src/types.ts
ls -la modules/reviews/src/hooks/useReviews.ts
ls -la modules/reviews/src/pages/ReviewsPage.tsx
ls -la supabase/migrations/20260515_repuguard.sql

# Verify theme — must print FF6600:
grep -r "FF6600" packages/core-ui/src/tokens/index.ts
grep -r "color-scheme: dark" apps/pwa/src/styles.css
grep -r "Inter" apps/pwa/index.html
```
