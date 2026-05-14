import type { Organization, ModuleName } from '@trades-saas/core-types';
import { MODULE_DISPLAY_NAMES } from '@trades-saas/core-types';
import { getSupabaseClient } from './client';

// ─── Fetch org ────────────────────────────────────────────────────────────────

export async function getOrganization(orgId: string): Promise<Organization> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (error) throw new Error(`Failed to load organization: ${error.message}`);
  if (!data) throw new Error('Organization not found.');

  return data as Organization;
}

// ─── Module access ────────────────────────────────────────────────────────────
//
//  This is the authoritative access check. Used by every module's route
//  guard. Stripe webhooks write to org.active_modules — this reads it.

export function getActiveModules(org: Organization): ModuleName[] {
  return org.active_modules;
}

export function moduleIsActive(org: Organization, module: ModuleName): boolean {
  return org.active_modules.includes(module);
}

// ─── Module gate result ───────────────────────────────────────────────────────
//
//  Returns structured result so UI can show the right upgrade prompt
//  without branching on raw boolean.

export type ModuleGateResult =
  | { allowed: true }
  | { allowed: false; moduleName: string; upgradeUrl: string };

export function checkModuleAccess(
  org: Organization,
  module: ModuleName
): ModuleGateResult {
  if (moduleIsActive(org, module)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    moduleName: MODULE_DISPLAY_NAMES[module],
    upgradeUrl: `/settings/billing?module=${module}`,
  };
}

// ─── Stripe portal URL ────────────────────────────────────────────────────────
//
//  Opens the Stripe Customer Portal for plan changes.
//  The portal URL is generated server-side (Supabase Edge Function).

export async function getStripePortalUrl(): Promise<string> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: { returnUrl: window.location.href },
  });

  if (error) throw new Error('Could not open billing portal. Try again.');
  return data.url as string;
}

// ─── Onboarding state ─────────────────────────────────────────────────────────
//
//  An org is considered onboarded when it has:
//  - A name set
//  - At least one trade type
//  - At least one active module (Stripe subscription exists)

export interface OnboardingState {
  isComplete: boolean;
  missingSteps: string[];
}

export function getOnboardingState(org: Organization): OnboardingState {
  const missingSteps: string[] = [];

  if (!org.name || org.name.trim() === '') {
    missingSteps.push('Set your business name');
  }
  if (org.trade_types.length === 0) {
    missingSteps.push('Select your trade type');
  }
  if (org.active_modules.length === 0) {
    missingSteps.push('Choose a plan');
  }

  return {
    isComplete: missingSteps.length === 0,
    missingSteps,
  };
}
