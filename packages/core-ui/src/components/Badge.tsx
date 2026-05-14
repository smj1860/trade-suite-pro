import React from 'react';
import type { JobStatus } from '@trades-saas/core-types';
import { JOB_STATUS_LABELS } from '@trades-saas/core-types';
import { STATUS_COLORS, URGENCY_COLORS } from '../tokens';

// =============================================================================
// BADGE — general purpose label chip
// =============================================================================

export type BadgeVariant = 'default' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'ghost';

export interface BadgeProps {
  children:   React.ReactNode;
  variant?:   BadgeVariant;
  dot?:       boolean;    // animated dot indicator (e.g. for active/live status)
  className?: string;
}

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-surface-sunken text-content-secondary border-surface-border',
  brand:   'bg-brand-pale text-brand border-brand/20',
  accent:  'bg-amber-100 text-amber-900 border-amber-200',
  success: 'bg-green-50 text-green-800 border-green-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  danger:  'bg-red-50 text-red-800 border-red-200',
  ghost:   'bg-transparent text-content-muted border-transparent',
};

export function Badge({ children, variant = 'default', dot = false, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5',
        'px-2 py-0.5 rounded-badge border',
        'text-field-xs font-medium font-display',
        'whitespace-nowrap',
        BADGE_CLASSES[variant],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

// =============================================================================
// STATUS BADGE — job status with colour-coded visual identity
// =============================================================================

export interface StatusBadgeProps {
  status:     JobStatus;
  showDot?:   boolean;
  size?:      'sm' | 'md';
  className?: string;
}

export function StatusBadge({
  status,
  showDot = true,
  size = 'md',
  className = '',
}: StatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  const label  = JOB_STATUS_LABELS[status];
  const isLive = status === 'active';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-badge border font-display font-medium whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[12px]' : 'px-2 py-1 text-field-xs',
        className,
      ].join(' ')}
      style={{
        backgroundColor: colors.bg,
        color:           colors.text,
        borderColor:     colors.border,
      }}
    >
      {showDot && (
        <span
          className={['w-1.5 h-1.5 rounded-full shrink-0', isLive ? 'animate-pulse-dot' : ''].join(' ')}
          style={{ backgroundColor: colors.dot }}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}

// =============================================================================
// URGENCY BADGE — maps to OmniBid's urgency_score 1-5
// =============================================================================

export interface UrgencyBadgeProps {
  score:      1 | 2 | 3 | 4 | 5;
  showLabel?: boolean;
  className?: string;
}

export function UrgencyBadge({ score, showLabel = true, className = '' }: UrgencyBadgeProps) {
  const colors = URGENCY_COLORS[score];
  const isEmergency = score === 5;
  const isUrgent    = score === 4;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-badge border font-display font-medium text-field-xs',
        className,
      ].join(' ')}
      style={{
        backgroundColor: colors.bg,
        color:           colors.text,
        borderColor:     colors.bg,
      }}
    >
      {(isEmergency || isUrgent) && (
        <span className="animate-pulse-dot" aria-hidden="true">⚠</span>
      )}
      {showLabel && colors.label}
    </span>
  );
}

// =============================================================================
// MODULE BADGE — shows which TradeSuite module a piece of data came from
// =============================================================================

import type { ModuleName } from '@trades-saas/core-types';
import { MODULE_DISPLAY_NAMES } from '@trades-saas/core-types';

export function ModuleBadge({ module }: { module: ModuleName }) {
  return (
    <Badge variant="ghost" className="text-[11px] uppercase tracking-wider">
      {MODULE_DISPLAY_NAMES[module]}
    </Badge>
  );
}
