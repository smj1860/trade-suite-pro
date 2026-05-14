// ─── Roles ────────────────────────────────────────────────────────────────────
//
//  owner  → full access to all org data, billing, settings
//  admin  → full access except billing
//  tech   → sees only assigned jobs, limited customer data

export type UserRole = 'owner' | 'admin' | 'tech';

// ─── Notification Preferences ─────────────────────────────────────────────────

export type NotificationChannel = 'sms' | 'email' | 'push';

export interface NotificationPrefs {
  new_lead: boolean;
  job_assigned: boolean;
  estimate_viewed: boolean;
  estimate_accepted: boolean;
  review_received: boolean;
  channels: NotificationChannel[];
}

const defaultNotificationPrefs: NotificationPrefs = {
  new_lead: true,
  job_assigned: true,
  estimate_viewed: true,
  estimate_accepted: true,
  review_received: true,
  channels: ['sms', 'email'],
};

export { defaultNotificationPrefs };

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  org_id: string;
  supabase_auth_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  notification_prefs: NotificationPrefs;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type UserInsert = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UserUpdate = Partial<Omit<UserInsert, 'org_id' | 'supabase_auth_id'>>;
