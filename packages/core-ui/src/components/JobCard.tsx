import React from 'react';
import type { Job, Customer } from '@trades-saas/core-types';
import { JOB_STATUS_LABELS } from '@trades-saas/core-types';
import { StatusBadge } from './Badge';
import { Card } from './Card';

// =============================================================================
// JOB CARD
//
// The most repeated UI element in TradeSuite. Appears in:
//   LeadLock   → lead list, follow-up queue
//   OmniBid    → estimate list, invoice list
//   RepuGuard  → completed jobs awaiting review request
//
// Three density modes:
//   compact  → list rows (many jobs visible at once)
//   standard → default card grid
//   detail   → job detail page header
// =============================================================================

export interface JobCardData {
  job:            Job;
  customer_name:  string;
  customer_phone?: string | null;
  assigned_to_name?: string | null;
  // Optional derived data
  estimate_total_cents?: number;
  has_active_sequence?:  boolean;
  unread_messages?:      number;
}

export interface JobCardProps {
  data:       JobCardData;
  mode?:      'compact' | 'standard' | 'detail';
  onPress?:   () => void;
  actions?:   React.ReactNode;   // trailing action buttons
  className?: string;
}

export function JobCard({
  data,
  mode = 'standard',
  onPress,
  actions,
  className = '',
}: JobCardProps) {
  const { job, customer_name, assigned_to_name, estimate_total_cents, unread_messages } = data;

  if (mode === 'compact') {
    return (
      <Card
        elevation="flat"
        padding="sm"
        pressable={!!onPress}
        onClick={onPress}
        className={['border-b rounded-none last:border-b-0', className].join(' ')}
      >
        <div className="flex items-center gap-3">
          <StatusDot status={job.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-field-sm text-content truncate">{job.title}</p>
              {unread_messages ? (
                <UnreadBubble count={unread_messages} />
              ) : null}
            </div>
            <p className="text-field-xs text-content-muted truncate">{customer_name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {estimate_total_cents != null && (
              <span className="font-mono text-field-xs text-content-secondary tabular-nums">
                {formatMoney(estimate_total_cents)}
              </span>
            )}
            <JobNumber number={job.job_number} />
          </div>
        </div>
      </Card>
    );
  }

  if (mode === 'detail') {
    return (
      <div className={['px-4 py-3', className].join(' ')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <JobNumber number={job.job_number} />
              <StatusBadge status={job.status} />
            </div>
            <h1 className="font-display font-bold text-field-xl text-content leading-tight">
              {job.title}
            </h1>
            <p className="text-field-sm text-content-secondary mt-0.5">{customer_name}</p>
            {assigned_to_name && (
              <p className="text-field-xs text-content-muted mt-1">
                Assigned to {assigned_to_name}
              </p>
            )}
          </div>
          {estimate_total_cents != null && (
            <div className="text-right shrink-0">
              <p className="text-field-xs text-content-muted mb-0.5">Est. Value</p>
              <p className="font-mono font-semibold text-money-base text-content tabular-nums">
                {formatMoney(estimate_total_cents)}
              </p>
            </div>
          )}
        </div>
        {actions && <div className="flex gap-2 mt-3">{actions}</div>}
      </div>
    );
  }

  // Standard (default)
  return (
    <Card
      elevation="raised"
      padding="md"
      pressable={!!onPress}
      onClick={onPress}
      className={className}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <JobNumber number={job.job_number} />
            {unread_messages ? <UnreadBubble count={unread_messages} /> : null}
          </div>
          <p className="font-semibold text-field-base text-content truncate">{job.title}</p>
          <p className="text-field-sm text-content-secondary truncate mt-0.5">{customer_name}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {job.scheduled_at && (
            <MetaItem label={formatDate(job.scheduled_at)} icon="📅" />
          )}
          {assigned_to_name && (
            <MetaItem label={assigned_to_name} icon="👤" />
          )}
        </div>
        {estimate_total_cents != null && (
          <span className="font-mono font-semibold text-money-sm text-content tabular-nums">
            {formatMoney(estimate_total_cents)}
          </span>
        )}
      </div>

      {actions && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-surface-border">
          {actions}
        </div>
      )}
    </Card>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: Job['status'] }) {
  const dotColors: Record<Job['status'], string> = {
    lead:      'bg-yellow-400',
    scheduled: 'bg-blue-400',
    active:    'bg-green-400',
    complete:  'bg-brand',
    closed:    'bg-gray-400',
    cancelled: 'bg-red-400',
  };

  return (
    <span
      className={[
        'w-2.5 h-2.5 rounded-full shrink-0',
        dotColors[status],
        status === 'active' ? 'animate-pulse-dot' : '',
      ].join(' ')}
    />
  );
}

function JobNumber({ number }: { number: string }) {
  return (
    <span className="font-mono text-[11px] text-content-muted tracking-wide bg-surface-sunken px-1.5 py-0.5 rounded">
      {number}
    </span>
  );
}

function UnreadBubble({ count }: { count: number }) {
  return (
    <span className="bg-accent text-brand-darkest text-[10px] font-bold font-mono w-4 h-4 rounded-full flex items-center justify-center shrink-0">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function MetaItem({ label, icon }: { label: string; icon: string }) {
  return (
    <span className="text-field-xs text-content-muted flex items-center gap-1">
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
