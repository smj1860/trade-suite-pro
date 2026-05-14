import { useState, useEffect, useCallback } from 'react';
import type { ModuleName, User, Organization } from '@trades-saas/core-types';
import { getSupabaseClient } from '@trades-saas/core-auth';
import { getPowerSyncDb } from '@trades-saas/core-sync';
import type { SyncState } from '../components/ModuleGate';

// =============================================================================
// HOOKS
//
// All hooks read from the local PowerSync SQLite database for offline-first
// performance. Network state is checked separately for the sync indicator.
// =============================================================================

// ─── useCurrentUser ───────────────────────────────────────────────────────────
//
// Returns the current authenticated user and their organization.
// Reads from PowerSync local DB — works offline.

export interface CurrentUserState {
  user:    User | null;
  org:     Organization | null;
  loading: boolean;
  error:   string | null;
}

export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({
    user: null, org: null, loading: true, error: null,
  });

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Get auth session first
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) {
        setState({ user: null, org: null, loading: false, error: null });
        return;
      }

      const authId = data.session.user.id;

      // Then read user + org from local SQLite (available offline)
      const db = getPowerSyncDb();

      try {
        const userRows = await db.getAll<Record<string, unknown>>(
          'SELECT * FROM users WHERE supabase_auth_id = ? LIMIT 1',
          [authId]
        );

        if (!userRows.length) {
          setState({ user: null, org: null, loading: false, error: 'User profile not found' });
          return;
        }

        const userRow = userRows[0]!;
        const orgRows = await db.getAll<Record<string, unknown>>(
          'SELECT * FROM organizations WHERE id = ? LIMIT 1',
          [userRow['org_id'] as string]
        );

        setState({
          user:    deserializeUser(userRow),
          org:     orgRows.length ? deserializeOrg(orgRows[0]!) : null,
          loading: false,
          error:   null,
        });
      } catch (err) {
        setState({
          user: null, org: null, loading: false,
          error: err instanceof Error ? err.message : 'Failed to load user',
        });
      }
    });
  }, []);

  return state;
}

// ─── useModuleAccess ─────────────────────────────────────────────────────────
//
// Reactive check — updates when Stripe webhooks change active_modules.

export function useModuleAccess(module: ModuleName): {
  hasAccess: boolean;
  loading:   boolean;
} {
  const { org, loading } = useCurrentUser();

  return {
    hasAccess: org?.active_modules?.includes(module) ?? false,
    loading,
  };
}

// ─── useActiveModules ─────────────────────────────────────────────────────────

export function useActiveModules(): ModuleName[] {
  const { org } = useCurrentUser();
  return (org?.active_modules ?? []) as ModuleName[];
}

// ─── useOnlineStatus ─────────────────────────────────────────────────────────
//
// Combines browser online/offline events with PowerSync sync status.

export function useOnlineStatus(): SyncState {
  const [state, setState] = useState<SyncState>('online');

  useEffect(() => {
    // Browser-level connectivity
    const handleOnline  = () => setState('syncing');
    const handleOffline = () => setState('offline');

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    if (!navigator.onLine) setState('offline');

    // PowerSync sync status (when available)
    let unsubscribe: (() => void) | null = null;
    try {
      const db = getPowerSyncDb();
      const stream = (db as unknown as { statusStream?: { subscribe: (fn: (s: unknown) => void) => { unsubscribe: () => void } } }).statusStream;
      if (stream) {
        const sub = stream.subscribe((status: unknown) => {
          const s = status as { connected?: boolean; hasSynced?: boolean } | null;
          if (!navigator.onLine) {
            setState('offline');
          } else if (s?.connected) {
            setState('online');
          } else {
            setState('syncing');
          }
        });
        unsubscribe = () => sub.unsubscribe();
      }
    } catch {
      // PowerSync not initialized yet — fall back to browser events
    }

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe?.();
    };
  }, []);

  return state;
}

// ─── useReactiveQuery ─────────────────────────────────────────────────────────
//
// Wraps PowerSync's watch() in a React hook.
// Automatically re-renders when query results change.

export function useReactiveQuery<T>(
  sql:    string,
  params: unknown[] = []
): { data: T[]; loading: boolean; error: string | null } {
  const [data,    setData]    = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const db = getPowerSyncDb();

    const run = async () => {
      try {
        const results = await db.getAll<T>(sql, params);
        if (!cancelled) {
          setData(results);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Query failed');
          setLoading(false);
        }
      }
    };

    run();

    // Watch for changes (PowerSync reactive query)
    let watcher: { cancel?: () => void } = {};
    try {
      const w = db.watch(sql, params);
      watcher = w as unknown as { cancel?: () => void };
      (async () => {
        for await (const results of w as unknown as AsyncIterable<T[]>) {
          if (cancelled) break;
          setData(results);
          setLoading(false);
        }
      })().catch(() => {});
    } catch {
      // watch not supported in this environment
    }

    return () => {
      cancelled = true;
      watcher.cancel?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, JSON.stringify(params)]);

  return { data, loading, error };
}

// ─── Serialization helpers ────────────────────────────────────────────────────
// SQLite returns everything as primitive types (text, integer).
// These restore the shape that TypeScript expects.

function deserializeUser(row: Record<string, unknown>): User {
  return {
    ...(row as unknown as User),
    is_active: Boolean(row['is_active']),
    notification_prefs:
      typeof row['notification_prefs'] === 'string'
        ? JSON.parse(row['notification_prefs'])
        : row['notification_prefs'],
  };
}

function deserializeOrg(row: Record<string, unknown>): Organization {
  return {
    ...(row as unknown as Organization),
    trade_types:
      typeof row['trade_types'] === 'string'
        ? JSON.parse(row['trade_types'])
        : row['trade_types'],
    active_modules:
      typeof row['active_modules'] === 'string'
        ? JSON.parse(row['active_modules'])
        : row['active_modules'],
  };
}
