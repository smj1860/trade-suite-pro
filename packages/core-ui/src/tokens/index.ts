// =============================================================================
// TRADESUITE DESIGN TOKENS
//
// Aesthetic direction: Industrial Precision
// Field-ready tool for contractors — high contrast, readable in direct sunlight,
// large touch targets for gloved hands, dense information display.
//
// Brand: Deep forest green (#093b31) + Amber gold accent (#e8a838)
// Type: Sora (display/headings) + DM Mono (data/numbers)
// =============================================================================

// ─── Brand Colors ─────────────────────────────────────────────────────────────

export const BRAND = {
  darkest:  '#051f19',
  dark:     '#093b31',   // primary brand — nav, buttons, headers
  mid:      '#145e4a',   // hover states
  light:    '#1a7a5e',   // active/pressed states
  pale:     '#e8f4f0',   // tinted backgrounds, selected states
} as const;

export const ACCENT = {
  DEFAULT: '#e8a838',    // amber gold — primary CTA, urgency indicators
  light:   '#f5c96a',
  dark:    '#c48820',
} as const;

// ─── Surface Colors ───────────────────────────────────────────────────────────

export const SURFACE = {
  DEFAULT:  '#f8f7f4',   // warm off-white — main background
  raised:   '#ffffff',   // cards, modals
  sunken:   '#ede9e2',   // inputs, code blocks
  border:   '#ddd8ce',   // dividers, input borders
} as const;

export const SURFACE_DARK = {
  DEFAULT:  '#0e1a16',   // dark mode background
  raised:   '#152820',   // dark mode cards
  sunken:   '#1c3529',   // dark mode inputs
  border:   '#2a4a3a',   // dark mode borders
} as const;

// ─── Text Colors ──────────────────────────────────────────────────────────────

export const TEXT = {
  DEFAULT:   '#1a1a18',  // primary text
  secondary: '#4a4a44',  // secondary/supporting text
  muted:     '#8a8a80',  // placeholder, disabled, timestamps
  inverse:   '#f8f7f4',  // text on dark backgrounds
} as const;

// ─── Semantic Colors ──────────────────────────────────────────────────────────

export const SEMANTIC = {
  danger:   '#dc2626',
  warning:  '#d97706',
  success:  '#16a34a',
  info:     '#2563eb',
} as const;

// ─── Job Status Colors ────────────────────────────────────────────────────────
// Each status has an immediate visual signature. Contractors read these
// at a glance while scrolling a job list.

export const STATUS_COLORS = {
  lead:      { bg: '#fef3c7', text: '#92400e', border: '#fbbf24', dot: '#f59e0b' },
  scheduled: { bg: '#dbeafe', text: '#1e3a8a', border: '#93c5fd', dot: '#3b82f6' },
  active:    { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', dot: '#10b981' },
  complete:  { bg: '#e8f4f0', text: '#093b31', border: '#a7d4c5', dot: '#093b31' },
  closed:    { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db', dot: '#9ca3af' },
  cancelled: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', dot: '#ef4444' },
} as const;

// ─── Urgency Colors ───────────────────────────────────────────────────────────
// Maps to OmniBid's urgency_score 1-5

export const URGENCY_COLORS = {
  1: { bg: '#f3f4f6', text: '#6b7280', label: 'Routine' },
  2: { bg: '#dbeafe', text: '#1e3a8a', label: '2 weeks' },
  3: { bg: '#fef3c7', text: '#92400e', label: '1 week' },
  4: { bg: '#ffedd5', text: '#9a3412', label: 'Urgent' },
  5: { bg: '#fee2e2', text: '#991b1b', label: 'Emergency' },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const FONTS = {
  display: '"Sora", system-ui, sans-serif',   // headings, nav labels, job numbers
  body:    '"Sora", system-ui, sans-serif',   // body text
  mono:    '"DM Mono", "Fira Code", monospace', // prices, measurements, codes
} as const;

export const FONT_IMPORTS = [
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap',
] as const;

// ─── Spacing & Sizing ─────────────────────────────────────────────────────────

export const TOUCH_TARGET = '48px';    // minimum tap target for field use
export const BOTTOM_NAV_HEIGHT = '64px';
export const PAGE_HEADER_HEIGHT = '56px';

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const SHADOWS = {
  card:   '0 1px 3px rgba(9, 59, 49, 0.08), 0 1px 2px rgba(9, 59, 49, 0.05)',
  raised: '0 4px 12px rgba(9, 59, 49, 0.12), 0 2px 4px rgba(9, 59, 49, 0.06)',
  modal:  '0 20px 60px rgba(5, 31, 25, 0.3)',
} as const;

// ─── CSS Custom Properties (injected into :root) ──────────────────────────────
// Use these for values that need to be theme-switchable.

export const CSS_VARS = `
  :root {
    --brand-dark: ${BRAND.dark};
    --brand-mid: ${BRAND.mid};
    --brand-pale: ${BRAND.pale};
    --accent: ${ACCENT.DEFAULT};
    --surface: ${SURFACE.DEFAULT};
    --surface-raised: ${SURFACE.raised};
    --surface-border: ${SURFACE.border};
    --text: ${TEXT.DEFAULT};
    --text-muted: ${TEXT.muted};
    --font-display: ${FONTS.display};
    --font-mono: ${FONTS.mono};
    --bottom-nav-height: ${BOTTOM_NAV_HEIGHT};
    --page-header-height: ${PAGE_HEADER_HEIGHT};
  }
`;
