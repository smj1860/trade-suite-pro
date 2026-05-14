-- ============================================================================
-- TRADESUITE — JWT CUSTOM CLAIMS HOOK
--
-- PowerSync reads org_id, user_role, and app_user_id from the JWT to
-- determine which sync buckets each user gets. Supabase doesn't include
-- these by default — this hook adds them at token generation time.
--
-- After running this migration you must register the hook in the
-- Supabase Dashboard:
--   Authentication → Hooks → Custom Access Token Hook
--   → Select function: auth.custom_access_token_hook
-- ============================================================================

create or replace function auth.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims   jsonb;
  app_user record;
begin
  -- Pull the app-level user record matching this Supabase auth user
  select
    id,
    org_id,
    role
  into app_user
  from public.users
  where supabase_auth_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if app_user.org_id is not null then
    -- Add custom claims PowerSync bucket parameters will read
    claims := jsonb_set(claims, '{org_id}',      to_jsonb(app_user.org_id::text));
    claims := jsonb_set(claims, '{user_role}',   to_jsonb(app_user.role::text));
    claims := jsonb_set(claims, '{app_user_id}', to_jsonb(app_user.id::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Grant execute to the supabase_auth_admin role (required for hooks)
grant execute
  on function auth.custom_access_token_hook
  to supabase_auth_admin;

comment on function auth.custom_access_token_hook is
  'Adds org_id, user_role, and app_user_id to every JWT.
   PowerSync sync-rules.yaml reads these via request.jwt() to
   determine which data buckets each client receives.
   Must be registered in: Auth → Hooks → Custom Access Token Hook.';
