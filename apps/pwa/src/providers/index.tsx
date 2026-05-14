import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient, signIn, signOut, onAuthStateChange } from '@trades-saas/core-auth';
import { getPowerSyncDb, SupabaseConnector } from '@trades-saas/core-sync';
import type { User, Organization } from '@trades-saas/core-types';

// =============================================================================
// AUTH CONTEXT
// =============================================================================

interface AuthState {
  user:    User | null;
  org:     Organization | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null, org: null, loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

// =============================================================================
// POWERSYNC CONTEXT
// =============================================================================

interface SyncState {
  ready:     boolean;
  connected: boolean;
}

const SyncContext = createContext<SyncState>({ ready: false, connected: false });

export function useSync() {
  return useContext(SyncContext);
}

// =============================================================================
// ROOT PROVIDER
//
// Initialization sequence:
//   1. Check Supabase session on mount
//   2. Once session confirmed, initialize PowerSync with that session
//   3. PowerSync connects and begins syncing the local SQLite DB
//   4. Children render with full offline-ready data access
// =============================================================================

export function RootProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth]     = useState<AuthState>({ user: null, org: null, loading: true });
  const [sync, setSync]     = useState<SyncState>({ ready: false, connected: false });
  const [syncReady, setSyncReady] = useState(false);

  // ── 1. Auth listener ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (session) => {
      if (!session) {
        setAuth({ user: null, org: null, loading: false });
        // Disconnect PowerSync on sign-out
        if (syncReady) {
          try { await getPowerSyncDb().disconnect(); } catch {}
        }
        return;
      }

      // Fetch org from Supabase on session change
      const supabase = getSupabaseClient();
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('*, organizations(*)')
          .eq('supabase_auth_id', session.supabaseUser.id)
          .single();

        setAuth({
          user:    session.appUser,
          org:     ((userRow ?? {}) as Record<string, unknown>)?.['organizations'] as Organization ?? null,
          loading: false,
        });
      } catch {
        setAuth({ user: session.appUser, org: null, loading: false });
      }
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. PowerSync initialization (once auth is ready) ──────────────────────
  useEffect(() => {
    if (auth.loading || !auth.user) return;

    let cancelled = false;

    const initSync = async () => {
      try {
        const db        = getPowerSyncDb();
        const connector = new SupabaseConnector();

        await db.init();
        if (cancelled) return;

        await db.connect(connector);
        if (cancelled) return;

        setSyncReady(true);
        setSync({ ready: true, connected: true });
      } catch (err) {
        console.error('[PowerSync] Init failed:', err);
        if (!cancelled) {
          setSync({ ready: true, connected: false });
        }
      }
    };

    initSync();

    return () => { cancelled = true; };
  }, [auth.loading, auth.user]);

  return (
    <AuthContext.Provider value={auth}>
      <SyncContext.Provider value={sync}>
        {children}
      </SyncContext.Provider>
    </AuthContext.Provider>
  );
}

// =============================================================================
// AUTH ACTIONS
// Exported so pages can call them without importing core-auth directly
// =============================================================================

export { signIn, signOut };
