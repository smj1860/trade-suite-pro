import {
  AbstractPowerSyncDatabase,
  BaseObserver,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/web';
import { getSupabaseClient } from '@trades-saas/core-auth';

// =============================================================================
// SUPABASE → POWERSYNC CONNECTOR
//
// PowerSync needs two things from the connector:
//   1. fetchCredentials() — returns the PowerSync endpoint URL + a JWT
//      PowerSync uses the JWT to determine which sync buckets the user gets.
//      We use the Supabase session token directly (it contains our custom
//      claims added by auth.custom_access_token_hook).
//
//   2. uploadData() — called when the app writes to local SQLite while offline.
//      We write those changes to Supabase when connectivity is restored.
//      Most writes go directly to Supabase (online), so this handles the
//      offline-queued writes only.
// =============================================================================

function getPowerSyncUrl(): string {
  const url = ((import.meta as any).env ?? {})['VITE_POWERSYNC_URL'] as string | undefined;
  if (!url) throw new Error('Missing VITE_POWERSYNC_URL in environment');
  return url;
}

export class SupabaseConnector
  extends BaseObserver<never>
  implements PowerSyncBackendConnector
{
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      throw new Error('Not authenticated — cannot fetch PowerSync credentials');
    }

    return {
      endpoint: getPowerSyncUrl(),
      token: data.session.access_token,
      // Token expiry — PowerSync will call fetchCredentials again before this
      expiresAt: new Date(data.session.expires_at! * 1000),
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const supabase = getSupabaseClient();

    // Get the next batch of locally-queued writes
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const { table, opData, id } = op;

        switch (op.op) {
          case 'PUT': {
            // Upsert — handles both INSERT and UPDATE
            const { error } = await (supabase as any)
              .from(table)
              .upsert({ id, ...opData });
            if (error) throw error;
            break;
          }
          case 'PATCH': {
            const { error } = await (supabase as any)
              .from(table)
              .update(opData)
              .eq('id', id);
            if (error) throw error;
            break;
          }
          case 'DELETE': {
            const { error } = await (supabase as any)
              .from(table)
              .delete()
              .eq('id', id);
            if (error) throw error;
            break;
          }
        }
      }

      // Commit the batch — tells PowerSync these writes are done
      await transaction.complete();
    } catch (error) {
      console.error('[PowerSync] uploadData failed:', error);
      // Don't call complete() — PowerSync will retry this batch
      throw error;
    }
  }
}
