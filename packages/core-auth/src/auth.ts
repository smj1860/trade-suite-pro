import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User, UserRole, ModuleName } from '@trades-saas/core-types';
import { getSupabaseClient } from './client';

// ─── Session ──────────────────────────────────────────────────────────────────

export interface AuthSession {
  supabaseUser: SupabaseUser;
  appUser: User;
  session: Session;
}

// ─── Sign in with email + password ───────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error('Sign in failed — no session returned.');

  const appUser = await fetchAppUser(data.user.id);
  return { supabaseUser: data.user, appUser, session: data.session };
}

// ─── Sign out ────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// ─── Get current session ─────────────────────────────────────────────────────

export async function getSession(): Promise<AuthSession | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();

  if (!data.session?.user) return null;

  try {
    const appUser = await fetchAppUser(data.session.user.id);
    return {
      supabaseUser: data.session.user,
      appUser,
      session: data.session,
    };
  } catch {
    return null;
  }
}

// ─── Subscribe to auth state changes ─────────────────────────────────────────
//
//  Returns an unsubscribe function. Call it on component unmount.

export function onAuthStateChange(
  callback: (session: AuthSession | null) => void
): () => void {
  const supabase = getSupabaseClient();

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (!session?.user) {
        callback(null);
        return;
      }
      try {
        const appUser = await fetchAppUser(session.user.id);
        callback({ supabaseUser: session.user, appUser, session });
      } catch {
        callback(null);
      }
    }
  );

  return () => subscription.unsubscribe();
}

// ─── Request password reset ───────────────────────────────────────────────────

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  if (error) throw new Error(error.message);
}

// ─── Internal: fetch the app-level user record ───────────────────────────────

async function fetchAppUser(supabaseAuthId: string): Promise<User> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('supabase_auth_id', supabaseAuthId)
    .single();

  if (error) throw new Error(`Failed to load user profile: ${error.message}`);
  if (!data) throw new Error('User profile not found. Contact support.');

  return data as User;
}

// ─── Role helpers (pure functions — no DB call) ───────────────────────────────

export function isOwner(role: UserRole): boolean {
  return role === 'owner';
}

export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

export function isTech(role: UserRole): boolean {
  return role === 'tech';
}

export function canManageOrg(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'owner';
}

export function canDeleteCustomers(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

// ─── Module access gate ───────────────────────────────────────────────────────
//
//  activeModules comes from org.active_modules (written by Stripe webhooks).
//  This is the single function every module calls to check access.
//  If the module is not active, show an upgrade prompt.

export function hasModuleAccess(
  activeModules: ModuleName[],
  module: ModuleName
): boolean {
  return activeModules.includes(module);
}

export function hasAllModules(activeModules: ModuleName[]): boolean {
  return hasModuleAccess(activeModules, 'leads')
    && hasModuleAccess(activeModules, 'estimates')
    && hasModuleAccess(activeModules, 'reviews');
}
