import React, { useState } from 'react';
import type { JobStatus } from '@trades-saas/core-types';
import { JOB_STATUS_LABELS } from '@trades-saas/core-types';
import { STATUS_COLORS } from '../tokens';

// =============================================================================
// CALENDAR VIEW
//
// Simple week/day calendar showing scheduled jobs per tech.
// Design decisions for field use:
//   - Week is the primary view (most contractors think in terms of the week)
//   - Each day column shows jobs stacked vertically
//   - Tapping a job opens the job detail sheet
//   - No drag-drop — contractors schedule by editing the job card directly
//   - Today is always visually highlighted
// =============================================================================

export interface CalendarJob {
  id:             string;
  title:          string;
  customer_name:  string;
  status:         JobStatus;
  scheduled_at:   string;    // ISO 8601
  assigned_to:    string | null;
  tech_name:      string | null;
  estimated_value_cents?: number | null;
}

export interface CalendarViewProps {
  jobs:        CalendarJob[];
  onJobPress?: (jobId: string) => void;
  className?:  string;
}

// Day labels
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function CalendarView({ jobs, onJobPress, className = '' }: CalendarViewProps) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week

  const { weekStart, days } = getWeekDays(weekOffset);
  const today = new Date();

  const jobsByDay = groupJobsByDay(jobs, days);

  const weekLabel = formatWeekLabel(weekStart);

  return (
    <div className={['flex flex-col', className].join(' ')}>

      {/* Week navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border sticky top-0 bg-surface-raised z-10">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          aria-label="Previous week"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-content-secondary hover:bg-surface touch-manipulation"
        >
          <ChevronLeft />
        </button>

        <div className="text-center">
          <p className="font-display font-semibold text-field-sm text-content">{weekLabel}</p>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-field-xs text-brand font-medium touch-manipulation"
            >
              Back to today
            </button>
          )}
        </div>

        <button
          onClick={() => setWeekOffset(w => w + 1)}
          aria-label="Next week"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-content-secondary hover:bg-surface touch-manipulation"
        >
          <ChevronRight />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-surface-border bg-surface">
        {days.map(day => {
          const isToday = isSameDay(day, today);
          const dayJobs = jobsByDay[day.toDateString()] ?? [];

          return (
            <div
              key={day.toDateString()}
              className="flex flex-col items-center py-2 relative"
            >
              <span className={[
                'text-[10px] font-semibold uppercase tracking-wider',
                isToday ? 'text-brand' : 'text-content-muted',
              ].join(' ')}>
                {DAY_LABELS[day.getDay()]}
              </span>
              <span className={[
                'font-mono font-semibold text-field-sm w-7 h-7 flex items-center justify-center rounded-full mt-0.5',
                isToday ? 'bg-brand text-white' : 'text-content',
              ].join(' ')}>
                {day.getDate()}
              </span>
              {dayJobs.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {/* Job columns */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto divide-x divide-surface-border">
        {days.map(day => {
          const isToday = isSameDay(day, today);
          const dayJobs = jobsByDay[day.toDateString()] ?? [];

          return (
            <div
              key={day.toDateString()}
              className={[
                'flex flex-col gap-1 p-1',
                isToday ? 'bg-brand-pale/30' : '',
              ].join(' ')}
              aria-label={`${DAY_FULL[day.getDay()]}, ${dayJobs.length} jobs`}
            >
              {dayJobs.length === 0 ? (
                <div className="h-8" aria-hidden="true" />
              ) : (
                dayJobs.map(job => (
                  <CalendarJobChip
                    key={job.id}
                    job={job}
                    onPress={onJobPress ? () => onJobPress(job.id) : undefined}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-surface-border flex-wrap">
        {(['scheduled', 'active', 'complete'] as JobStatus[]).map(status => {
          const colors = STATUS_COLORS[status];
          return (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: colors.dot }}
                aria-hidden="true"
              />
              <span className="text-[11px] text-content-muted font-medium">
                {JOB_STATUS_LABELS[status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar Job Chip ────────────────────────────────────────────────────────

function CalendarJobChip({
  job,
  onPress,
}: {
  job:      CalendarJob;
  onPress?: (() => void) | undefined;
}) {
  const colors = STATUS_COLORS[job.status];
  const Tag = onPress ? 'button' : 'div';

  return (
    <Tag
      onClick={onPress}
      className={[
        'w-full text-left rounded-md px-1.5 py-1',
        'border text-[10px] font-medium leading-tight',
        onPress ? 'touch-manipulation active:opacity-70 cursor-pointer' : '',
      ].join(' ')}
      style={{
        backgroundColor: colors.bg,
        borderColor:     colors.border,
        color:           colors.text,
      }}
      aria-label={`${job.title} — ${job.customer_name}`}
    >
      <div className="truncate font-semibold">{job.title}</div>
      <div className="truncate opacity-75">{job.customer_name}</div>
      {job.tech_name && (
        <div className="truncate opacity-60">{job.tech_name}</div>
      )}
    </Tag>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDays(weekOffset: number): { weekStart: Date; days: Date[] } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    days.push(d);
  }

  return { weekStart, days };
}

function groupJobsByDay(
  jobs:  CalendarJob[],
  days:  Date[]
): Record<string, CalendarJob[]> {
  const result: Record<string, CalendarJob[]> = {};
  days.forEach(d => { result[d.toDateString()] = []; });

  jobs.forEach(job => {
    const jobDate = new Date(job.scheduled_at);
    const key = jobDate.toDateString();
    if (result[key]) {
      result[key]!.push(job);
    }
  });

  // Sort each day's jobs by scheduled time
  Object.keys(result).forEach(key => {
    result[key]!.sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  });

  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${weekStart.toLocaleDateString('en-US', opts)} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
  }

  return `${weekStart.toLocaleDateString('en-US', opts)} – ${weekEnd.toLocaleDateString('en-US', opts)}, ${weekStart.getFullYear()}`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
