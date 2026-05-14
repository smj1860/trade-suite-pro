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
