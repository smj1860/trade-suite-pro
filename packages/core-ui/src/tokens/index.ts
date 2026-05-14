// =============================================================================
// TRADESUITE DESIGN TOKENS
// Theme: Safety Orange / Dark (Industrial Precision)
// Brand: Safety Orange (#FF6600) on Deep Tread dark (#1A1A1A)
// Secondary: Utility Silver (#C0C0C0)
// Font: Inter
// =============================================================================

export const BRAND = {
  darkest:  '#cc4400',
  dark:     '#FF6600',   // Safety Orange — primary brand
  mid:      '#e65c00',   // hover states
  light:    '#ff8533',   // active/selected
  pale:     '#fff0e6',   // light tint
} as const;

export const ACCENT = {
  DEFAULT: '#C0C0C0',   // Utility Silver
  light:   '#d9d9d9',
  dark:    '#9a9a9a',
} as const;

export const SURFACE = {
  DEFAULT:  '#1A1A1A',   // Deep Tread — base background
  raised:   '#2D2D2D',   // Charcoal Gray — cards, modals
  sunken:   '#141414',   // inputs, code blocks
  border:   '#3d3d3d',   // dividers, borders
} as const;

export const TEXT = {
  DEFAULT:   '#FFFFFF',   // Clean White — primary text
  secondary: '#C0C0C0',   // Utility Silver — labels, metadata
  muted:     '#6b6b6b',   // placeholders, timestamps
  inverse:   '#1A1A1A',   // text on orange backgrounds
} as const;

export const SEMANTIC = {
  danger:   '#f87171',   // red-400
  warning:  '#fbbf24',   // amber-400
  success:  '#34d399',   // emerald-400
  info:     '#60a5fa',   // blue-400
} as const;

export const STATUS_COLORS = {
  lead:      { bg: '#3d2e00', text: '#fbbf24', border: '#78590a', dot: '#fbbf24' },
  scheduled: { bg: '#1e2a3d', text: '#60a5fa', border: '#1d4070', dot: '#60a5fa' },
  active:    { bg: '#1a3d2e', text: '#34d399', border: '#166046', dot: '#34d399' },
  complete:  { bg: '#2d1a00', text: '#FF6600', border: '#7a3500', dot: '#FF6600' },
  closed:    { bg: '#242424', text: '#6b6b6b', border: '#3d3d3d', dot: '#6b6b6b' },
  cancelled: { bg: '#3d1a1a', text: '#f87171', border: '#7f1d1d', dot: '#f87171' },
} as const;

export const URGENCY_COLORS = {
  1: { bg: '#242424', text: '#6b6b6b', label: 'Routine'   },
  2: { bg: '#1e2a3d', text: '#60a5fa', label: '2 weeks'   },
  3: { bg: '#3d2e00', text: '#fbbf24', label: '1 week'    },
  4: { bg: '#3d1e0a', text: '#fb923c', label: 'Urgent'    },
  5: { bg: '#3d1a1a', text: '#f87171', label: 'Emergency' },
} as const;

export const FONTS = {
  display: '"Inter", system-ui, sans-serif',
  body:    '"Inter", system-ui, sans-serif',
  mono:    '"Inter", system-ui, sans-serif',
} as const;

export const FONT_IMPORTS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
] as const;

export const TOUCH_TARGET       = '48px';
export const BOTTOM_NAV_HEIGHT  = '64px';
export const PAGE_HEADER_HEIGHT = '56px';

export const SHADOWS = {
  card:   '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
  raised: '0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)',
  modal:  '0 20px 60px rgba(0,0,0,0.7)',
  orange: '0 4px 14px rgba(255,102,0,0.35)',
} as const;

export const CSS_VARS = `
  :root {
    --brand:             ${BRAND.dark};
    --brand-mid:         ${BRAND.mid};
    --brand-pale:        ${BRAND.pale};
    --accent:            ${ACCENT.DEFAULT};
    --surface:           ${SURFACE.DEFAULT};
    --surface-raised:    ${SURFACE.raised};
    --surface-sunken:    ${SURFACE.sunken};
    --surface-border:    ${SURFACE.border};
    --text:              ${TEXT.DEFAULT};
    --text-secondary:    ${TEXT.secondary};
    --text-muted:        ${TEXT.muted};
    --font-display:      ${FONTS.display};
    --font-mono:         ${FONTS.mono};
    --bottom-nav-height: ${BOTTOM_NAV_HEIGHT};
    --page-header-height: ${PAGE_HEADER_HEIGHT};
  }
`;
