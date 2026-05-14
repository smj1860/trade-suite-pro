import type { Config } from 'tailwindcss';
import { BRAND, ACCENT, SURFACE, TEXT, SEMANTIC } from './src/tokens';

// =============================================================================
// TRADESUITE TAILWIND PRESET
//
// Import in apps/pwa/tailwind.config.ts:
//   import tradeSuitePreset from '@trades-saas/core-ui/tailwind'
//   export default { presets: [tradeSuitePreset], content: [...] }
// =============================================================================

const config: Config = {
  content: [],   // consuming app provides content paths
  theme: {
    extend: {
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
        mono:    ['"Inter"', 'system-ui', 'sans-serif'],
      },

      colors: {
        brand: {
          darkest: BRAND.darkest,
          DEFAULT: BRAND.dark,
          mid:     BRAND.mid,
          light:   BRAND.light,
          pale:    BRAND.pale,
        },
        accent: {
          DEFAULT: ACCENT.DEFAULT,
          light:   ACCENT.light,
          dark:    ACCENT.dark,
        },
        surface: {
          DEFAULT: SURFACE.DEFAULT,
          raised:  SURFACE.raised,
          sunken:  SURFACE.sunken,
          border:  SURFACE.border,
        },
        content: {
          DEFAULT:   TEXT.DEFAULT,
          secondary: TEXT.secondary,
          muted:     TEXT.muted,
          inverse:   TEXT.inverse,
        },
        danger:  SEMANTIC.danger,
        warning: SEMANTIC.warning,
        success: SEMANTIC.success,
        info:    SEMANTIC.info,
      },

      fontSize: {
        // Field-readable sizes — nothing under 14px in production UI
        'field-xs': ['14px', { lineHeight: '20px', letterSpacing: '0.01em' }],
        'field-sm': ['15px', { lineHeight: '22px' }],
        'field-base': ['16px', { lineHeight: '24px' }],
        'field-lg': ['18px', { lineHeight: '28px' }],
        'field-xl': ['22px', { lineHeight: '32px', fontWeight: '600' }],
        'field-2xl': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        // Money/data in mono
        'money-sm': ['15px', { lineHeight: '20px'}],
        'money-base': ['18px', { lineHeight: '24px'}],
        'money-lg': ['24px', { lineHeight: '32px'}],
      },

      spacing: {
        'touch': '48px',       // minimum touch target
        'nav': '64px',         // bottom nav height
        'header': '56px',      // page header height
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },

      borderRadius: {
        'card': '12px',
        'button': '8px',
        'badge': '6px',
        'input': '8px',
      },

      boxShadow: {
        'card':   '0 1px 3px rgba(9, 59, 49, 0.08), 0 1px 2px rgba(9, 59, 49, 0.05)',
        'raised': '0 4px 12px rgba(9, 59, 49, 0.12), 0 2px 4px rgba(9, 59, 49, 0.06)',
        'modal':  '0 20px 60px rgba(5, 31, 25, 0.3)',
      },

      animation: {
        'slide-up':   'slideUp 200ms ease-out',
        'slide-down': 'slideDown 200ms ease-out',
        'fade-in':    'fadeIn 150ms ease-out',
        'pulse-dot':  'pulseDot 2s infinite',
      },

      keyframes: {
        slideUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        slideDown: {
          '0%':   { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
    },
  },

  plugins: [],
};

export default config;
