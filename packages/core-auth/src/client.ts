import { createClient } from '@supabase/supabase-js';

// ─── Environment validation ───────────────────────────────────────────────────

function getEnvVar(key: string): string {
  const value = typeof process !== 'undefined'
    ? process.env[key]
    : (import.meta as unknown as Record<string, Record<string, string>>).env?.[key];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Add it to your .env.local file.`
    );
  }
  return value;
}

// ─── Supabase client (browser / PWA) ─────────────────────────────────────────
//
//  A single instance shared across the entire app.
//  Uses the anon key — RLS enforces all access control.
//  Never use the service role key on the client.

let _client: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (_client) return _client;

  _client = createClient(
    getEnvVar('VITE_SUPABASE_URL'),
    getEnvVar('VITE_SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  return _client;
}

export type SupabaseClient = ReturnType<typeof getSupabaseClient>;
