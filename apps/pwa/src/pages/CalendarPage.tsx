import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, CalendarView, useReactiveQuery } from '@trades-saas/core-ui';
import type { CalendarJob } from '@trades-saas/core-ui';
import { useAuth } from '../providers';

interface CalJobRow {
  id: string; title: string; status: string;
  scheduled_at: string; assigned_to: string | null;
  customer_name: string; tech_name: string | null;
  estimated_value_cents: number | null;
}

export default function CalendarPage() {
  const navigate    = useNavigate();
  const { org }     = useAuth();
  const orgId       = org?.id ?? '';

  // 6-week window around today
  const sixWeeksAgo  = new Date(Date.now() - 42 * 86400000).toISOString();
  const sixWeeksAhead = new Date(Date.now() + 42 * 86400000).toISOString();

  const { data: rows } = useReactiveQuery<CalJobRow>(`
    SELECT
      j.id, j.title, j.status, j.scheduled_at, j.assigned_to,
      j.estimated_value_cents,
      c.name AS customer_name,
      u.name AS tech_name
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN users u ON u.id = j.assigned_to
    WHERE j.org_id = ?
      AND j.scheduled_at IS NOT NULL
      AND j.scheduled_at >= ?
      AND j.scheduled_at <= ?
      AND j.status NOT IN ('cancelled','closed')
    ORDER BY j.scheduled_at ASC
  `, [orgId, sixWeeksAgo, sixWeeksAhead]);

  const jobs: CalendarJob[] = rows.map(r => ({
    id:             r.id,
    title:          r.title,
    customer_name:  r.customer_name,
    status:         r.status as CalendarJob['status'],
    scheduled_at:   r.scheduled_at,
    assigned_to:    r.assigned_to,
    tech_name:      r.tech_name,
    estimated_value_cents: r.estimated_value_cents,
  }));

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--bottom-nav-height))]">
      <PageHeader
        title="Calendar"
        actions={
          <button
            className="text-field-sm text-brand font-semibold touch-manipulation"
            onClick={() => navigate('/jobs/new')}
          >
            + Job
          </button>
        }
      />
      <div className="flex-1 overflow-hidden">
        <CalendarView
          jobs={jobs}
          onJobPress={id => navigate(`/jobs/${id}`)}
          className="h-full"
        />
      </div>
    </div>
  );
}
