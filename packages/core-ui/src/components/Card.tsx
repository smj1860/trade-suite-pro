import React from 'react';

// =============================================================================
// CARD
//
// The primary content container. Three elevations:
//   flat    → list items, table rows — no shadow, border only
//   raised  → cards, form sections — subtle shadow
//   modal   → drawers, popovers — strong shadow
//
// Pressable variant adds touch feedback for tappable cards.
// =============================================================================

export interface CardProps {
  children:    React.ReactNode;
  elevation?:  'flat' | 'raised' | 'modal';
  pressable?:  boolean;
  padding?:    'none' | 'sm' | 'md' | 'lg';
  className?:  string;
  onClick?:    (() => void) | undefined;
}

const ELEVATION_CLASSES = {
  flat:   'border border-surface-border shadow-none',
  raised: 'border border-surface-border shadow-card',
  modal:  'border border-surface-border shadow-modal',
};

const PADDING_CLASSES = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
};

export function Card({
  children,
  elevation = 'raised',
  pressable = false,
  padding = 'md',
  className = '',
  onClick,
}: CardProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={[
        'bg-surface-raised rounded-card',
        ELEVATION_CLASSES[elevation],
        PADDING_CLASSES[padding],
        pressable || onClick
          ? 'cursor-pointer touch-manipulation active:scale-[0.99] active:shadow-none transition-all duration-100 text-left w-full'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}

// ─── Card sub-components ──────────────────────────────────────────────────────

export function CardHeader({
  children,
  className = '',
  border = false,
}: {
  children: React.ReactNode;
  className?: string;
  border?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-2',
        border ? 'pb-3 mb-3 border-b border-surface-border' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={['font-display font-semibold text-field-base text-content', className].join(' ')}
    >
      {children}
    </h3>
  );
}

export function CardDivider() {
  return <div className="border-t border-surface-border -mx-4 my-3" />;
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
// Used in dashboard tiles for metrics — revenue, leads, reviews

export interface StatCardProps {
  label:      string;
  value:      string;
  delta?:     string;   // e.g. "+12%" or "-3"
  deltaUp?:   boolean;  // true = green, false = red
  icon?:      React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaUp,
  icon,
  className = '',
}: StatCardProps) {
  return (
    <Card elevation="raised" padding="md" className={className}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-field-xs text-content-muted font-medium uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="font-mono text-money-lg font-medium text-content tabular-nums">
            {value}
          </p>
          {delta && (
            <p
              className={[
                'text-field-xs font-medium mt-1',
                deltaUp ? 'text-success' : 'text-danger',
              ].join(' ')}
            >
              {delta}
            </p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-brand-pale flex items-center justify-center text-brand shrink-0">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
