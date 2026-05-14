import { PowerSyncDatabase } from '@powersync/web';
import { SupabaseConnector } from './connector';
import { AppSchema } from './schema';

// =============================================================================
// POWERSYNC CLIENT
//
// One PowerSyncDatabase instance for the entire app.
// Must be initialized before any component mounts.
// Call db.connect(connector) once the user is signed in.
// Call db.disconnect() on sign out.
// =============================================================================

let _db: PowerSyncDatabase | null = null;

export function getPowerSyncDb(): PowerSyncDatabase {
  if (_db) return _db;

  _db = new PowerSyncDatabase({
    schema: AppSchema,
    database: {
      // Stored in OPFS (Origin Private File System) — survives page refreshes.
      // Each org gets its own database file to prevent data bleed if a user
      // switches accounts on the same device.
      dbFilename: 'tradesuite.db',
    },
  });

  return _db;
}

export type { PowerSyncDatabase };
