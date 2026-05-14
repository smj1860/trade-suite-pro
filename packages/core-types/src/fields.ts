import type { JobStatus } from './job';

// ============================================================================
// JOB NOTES
// ============================================================================

export interface JobNote {
  id: string;
  org_id: string;
  job_id: string;
  created_by: string;             // user.id

  body: string;
  is_customer_facing: boolean;    // true = appears on invoice/report
  is_pinned: boolean;

  created_at: string;
  updated_at: string;
}

export type JobNoteInsert = Omit<JobNote, 'id' | 'created_at' | 'updated_at'>;
export type JobNoteUpdate = Pick<JobNote, 'body' | 'is_customer_facing' | 'is_pinned'>;

// ============================================================================
// CUSTOMER ASSETS
// ============================================================================

export type AssetType =
  | 'hvac_unit'
  | 'water_heater'
  | 'electrical_panel'
  | 'plumbing_fixture'
  | 'roof_section'
  | 'appliance'
  | 'other';

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  hvac_unit:          'HVAC Unit',
  water_heater:       'Water Heater',
  electrical_panel:   'Electrical Panel',
  plumbing_fixture:   'Plumbing Fixture',
  roof_section:       'Roof Section',
  appliance:          'Appliance',
  other:              'Other',
};

export interface CustomerAsset {
  id: string;
  org_id: string;
  customer_id: string;

  asset_type: AssetType;
  name: string;

  make: string | null;
  model: string | null;
  serial_number: string | null;
  refrigerant_type: string | null;

  install_date: string | null;        // ISO date (YYYY-MM-DD)
  warranty_expiry: string | null;
  last_service_date: string | null;

  location_notes: string | null;
  notes: string | null;
  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export type CustomerAssetInsert = Omit<CustomerAsset, 'id' | 'created_at' | 'updated_at'>;
export type CustomerAssetUpdate = Partial<Omit<CustomerAssetInsert, 'org_id' | 'customer_id'>>;

// ─── Job ↔ Asset link ────────────────────────────────────────────────────────

export interface JobAsset {
  job_id: string;
  asset_id: string;
  org_id: string;
}

// ─── Warranty helpers ─────────────────────────────────────────────────────────

export type WarrantyState = 'active' | 'expiring_soon' | 'expired' | 'unknown';

export function getWarrantyState(asset: CustomerAsset): WarrantyState {
  if (!asset.warranty_expiry) return 'unknown';

  const expiry = new Date(asset.warranty_expiry);
  const now = new Date();
  const daysRemaining = Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);

  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 90) return 'expiring_soon';
  return 'active';
}

export function assetAgeYears(asset: CustomerAsset): number | null {
  if (!asset.install_date) return null;
  const install = new Date(asset.install_date);
  return Math.floor(
    (Date.now() - install.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
}

// ============================================================================
// JOB PHOTOS
// ============================================================================

export type PhotoType = 'before' | 'during' | 'after' | 'equipment' | 'general';

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  before:     'Before',
  during:     'During',
  after:      'After',
  equipment:  'Equipment / Nameplate',
  general:    'General',
};

export interface JobPhoto {
  id: string;
  org_id: string;
  job_id: string;
  asset_id: string | null;
  uploaded_by: string;

  photo_type: PhotoType;

  storage_path: string;
  storage_url: string;
  filename: string;
  mime_type: string;
  size_bytes: number;

  caption: string | null;
  ocr_text: string | null;

  include_in_report: boolean;

  created_at: string;
}

export type JobPhotoInsert = Omit<JobPhoto, 'id' | 'created_at'>;

// ─── Photo set helper (groups photos by type for the UI) ─────────────────────

export interface JobPhotoSet {
  before: JobPhoto[];
  during: JobPhoto[];
  after: JobPhoto[];
  equipment: JobPhoto[];
  general: JobPhoto[];
}

export function groupPhotosByType(photos: JobPhoto[]): JobPhotoSet {
  return {
    before:    photos.filter(p => p.photo_type === 'before'),
    during:    photos.filter(p => p.photo_type === 'during'),
    after:     photos.filter(p => p.photo_type === 'after'),
    equipment: photos.filter(p => p.photo_type === 'equipment'),
    general:   photos.filter(p => p.photo_type === 'general'),
  };
}

// ============================================================================
// CALENDAR INTEGRATIONS
// ============================================================================

export type CalendarProvider = 'ical' | 'google';
export type SyncDirection = 'outbound' | 'bidirectional';

export interface CalendarIntegration {
  id: string;
  org_id: string;

  provider: CalendarProvider;

  // iCal
  ical_token: string | null;

  // Google OAuth
  google_account_email: string | null;
  google_calendar_id: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expiry: string | null;

  sync_direction: SyncDirection;
  include_statuses: JobStatus[];

  last_synced_at: string | null;
  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export type CalendarIntegrationInsert = Omit<
  CalendarIntegration,
  'id' | 'created_at' | 'updated_at'
>;

// ─── iCal helpers ────────────────────────────────────────────────────────────

export function icalFeedUrl(
  token: string,
  baseUrl = 'https://app.tradesuite.com'
): string {
  return `${baseUrl}/cal/${token}.ics`;
}

export function googleCalendarInstructions(feedUrl: string): string[] {
  return [
    'Open Google Calendar on your computer',
    'In the left sidebar, click the "+" next to "Other calendars"',
    'Choose "From URL"',
    `Paste this link: ${feedUrl}`,
    'Click "Add calendar" — your TradeSuite jobs will appear within a few minutes',
  ];
}
