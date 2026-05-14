import React from 'react';

// =============================================================================
// FORM CONTROLS
//
// Designed for field use:
//   - 48px height minimum (touch target)
//   - 16px text (prevents iOS zoom on focus)
//   - Clear error states
//   - Works with gloved hands (large tap areas)
// =============================================================================

// ─── Base styles ─────────────────────────────────────────────────────────────

const BASE_INPUT = [
  'w-full rounded-input border bg-surface-raised',
  'text-field-base text-content font-display',
  'placeholder:text-content-muted',
  'transition-colors duration-150',
  'focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-sunken',
].join(' ');

// ─── Field wrapper ────────────────────────────────────────────────────────────

export interface FieldProps {
  label?:    string;
  hint?:     string;
  error?:    string;
  required?: boolean;
  children:  React.ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className = '' }: FieldProps) {
  return (
    <div className={['flex flex-col gap-1.5', className].join(' ')}>
      {label && (
        <label className="text-field-sm font-medium text-content-secondary font-display">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-field-xs text-danger font-medium">{error}</p>
      ) : hint ? (
        <p className="text-field-xs text-content-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?:      boolean;
  icon?:       React.ReactNode;   // leading icon
  iconRight?:  React.ReactNode;   // trailing icon (e.g. clear button)
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, icon, iconRight, className = '', ...props }, ref) => {
    if (icon || iconRight) {
      return (
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 text-content-muted pointer-events-none shrink-0">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            className={[
              BASE_INPUT,
              'h-touch',
              icon ? 'pl-10' : 'pl-4',
              iconRight ? 'pr-10' : 'pr-4',
              error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-surface-border',
              className,
            ].join(' ')}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 text-content-muted shrink-0">
              {iconRight}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={[
          BASE_INPUT,
          'h-touch px-4',
          error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-surface-border',
          className,
        ].join(' ')}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

// ─── Select ───────────────────────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?:    boolean;
  options:   Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, options, placeholder, className = '', ...props }, ref) => (
    <select
      ref={ref}
      className={[
        BASE_INPUT,
        'h-touch px-4 pr-10',
        'appearance-none cursor-pointer',
        // Custom arrow via background
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a8a80\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")]',
        'bg-no-repeat bg-[right_12px_center]',
        error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-surface-border',
        className,
      ].join(' ')}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map(opt => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  )
);

Select.displayName = 'Select';

// ─── Textarea ─────────────────────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={[
        BASE_INPUT,
        'px-4 py-3 min-h-[100px] resize-y',
        error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-surface-border',
        className,
      ].join(' ')}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';

// ─── Currency Input ───────────────────────────────────────────────────────────
// Accepts dollar amounts, stores as cents internally

export interface CurrencyInputProps {
  valueCents:  number;
  onChange:    (cents: number) => void;
  placeholder?: string;
  error?:      boolean;
  disabled?:   boolean;
}

export function CurrencyInput({
  valueCents,
  onChange,
  placeholder = '0.00',
  error,
  disabled,
}: CurrencyInputProps) {
  const displayValue = valueCents > 0 ? (valueCents / 100).toFixed(2) : '';

  return (
    <div className="relative flex items-center">
      <span className="absolute left-4 text-content-muted font-mono text-field-base pointer-events-none">
        $
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => {
          const dollars = parseFloat(e.target.value) || 0;
          onChange(Math.round(dollars * 100));
        }}
        className={[
          BASE_INPUT,
          'h-touch pl-8 pr-4',
          'font-mono tabular-nums',
          error ? 'border-danger focus:border-danger focus:ring-danger/30' : 'border-surface-border',
        ].join(' ')}
      />
    </div>
  );
}
