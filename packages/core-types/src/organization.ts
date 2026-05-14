// ─── Trade Types ─────────────────────────────────────────────────────────────

export type TradeType =
  | 'hvac'
  | 'plumbing'
  | 'electrical'
  | 'roofing'
  | 'general_contractor'
  | 'landscaping'
  | 'painting'
  | 'flooring'
  | 'pest_control'
  | 'other';

// ─── Module Names ─────────────────────────────────────────────────────────────
//
//  Internal keys are stable snake_case identifiers used in the DB, RLS,
//  Stripe product metadata, and Turborepo package names.
//  Branded display names are defined below and used in all UI + marketing copy.

export type ModuleName = 'leads' | 'estimates' | 'reviews';

// ─── Branded Module Display Names ─────────────────────────────────────────────
//
//  leads     → LeadLock (name TBC — placeholder kept)
//  estimates → OmniBid
//  reviews   → RepuGuard

export const MODULE_DISPLAY_NAMES: Record<ModuleName, string> = {
  leads:     'LeadLock',     // ← name TBC, update here when confirmed
  estimates: 'OmniBid',
  reviews:   'RepuGuard',
};

export const MODULE_TAGLINES: Record<ModuleName, string> = {
  leads:     'Lead Capture & Follow-Up Automator',
  estimates: 'AI Estimate Generator',
  reviews:   'Review & Reputation Autopilot',
};

export const MODULE_PRICES_STANDALONE: Record<ModuleName, number> = {
  leads:     59,   // USD/mo
  estimates: 69,
  reviews:   49,
};

// Bundle pricing — key is sorted module names joined with '+'
export const BUNDLE_PRICES: Record<string, number> = {
  'estimates+leads':           109,   // OmniBid + LeadLock (save $19)
  'leads+reviews':             89,    // LeadLock + RepuGuard (save $19)
  'estimates+leads+reviews':   149,   // TradeSuite Pro (save $28)
};

// ─── Organization ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  logo_url: string | null;
  trade_types: TradeType[];
  timezone: string;                       // IANA timezone e.g. "America/Chicago"
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  active_modules: ModuleName[];           // Stripe webhooks write this field
  created_at: string;                     // ISO 8601
  updated_at: string;
}

export type OrganizationInsert = Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
export type OrganizationUpdate = Partial<OrganizationInsert>;
