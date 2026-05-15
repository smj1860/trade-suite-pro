// Required env vars:
//   INNGEST_SIGNING_KEY       — from Inngest dashboard (verifies webhook signatures)
//   INNGEST_EVENT_KEY         — from Inngest dashboard (used to send events)
//   SUPABASE_URL              — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service role secret
//   TELNYX_API_KEY            — Telnyx API key for SMS
//   ANTHROPIC_API_KEY         — Claude API key for AI-generated messages
//   RESEND_API_KEY            — Resend API key for follow-up emails
//   PORT                      — (optional) HTTP port, defaults to 3001
import { serve } from 'inngest/express';
import express   from 'express';
import { inngest }                from './client';
import { leadlockSequence }       from './functions/leadlock-sequence';
import { omnibidEstimateWatcher } from './functions/omnibid-estimate-watcher';
import { repuguardSequence }      from './functions/repuguard-sequence';

const app = express();

app.use(
  '/api/inngest',
  serve({
    client:    inngest,
    functions: [
      leadlockSequence,
      omnibidEstimateWatcher,
      repuguardSequence,
    ],
  })
);

const port = process.env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`Inngest serve handler listening on port ${port}`);
});
