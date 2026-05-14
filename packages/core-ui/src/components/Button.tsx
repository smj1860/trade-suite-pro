import React from 'react';

// =============================================================================
// BUTTON
//
// Variants map directly to actions in a trades context:
//   primary   → main CTA (Send Estimate, Mark Complete, Request Review)
//   secondary → supporting actions (Edit, Filter, View)
//   danger    → destructive (Cancel Job, Delete)
//   ghost     → low-emphasis (Back, Skip)
//   accent    → highest urgency (Emergency, Book Now)
//
// Size 'lg' is the default for field use — 48px+ touch target.
// =============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  icon?:     React.ReactNode;    // leading icon
  iconRight?: React.ReactNode;   // trailing icon
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:   'bg-brand text-content-inverse hover:bg-brand-mid active:bg-brand-light border-transparent shadow-card',
  secondary: 'bg-surface-raised text-content border-surface-border hover:bg-surface hover:border-brand/30 active:bg-surface-sunken',
  danger:    'bg-danger text-white border-transparent hover:bg-red-700 active:bg-red-800 shadow-card',
  ghost:     'bg-transparent text-content-secondary border-transparent hover:bg-surface hover:text-content active:bg-surface-sunken',
  accent:    'bg-accent text-brand-darkest border-transparent hover:bg-accent-dark active:bg-accent-dark shadow-card font-semibold',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm:  'h-9 px-3 text-field-xs gap-1.5 rounded-button',
  md:  'h-11 px-4 text-field-sm gap-2 rounded-button',
  lg:  'h-touch px-5 text-field-base gap-2 rounded-button',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'lg',
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          // Base
          'inline-flex items-center justify-center',
          'font-display font-medium',
          'border transition-all duration-150',
          'select-none touch-manipulation',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
          // Variant
          VARIANT_CLASSES[variant],
          // Size
          SIZE_CLASSES[size],
          // Width
          fullWidth ? 'w-full' : '',
          // Disabled
          isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {loading ? (
          <Spinner size={size} />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ─── Spinner ──────────────────────────────────────────────────────────────────

const SPINNER_SIZE: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

function Spinner({ size }: { size: ButtonSize }) {
  return (
    <svg
      className={`${SPINNER_SIZE[size]} animate-spin shrink-0`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────
// Square button for icon-only actions (common in mobile nav bars and toolbars)

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon:     React.ReactNode;
  label:    string;   // required for accessibility
  variant?: ButtonVariant;
  size?:    ButtonSize;
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'lg',
  className = '',
  ...props
}: IconButtonProps) {
  const sizeClass = size === 'sm' ? 'w-9 h-9' : size === 'md' ? 'w-11 h-11' : 'w-touch h-touch';

  return (
    <button
      aria-label={label}
      className={[
        'inline-flex items-center justify-center rounded-button',
        'border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        'touch-manipulation cursor-pointer',
        VARIANT_CLASSES[variant],
        sizeClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {icon}
    </button>
  );
}
