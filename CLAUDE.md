# CLAUDE.md — TradeSuite
> This is an execution file. Read it top to bottom, then work through every task
> in order without stopping unless you hit a blocker that requires a decision.
> Do not ask for confirmation on individual steps — just do them.

---

## THE STACK (read before anything else)

- **Framework:** Vite + React 18 — NOT Next.js
- **Package manager:** pnpm workspaces — never npm or yarn
- **Monorepo:** Turborepo
- **Local DB:** PowerSync + SQLite WASM
- **Cloud DB:** Supabase (Postgres + Auth + Edge Functions)
- **Orchestration:** Inngest
- **SMS:** Telnyx
- **Payments:** Stripe
- **Email:** Resend
- **AI:** Claude Sonnet 4 (`claude-sonnet-4-20250514`), Gemini Flash, Llama 4 Scout
- **Package prefix:** `@trades-saas/` — never `@acme/` or anything else
- **Modules directory:** `modules/` — not `packages/`

---

# TASK LIST — EXECUTE IN ORDER

---

## TASK 1 — Verify repo structure is correct

Check that these paths exist. If any are missing, create them as empty stubs:

```
apps/pwa/src/pages/LeadsPage.tsx
apps/pwa/src/pages/EstimatesPage.tsx
apps/pwa/src/pages/ReviewsPage.tsx
modules/leads/package.json
modules/estimates/package.json
modules/reviews/package.json
packages/core-ui/src/tokens/index.ts
packages/core-ui/tailwind.config.ts
packages/core-sync/src/schema.ts
packages/core-sync/src/queries.ts
packages/core-sync/sync-rules.yaml
supabase/migrations/
supabase/functions/
inngest/
```

---

## TASK 2 — Switch font to Inter everywhere

### 2a. `apps/pwa/index.html`
Replace whatever font link tags exist with:
```html
<!-- Font: Inter -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
```
Also set `<meta name="theme-color" content="#FF6600" />`.

### 2b. `packages/core-ui/src/tokens/index.ts`
Replace the entire file:

```typescript
// =============================================================================
// TRADESUITE DESIGN TOKENS
// Theme: Safety Orange / Dark (Industrial Precision)
// Brand: Safety Orange (#FF6600) on Deep Tread dark (#1A1A1A)
// Secondary: Utility Silver (#C0C0C0)
// Font: Inter
// =============================================================================

export const BRAND = {
  darkest:  '#cc4400',
  dark:     '#FF6600',   // Safety Orange — primary brand
  mid:      '#e65c00',   // hover states
  light:    '#ff8533',   // active/selected
  pale:     '#fff0e6',   // light tint
} as const;

export const ACCENT = {
  DEFAULT: '#C0C0C0',   // Utility Silver
  light:   '#d9d9d9',
  dark:    '#9a9a9a',
} as const;

export const SURFACE = {
  DEFAULT:  '#1A1A1A',   // Deep Tread — base background
  raised:   '#2D2D2D',   // Charcoal Gray — cards, modals
  sunken:   '#141414',   // inputs, code blocks
  border:   '#3d3d3d',   // dividers, borders
} as const;

export const TEXT = {
  DEFAULT:   '#FFFFFF',   // Clean White — primary text
  secondary: '#C0C0C0',   // Utility Silver — labels, metadata
  muted:     '#6b6b6b',   // placeholders, timestamps
  inverse:   '#1A1A1A',   // text on orange backgrounds
} as const;

export const SEMANTIC = {
  danger:   '#f87171',   // red-400
  warning:  '#fbbf24',   // amber-400
  success:  '#34d399',   // emerald-400
  info:     '#60a5fa',   // blue-400
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

export const FONT_IMPORTS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
] as const;

export const TOUCH_TARGET       = '48px';
export const BOTTOM_NAV_HEIGHT  = '64px';
export const PAGE_HEADER_HEIGHT = '56px';

export const SHADOWS = {
  card:   '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  raised: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)',
  modal:  '0 20px 60px rgba(0,0,0,0.7)',
  orange: '0 4px 14px rgba(255,102,0,0.35)',
} as const;

export const CSS_VARS = `
  :root {
    --brand:             ${BRAND.dark};
    --brand-mid:         ${BRAND.mid};
    --brand-pale:        ${BRAND.pale};
    --accent:            ${ACCENT.DEFAULT};
    --surface:           ${SURFACE.DEFAULT};
    --surface-raised:    ${SURFACE.raised};
    --surface-sunken:    ${SURFACE.sunken};
    --surface-border:    ${SURFACE.border};
    --text:              ${TEXT.DEFAULT};
    --text-secondary:    ${TEXT.secondary};
    --text-muted:        ${TEXT.muted};
    --font-display:      ${FONTS.display};
    --font-mono:         ${FONTS.mono};
    --bottom-nav-height: ${BOTTOM_NAV_HEIGHT};
    --page-header-height: ${PAGE_HEADER_HEIGHT};
  }
`;
```

### 2c. `apps/pwa/src/styles.css`
Replace entire file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand:             #FF6600;
  --brand-mid:         #e65c00;
  --brand-pale:        #fff0e6;
  --accent:            #C0C0C0;
  --surface:           #1A1A1A;
  --surface-raised:    #2D2D2D;
  --surface-sunken:    #141414;
  --surface-border:    #3d3d3d;
  --text:              #FFFFFF;
  --text-secondary:    #C0C0C0;
  --text-muted:        #6b6b6b;
  --font-display:      'Inter', system-ui, sans-serif;
  --font-mono:         'Inter', system-ui, sans-serif;
  --bottom-nav-height: 64px;
  --page-header-height: 56px;
}

*, *::before, *::after { box-sizing: border-box; }

html {
  overscroll-behavior: none;
  height: -webkit-fill-available;
  color-scheme: dark;
}

body {
  margin: 0;
  font-family: var(--font-display);
  background-color: var(--surface);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
  overscroll-behavior: none;
  min-height: 100dvh;
}

#root { min-height: 100dvh; display: flex; flex-direction: column; }

.font-mono, [class*="money-"] {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

button, a, [role="button"] { touch-action: manipulation; }
button { background: none; border: none; padding: 0; font: inherit; cursor: pointer; }

.safe-top    { padding-top:    env(safe-area-inset-top, 0px); }
.safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }

.scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }

::-webkit-scrollbar       { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: #1A1A1A; }
::-webkit-scrollbar-thumb { background: #3d3d3d; border-radius: 2px; }

input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px #2D2D2D inset;
  -webkit-text-fill-color: #FFFFFF;
  caret-color: #FFFFFF;
}

.page-enter { opacity: 0; transform: translateY(4px); }
.page-enter-active {
  opacity: 1; transform: translateY(0);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}
```

### 2d. `apps/pwa/vite.config.ts`
Update only the manifest colors inside VitePWA:
```typescript
theme_color:      '#FF6600',
background_color: '#1A1A1A',
```

### 2e. `packages/core-ui/tailwind.config.ts`
In the `extend` block, update `fontFamily`:
```typescript
fontFamily: {
  display: ['"Inter"', 'system-ui', 'sans-serif'],
  sans:    ['"Inter"', 'system-ui', 'sans-serif'],
  mono:    ['"Inter"', 'system-ui', 'sans-serif'],
},
```

---

## TASK 3 — Install all required dependencies

```bash
# PWA app
pnpm --filter @trades-saas/pwa add date-fns @powersync/react

# modules/leads
pnpm --filter @trades-saas/leads add \
  @trades-saas/core-types @trades-saas/core-auth \
  @trades-saas/core-sync @trades-saas/core-ui date-fns

# modules/estimates
pnpm --filter @trades-saas/estimates add \
  @trades-saas/core-types @trades-saas/core-auth \
  @trades-saas/core-sync @trades-saas/core-ui date-fns

# modules/reviews
pnpm --filter @trades-saas/reviews add \
  @trades-saas/core-types @trades-saas/core-auth \
  @trades-saas/core-sync @trades-saas/core-ui

# Inngest + AI (workspace root for server-side use)
pnpm add -w inngest @anthropic-ai/sdk

# Verify clean install
pnpm install
```

---

## TASK 4 — Create Inngest client

`inngest/client.ts`:
```typescript
import { Inngest } from 'inngest';
export const inngest = new Inngest({ id: 'tradesuite', name: 'TradeSuite' });
```

---

## TASK 5 — Build LeadLock module (`modules/leads/`)

### package.json
```json
{
  "name": "@trades-saas/leads",
  "displayName": "LeadLock",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "scripts": { "type-check": "tsc --noEmit", "build": "echo stub" },
  "dependencies": {
    "@trades-saas/core-types": "workspace:*",
    "@trades-saas/core-auth":  "workspace:*",
    "@trades-saas/core-sync":  "workspace:*",
    "@trades-saas/core-ui":    "workspace:*",
    "date-fns": "^3.0.0"
  },
  "peerDependencies": { "react": "^18.0.0" }
}
```

### tsconfig.json
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src", "jsx": "react-jsx" },
  "include": ["src/**/*"]
}
```

### src/types.ts
```typescript
export type LeadStatus     = 'new' | 'contacted' | 'replied' | 'booked' | 'lost';
export type LeadSource     = 'missed_call' | 'web_form' | 'manual';
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type MessageDirection = 'outbound' | 'inbound';
export type MessageStatus  = 'queued' | 'sent' | 'delivered' | 'failed';

export interface Lead {
  id: string; org_id: string; phone: string; name: string | null;
  source: LeadSource; status: LeadStatus; call_sid: string | null;
  called_number: string | null; missed_at: string; replied_at: string | null;
  created_at: string; updated_at: string;
}

export interface LeadSequence {
  id: string; org_id: string; lead_id: string; status: SequenceStatus;
  current_step: number; inngest_run_id: string | null;
  created_at: string; updated_at: string;
}

export interface LeadMessage {
  id: string; org_id: string; lead_id: string; sequence_id: string | null;
  direction: MessageDirection; body: string; status: MessageStatus;
  telnyx_msg_id: string | null; sequence_step: number | null;
  sent_at: string; created_at: string;
}

export interface LeadWithContext extends Lead {
  seq_id: string | null; seq_status: SequenceStatus | null;
  seq_current_step: number | null; last_message_body: string | null;
  last_message_direction: MessageDirection | null; last_message_sent_at: string | null;
  message_count: number;
}

export const SEQUENCE_STEPS = [
  { step: 0, label: 'Immediate text-back',  delay_ms: 0 },
  { step: 1, label: '24-hour follow-up',    delay_ms: 86400000 },
  { step: 2, label: '48-hour final touch',  delay_ms: 172800000 },
] as const;
```

### src/schema.ts
```typescript
import { column, Table } from '@powersync/web';

export const leadsTable = new Table(
  {
    org_id: column.text, phone: column.text, name: column.text,
    source: column.text, status: column.text, call_sid: column.text,
    called_number: column.text, missed_at: column.text, replied_at: column.text,
    created_at: column.text, updated_at: column.text,
  },
  { indexes: { by_status: ['status', 'missed_at'] } }
);

export const leadSequencesTable = new Table({
  org_id: column.text, lead_id: column.text, status: column.text,
  current_step: column.integer, inngest_run_id: column.text,
  created_at: column.text, updated_at: column.text,
});

export const leadMessagesTable = new Table(
  {
    org_id: column.text, lead_id: column.text, sequence_id: column.text,
    direction: column.text, body: column.text, status: column.text,
    telnyx_msg_id: column.text, sequence_step: column.integer,
    sent_at: column.text, created_at: column.text,
  },
  { indexes: { by_lead: ['lead_id', 'sent_at'] } }
);
```

After creating `src/schema.ts`, open `packages/core-sync/src/schema.ts` and add `leads`, `lead_sequences`, `lead_messages` to the `AppSchema` export object using these table definitions.

### src/hooks/useLeads.ts
```typescript
import { useQuery } from '@powersync/react';
import { useCallback } from 'react';
import { getSupabaseClient } from '@trades-saas/core-auth';
import type { Lead, LeadMessage, LeadSequence, LeadStatus, LeadWithContext } from '../types';

const supabase = getSupabaseClient();

export function useLeads(filter?: LeadStatus) {
  const where = filter ? `WHERE l.status = '${filter}'` : '';
  return useQuery<LeadWithContext>(`
    SELECT l.*,
      s.id AS seq_id, s.status AS seq_status, s.current_step AS seq_current_step,
      m.body AS last_message_body, m.direction AS last_message_direction,
      m.sent_at AS last_message_sent_at,
      (SELECT COUNT(*) FROM lead_messages WHERE lead_id = l.id) AS message_count
    FROM leads l
    LEFT JOIN lead_sequences s ON s.lead_id = l.id
    LEFT JOIN lead_messages m ON m.id = (
      SELECT id FROM lead_messages WHERE lead_id = l.id ORDER BY sent_at DESC LIMIT 1
    )
    ${where}
    ORDER BY l.missed_at DESC
  `);
}

export function useLead(leadId: string) {
  return useQuery<Lead>('SELECT * FROM leads WHERE id = ? LIMIT 1', [leadId]);
}

export function useLeadSequence(leadId: string) {
  return useQuery<LeadSequence>('SELECT * FROM lead_sequences WHERE lead_id = ? LIMIT 1', [leadId]);
}

export function useLeadMessages(leadId: string) {
  return useQuery<LeadMessage>(
    'SELECT * FROM lead_messages WHERE lead_id = ? ORDER BY sent_at ASC', [leadId]
  );
}

export function useLeadStats() {
  const { data } = useQuery<{ total: number; new_today: number; replied: number; booked: number }>(`
    SELECT COUNT(*) AS total,
      COUNT(CASE WHEN date(missed_at) = date('now') THEN 1 END) AS new_today,
      COUNT(CASE WHEN status = 'replied' THEN 1 END) AS replied,
      COUNT(CASE WHEN status = 'booked'  THEN 1 END) AS booked
    FROM leads WHERE status != 'lost'
  `);
  return data?.[0] ?? { total: 0, new_today: 0, replied: 0, booked: 0 };
}

export function useLeadActions() {
  const updateStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
    if (error) throw error;
  }, []);

  const pauseSequence = useCallback(async (sequenceId: string) => {
    const { error } = await supabase.from('lead_sequences').update({ status: 'paused' }).eq('id', sequenceId);
    if (error) throw error;
  }, []);

  const resumeSequence = useCallback(async (sequenceId: string) => {
    const { error } = await supabase.from('lead_sequences').update({ status: 'active' }).eq('id', sequenceId);
    if (error) throw error;
  }, []);

  const sendManualReply = useCallback(async (
    leadId: string, orgId: string, toPhone: string, fromPhone: string, body: string
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/leadlock-send-sms`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, org_id: orgId, to: toPhone, from: fromPhone, body }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
  }, []);

  return { updateStatus, pauseSequence, resumeSequence, sendManualReply };
}
```

### src/components/LeadCard.tsx
```tsx
import { formatDistanceToNow } from 'date-fns';
import type { LeadWithContext } from '../types';

const STATUS_CONFIG = {
  new:       { label: 'New',       dot: 'bg-warning',        text: 'text-warning'        },
  contacted: { label: 'Contacted', dot: 'bg-brand',          text: 'text-brand'          },
  replied:   { label: 'Replied',   dot: 'bg-success',        text: 'text-success'        },
  booked:    { label: 'Booked',    dot: 'bg-success',        text: 'text-success'        },
  lost:      { label: 'Lost',      dot: 'bg-surface-border', text: 'text-content-muted'  },
} as const;

export function LeadCard({ lead, onClick }: { lead: LeadWithContext; onClick: (id: string) => void }) {
  const status = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new;
  const missedAgo = formatDistanceToNow(new Date(lead.missed_at), { addSuffix: true });
  const phone = lead.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');

  return (
    <button
      onClick={() => onClick(lead.id)}
      className="w-full text-left bg-surface-raised border border-surface-border rounded-card p-4
                 hover:border-content-muted active:scale-[0.99] transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-field-sm text-content truncate">{lead.name ?? phone}</p>
          {lead.name && <p className="font-mono text-field-xs text-content-secondary mt-0.5">{phone}</p>}
        </div>
        <span className={`flex items-center gap-1.5 text-field-xs font-semibold ${status.text} shrink-0`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${lead.status === 'new' ? 'animate-pulse' : ''}`} />
          {status.label}
        </span>
      </div>

      {lead.last_message_body && (
        <p className="mt-2 text-field-xs text-content-secondary line-clamp-1">
          {lead.last_message_direction === 'inbound' ? '← ' : '→ '}{lead.last_message_body}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-field-xs text-content-muted">{missedAgo}</span>
        <div className="flex items-center gap-3">
          {lead.message_count > 0 && (
            <span className="text-field-xs text-content-muted">
              {lead.message_count} msg{lead.message_count !== 1 ? 's' : ''}
            </span>
          )}
          {(lead.seq_status === 'active' || lead.seq_status === 'paused') && (
            <div className="flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i < (lead.seq_current_step ?? 0) ? 'bg-brand' :
                  i === (lead.seq_current_step ?? 0) ? 'bg-brand opacity-60 animate-pulse' :
                  'bg-surface-border'
                }`} />
              ))}
              {lead.seq_status === 'paused' && <span className="ml-1 text-field-xs text-warning">paused</span>}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
```

### src/components/SequenceTimeline.tsx
```tsx
import type { LeadSequence } from '../types';

const STEPS = [
  { step: 0, label: 'Immediate',     sublabel: 'Text sent on missed call' },
  { step: 1, label: '24h follow-up', sublabel: 'If no reply after 1 day'  },
  { step: 2, label: 'Final touch',   sublabel: 'If no reply after 3 days' },
];

export function SequenceTimeline({
  sequence, onPause, onResume,
}: { sequence: LeadSequence | null; onPause: () => void; onResume: () => void }) {
  if (!sequence) return (
    <div className="rounded-card border border-surface-border bg-surface-raised p-4">
      <p className="text-field-xs text-content-muted">No active sequence</p>
    </div>
  );

  const isActive = sequence.status === 'active';
  const isPaused = sequence.status === 'paused';
  const isDone   = sequence.status === 'completed' || sequence.status === 'cancelled';
  const step     = sequence.current_step;

  return (
    <div className="rounded-card border border-surface-border bg-surface-raised p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-field-xs font-bold text-content-secondary uppercase tracking-widest">
          Follow-up Sequence
        </h3>
        {(isActive || isPaused) && (
          <button
            onClick={isActive ? onPause : onResume}
            className={`text-field-xs font-bold px-2.5 py-1 rounded transition-colors ${
              isActive ? 'text-warning hover:bg-warning/10' : 'text-success hover:bg-success/10'
            }`}
          >
            {isActive ? 'Pause' : 'Resume'}
          </button>
        )}
        {isDone && <span className="text-field-xs text-content-muted capitalize">{sequence.status}</span>}
      </div>

      <div className="relative">
        <div className="absolute left-[9px] top-3 bottom-3 w-px bg-surface-border" />
        <div className="space-y-4">
          {STEPS.map(({ step: s, label, sublabel }) => {
            const sent    = s < step || isDone;
            const current = s === step && (isActive || isPaused);
            return (
              <div key={s} className="flex items-start gap-3 relative">
                <div className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                  sent ? 'bg-brand border-brand' : current ? 'bg-surface-raised border-brand' : 'bg-surface-raised border-surface-border'
                }`}>
                  {sent && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {current && <span className={`w-2 h-2 rounded-full bg-brand ${isActive ? 'animate-pulse' : ''}`} />}
                </div>
                <div>
                  <p className={`text-field-sm font-semibold ${sent ? 'text-content-secondary' : current ? 'text-content' : 'text-content-muted'}`}>
                    {label}
                  </p>
                  <p className="text-field-xs text-content-muted mt-0.5">{sublabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### src/components/MessageThread.tsx
```tsx
import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import type { LeadMessage } from '../types';

const STEP_LABELS: Record<number, string> = { 0: 'Auto — immediate', 1: 'Auto — 24h', 2: 'Auto — final' };

export function MessageThread({
  messages, leadPhone, onSend,
}: { messages: LeadMessage[]; leadPhone: string; onSend: (body: string) => Promise<void> }) {
  const [draft, setDraft]     = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function handleSend() {
    const t = draft.trim();
    if (!t || sending) return;
    setSending(true);
    try { await onSend(t); setDraft(''); } finally { setSending(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-field-xs text-content-muted text-center py-8">No messages yet</p>
        )}
        {messages.map(msg => {
          const out = msg.direction === 'outbound';
          return (
            <div key={msg.id} className={`flex flex-col ${out ? 'items-end' : 'items-start'}`}>
              {out && msg.sequence_step !== null && (
                <span className="text-[10px] text-content-muted mb-1 mr-1">
                  {STEP_LABELS[msg.sequence_step] ?? 'Auto'}
                </span>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                out ? 'bg-brand text-white rounded-br-sm' : 'bg-surface-raised text-content rounded-bl-sm'
              }`}>
                <p className="text-field-sm leading-snug whitespace-pre-wrap break-words">{msg.body}</p>
              </div>
              <span className="text-[10px] text-content-muted mt-1">
                {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-surface-border p-3 flex gap-2 items-end">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={`Reply to ${leadPhone}`}
          disabled={sending}
          rows={1}
          className="flex-1 bg-surface-sunken text-content text-field-sm rounded-xl px-3.5 py-2.5
                     resize-none outline-none border border-surface-border focus:border-brand
                     placeholder:text-content-muted disabled:opacity-50 min-h-[40px] max-h-[120px]"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="shrink-0 w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center
                     hover:bg-brand-mid active:scale-95 transition-all disabled:opacity-30"
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
          }
        </button>
      </div>
    </div>
  );
}
```

### src/pages/LeadsPage.tsx
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LeadCard } from '../components/LeadCard';
import { useLeads, useLeadStats } from '../hooks/useLeads';
import type { LeadStatus } from '../types';

type Filter = 'all' | LeadStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' }, { key: 'replied', label: 'Replied' },
  { key: 'booked', label: 'Booked' }, { key: 'lost', label: 'Lost' },
];

export function LeadsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: leads, isLoading } = useLeads(filter === 'all' ? undefined : filter);
  const stats = useLeadStats();

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="px-4 pt-6 pb-4 border-b border-surface-border">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-field-2xl font-extrabold text-content tracking-tight">LeadLock</h1>
            <p className="text-field-xs text-content-secondary mt-0.5">Missed-call follow-up</p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <p className="text-money-base font-bold text-warning">{stats.new_today}</p>
              <p className="text-[10px] text-content-muted">today</p>
            </div>
            <div>
              <p className="text-money-base font-bold text-success">{stats.replied}</p>
              <p className="text-[10px] text-content-muted">replied</p>
            </div>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {FILTERS.map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`shrink-0 text-field-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                filter === key ? 'bg-brand text-white' : 'text-content-secondary hover:text-content hover:bg-surface-raised'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
            <p className="text-field-sm font-bold text-content-secondary">
              {filter === 'all' ? 'No leads yet' : `No ${filter} leads`}
            </p>
            <p className="text-field-xs text-content-muted mt-1">
              {filter === 'all' ? 'Leads appear when you miss a call' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClick={() => navigate(`/leads/${lead.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### src/pages/LeadDetailPage.tsx
```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { SequenceTimeline } from '../components/SequenceTimeline';
import { MessageThread }    from '../components/MessageThread';
import { useLead, useLeadMessages, useLeadSequence, useLeadActions } from '../hooks/useLeads';

const STATUS_TEXT: Record<string, string> = {
  new: 'text-warning', contacted: 'text-brand',
  replied: 'text-success', booked: 'text-success', lost: 'text-content-muted',
};

function fmt(e164: string) { return e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3'); }

export function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate   = useNavigate();
  const { data: leads }     = useLead(leadId!);
  const { data: sequences } = useLeadSequence(leadId!);
  const { data: messages }  = useLeadMessages(leadId!);
  const { pauseSequence, resumeSequence, updateStatus, sendManualReply } = useLeadActions();

  const lead = leads?.[0] ?? null;
  const seq  = sequences?.[0] ?? null;

  if (!lead) return (
    <div className="flex items-center justify-center h-full bg-surface">
      <span className="w-6 h-6 border-2 border-surface-border border-t-brand rounded-full animate-spin" />
    </div>
  );

  async function handleSend(body: string) {
    if (!lead.called_number) throw new Error('No outbound number');
    await sendManualReply(lead.id, lead.org_id, lead.phone, lead.called_number, body);
    if (seq?.status === 'active') await pauseSequence(seq.id);
    if (lead.status === 'new' || lead.status === 'contacted') await updateStatus(lead.id, 'replied');
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <button onClick={() => navigate(-1)} className="text-content-secondary hover:text-content p-1 -ml-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-field-sm font-bold text-content truncate">{lead.name ?? fmt(lead.phone)}</p>
          {lead.name && <p className="text-field-xs text-content-secondary">{fmt(lead.phone)}</p>}
        </div>
        <span className={`text-field-xs font-bold capitalize ${STATUS_TEXT[lead.status] ?? 'text-content-secondary'}`}>
          {lead.status}
        </span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
        <div className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-surface-border overflow-y-auto">
          <div className="p-4 space-y-4">
            <div className="space-y-2 text-field-xs">
              <div className="flex justify-between">
                <span className="text-content-muted">Missed</span>
                <span className="text-content-secondary">{formatDistanceToNow(new Date(lead.missed_at), { addSuffix: true })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-muted">Source</span>
                <span className="text-content-secondary capitalize">{lead.source.replace('_', ' ')}</span>
              </div>
              {lead.replied_at && (
                <div className="flex justify-between">
                  <span className="text-content-muted">Replied</span>
                  <span className="text-success">{formatDistanceToNow(new Date(lead.replied_at), { addSuffix: true })}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-2">Mark as</p>
              <div className="flex flex-wrap gap-1.5">
                {(['replied', 'booked', 'lost'] as const).map(s => (
                  <button key={s} onClick={() => updateStatus(lead.id, s)} disabled={lead.status === s}
                    className={`text-field-xs font-bold px-2.5 py-1 rounded-full border transition-colors capitalize ${
                      lead.status === s ? 'border-brand text-brand cursor-default' :
                      'border-surface-border text-content-secondary hover:border-brand hover:text-brand'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <SequenceTimeline
              sequence={seq}
              onPause={() => seq && pauseSequence(seq.id)}
              onResume={() => seq && resumeSequence(seq.id)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <MessageThread messages={messages} leadPhone={fmt(lead.phone)} onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
```

### src/index.ts
```typescript
export * from './types';
export * from './hooks/useLeads';
export { LeadCard }         from './components/LeadCard';
export { SequenceTimeline } from './components/SequenceTimeline';
export { MessageThread }    from './components/MessageThread';
export { LeadsPage }        from './pages/LeadsPage';
export { LeadDetailPage }   from './pages/LeadDetailPage';
```

### Update `apps/pwa/src/pages/LeadsPage.tsx`
```typescript
export { LeadsPage as default } from '@trades-saas/leads';
```

### Add `/leads/:leadId` route to `apps/pwa/src/App.tsx`
Find the existing `/leads` route and add below it:
```tsx
const LeadDetailPage = lazy(() =>
  import('@trades-saas/leads').then(m => ({ default: m.LeadDetailPage }))
);
// In <Routes>:
<Route path="/leads/:leadId" element={<LeadDetailPage />} />
```

---

## TASK 6 — LeadLock migration

Create `supabase/migrations/20260514_leadlock.sql`:

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS telnyx_number    text,
  ADD COLUMN IF NOT EXISTS owner_first_name text,
  ADD COLUMN IF NOT EXISTS trade            text DEFAULT 'home services';

CREATE UNIQUE INDEX IF NOT EXISTS orgs_telnyx_number_unique
  ON public.organizations (telnyx_number) WHERE telnyx_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone         text NOT NULL,
  name          text,
  source        text NOT NULL DEFAULT 'missed_call',
  status        text NOT NULL DEFAULT 'new',
  call_sid      text,
  called_number text,
  missed_at     timestamptz NOT NULL DEFAULT now(),
  replied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_sequences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id        uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'active',
  current_step   int  NOT NULL DEFAULT 0,
  inngest_run_id text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE TABLE IF NOT EXISTS public.lead_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id   uuid REFERENCES public.lead_sequences(id),
  direction     text NOT NULL,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'sent',
  telnyx_msg_id text,
  sequence_step int,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER lead_sequences_updated_at
  BEFORE UPDATE ON public.lead_sequences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX ON public.leads         (org_id, status, missed_at DESC);
CREATE INDEX ON public.lead_messages (lead_id, sent_at DESC);

ALTER TABLE public.leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_messages  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_org"          ON public.leads
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "lead_sequences_org" ON public.lead_sequences
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "lead_messages_org"  ON public.lead_messages
  USING (org_id = (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "leads_service"          ON public.leads          TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_sequences_service" ON public.lead_sequences TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_messages_service"  ON public.lead_messages  TO service_role USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_messages;
```

---

## TASK 7 — LeadLock Edge Function

Create `supabase/functions/telnyx-webhook/index.ts`.

Implementation requirements:
- Deno runtime — all imports from `https://esm.sh/` or `https://deno.land/`
- Verify Ed25519 signature using `telnyx-signature-ed25519` and `telnyx-timestamp` headers against `TELNYX_PUBLIC_KEY` env var
- Handle `call.hangup`: upsert lead on `(org_id, phone)` conflict, upsert `lead_sequences`, send `leadlock/lead.created` Inngest event
- Handle `message.received`: insert `lead_messages` row, update lead status to `replied`, update sequence status to `cancelled`, send `leadlock/lead.replied` Inngest event
- Resolve `org_id` by looking up `telnyx_number` on `organizations` table
- Always return HTTP 200 for recognized events

---

## TASK 8 — LeadLock Inngest sequence

Create `inngest/functions/leadlock-sequence.ts`.

Implementation requirements:
- Triggered by `leadlock/lead.created`
- Import `inngest` from `../../inngest/client`
- Step 0: Call Claude Sonnet (`claude-sonnet-4-20250514`) to generate SMS under 160 chars, no emojis, GSM-7 only. Send via Telnyx REST API (`POST https://api.telnyx.com/v2/messages`). Insert into `lead_messages`. Update lead status to `contacted`.
- `step.waitForEvent('leadlock/lead.replied', { match: 'data.lead_id', timeout: '24h' })` — if received, mark sequence `completed` and return
- Step 1: Check sequence status (may have been paused/cancelled). If still `active`, generate + send 24h follow-up
- `step.waitForEvent` with `timeout: '48h'` — if received, mark completed and return
- Step 2: Check sequence status. If still `active`, generate + send final touch, mark lead `lost` (only if status is still `contacted`), mark sequence `completed`

Claude system prompt for SMS generation: contractor's trade, business name, and `owner_first_name` come from the `organizations` table. Messages must be warm and specific to the missed call, not generic.

---

## TASK 9 — Add LeadLock to PowerSync sync rules

Open `packages/core-sync/sync-rules.yaml` and add to the existing org data bucket's `data:` section:

```yaml
- SELECT * FROM leads          WHERE org_id = bucket.org_id
- SELECT * FROM lead_sequences WHERE org_id = bucket.org_id
- SELECT * FROM lead_messages
  WHERE org_id = bucket.org_id
    AND sent_at > now() - interval '90 days'
```

---

## TASK 10 — OmniBid module (`modules/estimates/`)

Check `packages/core-sync/src/schema.ts` first — `estimates`, `estimate_line_items`, `invoices`, `invoice_payments` may already exist. Do not recreate them.

Build the module following the same pattern as LeadLock:
- `package.json` — name: `@trades-saas/estimates`, displayName: `OmniBid`
- `src/types.ts` — monetary values in cents (`_cents` suffix)
- `src/hooks/useEstimates.ts` — `useEstimates`, `useEstimate`, `useEstimateItems`, `usePriceBook`, `useEstimateStats`, `useEstimateActions`
- `src/components/PriceBookPicker.tsx` — full-screen modal, search, grouped by category
- `src/components/VoiceButton.tsx` — hold to record via MediaRecorder, release to send to Edge Function
- `src/components/LineItemRow.tsx` — editable when draft, read-only otherwise
- `src/pages/EstimatesPage.tsx` — list with filter tabs, stats row, new button
- `src/pages/EstimateDetailPage.tsx` — voice button, line items, price book picker, totals, send button

Create `supabase/migrations/20260514_omnibid_pricebook.sql` for the `price_book` table (if not already in schema).

Create `supabase/functions/omnibid-voice-parse/index.ts`:
- Accepts multipart: `audio` blob + `org_id`
- Gemini Flash transcription → Claude Sonnet structuring → return JSON

Create `supabase/functions/omnibid-send-estimate/index.ts`:
- Fetch estimate + items + customer + org
- Create Stripe Payment Link
- Build HTML email, send via Resend
- Update estimate status, fire `omnibid/estimate.sent` Inngest event

Create `inngest/functions/omnibid-estimate-watcher.ts`:
- Wait 48h for `omnibid/estimate.paid`, if not received send follow-up email

Update `apps/pwa/src/pages/EstimatesPage.tsx`:
```typescript
export { EstimatesPage as default } from '@trades-saas/estimates';
```

---

## TASK 11 — RepuGuard stub (`modules/reviews/`)

Update `modules/reviews/package.json` — name: `@trades-saas/reviews`, displayName: `RepuGuard`.

Create `modules/reviews/src/index.ts`:
```typescript
export function ReviewsPage() { return null; }
```

Update `apps/pwa/src/pages/ReviewsPage.tsx`:
```typescript
export { ReviewsPage as default } from '@trades-saas/reviews';
```

---

## TASK 12 — Final checks

```bash
pnpm install
pnpm turbo typecheck
```

Fix all type errors. Then confirm these files exist and are non-empty:
- `modules/leads/src/pages/LeadsPage.tsx`
- `modules/leads/src/pages/LeadDetailPage.tsx`
- `modules/estimates/src/pages/EstimatesPage.tsx`
- `modules/estimates/src/pages/EstimateDetailPage.tsx`
- `supabase/migrations/20260514_leadlock.sql`
- `supabase/functions/telnyx-webhook/index.ts`
- `supabase/functions/omnibid-voice-parse/index.ts`
- `supabase/functions/omnibid-send-estimate/index.ts`
- `inngest/client.ts`
- `inngest/functions/leadlock-sequence.ts`
- `inngest/functions/omnibid-estimate-watcher.ts`
- `packages/core-ui/src/tokens/index.ts` — must contain `#FF6600` and `#1A1A1A`
- `apps/pwa/src/styles.css` — must contain `color-scheme: dark`
- `apps/pwa/index.html` — must contain `Inter` and `#FF6600`

---

## HARD RULES

- `@trades-saas/` prefix only — never `@acme/`
- Vite + React only — no Next.js patterns
- Font: Inter only — no Sora, no DM Mono
- Colors: Tailwind token classes only (`bg-brand`, `bg-surface`, `text-content`) — no hex in components
- Reads: PowerSync `useQuery` — never `supabase.from().select()` in components
- Money: cents in DB, dollars in display
- `set_updated_at()` already exists — never redefine it
- Edge Functions: Deno — `https://esm.sh/` imports only
- Touch targets: 48px minimum (`h-touch`)
