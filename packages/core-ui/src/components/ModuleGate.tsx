import React from 'react';
import type { ModuleName } from '@trades-saas/core-types';
import { MODULE_DISPLAY_NAMES, MODULE_TAGLINES, MODULE_PRICES_STANDALONE } from '@trades-saas/core-types';
import { Button } from './Button';
import { Card } from './Card';

// =============================================================================
// MODULE GATE
//
// Wraps any UI that requires a specific module to be active.
// If the module is inactive, renders an upgrade prompt instead of children.
//
// Usage:
//   <ModuleGate module="estimates" activeModules={org.active_modules}>
//     <EstimateBuilder />
//   </ModuleGate>
//
// The upgrade URL takes the contractor to the billing page with the
// relevant module pre-selected.
// =============================================================================

export interface ModuleGateProps {
  module:        ModuleName;
  activeModules: ModuleName[];
  children:      React.ReactNode;
  // Override the default upgrade prompt (e.g. show a teaser instead)
  fallback?:     React.ReactNode;
}

export function ModuleGate({
  module,
  activeModules,
  children,
  fallback,
}: ModuleGateProps) {
  if (activeModules.includes(module)) {
    return <>{children}</>;
  }

  return <>{fallback ?? <UpgradePrompt module={module} />}</>;
}

// ─── Upgrade Prompt ───────────────────────────────────────────────────────────

const MODULE_ICONS: Record<ModuleName, string> = {
  leads:     '🎯',
  estimates: '📋',
  reviews:   '⭐',
};

function UpgradePrompt({ module }: { module: ModuleName }) {
  const name    = MODULE_DISPLAY_NAMES[module];
  const tagline = MODULE_TAGLINES[module];
  const price   = MODULE_PRICES_STANDALONE[module];
  const icon    = MODULE_ICONS[module];
  const href    = `/settings/billing?module=${module}`;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-pale flex items-center justify-center text-3xl mb-4">
        {icon}
      </div>
      <h2 className="font-display font-bold text-field-xl text-content mb-2">
        {name}
      </h2>
      <p className="text-field-sm text-content-secondary mb-1">{tagline}</p>
      <p className="font-mono text-money-sm text-content-muted mb-6">
        ${price}/month
      </p>
      <Button
        variant="accent"
        onClick={() => { window.location.href = href; }}
      >
        Unlock {name}
      </Button>
      <p className="text-field-xs text-content-muted mt-3">
        Add it to your plan in 30 seconds
      </p>
    </div>
  );
}

// =============================================================================
// SYNC STATUS
//
// Shows the current PowerSync sync state.
// Visible in the app shell so contractors always know if they're offline.
//
// States:
//   online   → synced, all good (shown briefly then fades)
//   syncing  → actively syncing changes
//   offline  → no connection — app still works, data queued
//   error    → sync failed — needs attention
// =============================================================================

export type SyncState = 'online' | 'syncing' | 'offline' | 'error';

export interface SyncStatusProps {
  state:      SyncState;
  className?: string;
  // When true, only shows when offline or error (doesn't clutter online UI)
  quietMode?: boolean;
}

const SYNC_CONFIG: Record<SyncState, {
  label:     string;
  color:     string;
  dotClass:  string;
  bg:        string;
}> = {
  online:  {
    label:    'Synced',
    color:    'text-success',
    dotClass: 'bg-success',
    bg:       'bg-green-50 border-green-200',
  },
  syncing: {
    label:    'Syncing...',
    color:    'text-info',
    dotClass: 'bg-info animate-pulse-dot',
    bg:       'bg-blue-50 border-blue-200',
  },
  offline: {
    label:    'Working offline',
    color:    'text-warning',
    dotClass: 'bg-warning animate-pulse-dot',
    bg:       'bg-yellow-50 border-yellow-200',
  },
  error: {
    label:    'Sync error',
    color:    'text-danger',
    dotClass: 'bg-danger',
    bg:       'bg-red-50 border-red-200',
  },
};

export function SyncStatus({ state, className = '', quietMode = true }: SyncStatusProps) {
  const config = SYNC_CONFIG[state];

  // In quiet mode, hide the indicator when online and synced
  if (quietMode && state === 'online') return null;

  return (
    <div
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1',
        'rounded-full border text-field-xs font-medium font-display',
        config.bg,
        config.color,
        className,
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <span
        className={['w-1.5 h-1.5 rounded-full shrink-0', config.dotClass].join(' ')}
        aria-hidden="true"
      />
      {config.label}
    </div>
  );
}

// ─── Offline Banner ───────────────────────────────────────────────────────────
// Full-width banner that shows when offline — more prominent than the dot

export function OfflineBanner() {
  return (
    <div
      className="w-full bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2"
      role="alert"
    >
      <span className="w-2 h-2 rounded-full bg-warning animate-pulse-dot shrink-0" />
      <p className="text-field-xs text-yellow-800 font-medium">
        Working offline — changes will sync when you reconnect
      </p>
    </div>
  );
}

// =============================================================================
// EMPTY STATE
//
// Standardized empty states for list views across all modules.
// =============================================================================

export interface EmptyStateProps {
  icon?:       string;
  title:       string;
  description?: string;
  action?:     React.ReactNode;
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="text-4xl mb-4" aria-hidden="true">{icon}</span>
      <h3 className="font-display font-semibold text-field-lg text-content mb-2">{title}</h3>
      {description && (
        <p className="text-field-sm text-content-secondary max-w-xs mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
