import type { NavItem } from '@trades-saas/core-ui';

// =============================================================================
// NAV CONFIGURATION
//
// Nav items are filtered by active_modules in AppShell.
// Items without a module property always appear (core routes).
// =============================================================================

export const NAV_ITEMS: NavItem[] = [
  {
    id:    'dashboard',
    label: 'Home',
    href:  '/dashboard',
    icon:  '🏠',
  },
  {
    id:     'jobs',
    label:  'Jobs',
    href:   '/jobs',
    icon:   '🔧',
    // Jobs are always visible — they're the core entity
  },
  {
    id:     'estimates',
    label:  'OmniBid',
    href:   '/estimates',
    icon:   '📋',
    module: 'estimates',
  },
  {
    id:     'leads',
    label:  'LeadLock',
    href:   '/leads',
    icon:   '🎯',
    module: 'leads',
  },
  {
    id:     'reviews',
    label:  'RepuGuard',
    href:   '/reviews',
    icon:   '⭐',
    module: 'reviews',
  },
  {
    id:    'settings',
    label: 'Settings',
    href:  '/settings',
    icon:  '⚙️',
  },
];
