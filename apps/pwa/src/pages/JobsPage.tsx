import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, Button, JobCard, useReactiveQuery } from '@trades-saas/core-ui';
import type { JobCardData } from '@trades-saas/core-ui';
import type { JobStatus } from '@trades-saas/core-types';
import { JOB_STATUS_LABELS } from '@trades-saas/core-types';
import { useAuth } from '../providers';

type Filter = 'all' | JobStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All'         },
  { key: 'lead',      label: 'Lead'        },
  { key: 'scheduled', label: 'Scheduled'   },
  { key: 'active',    label: 'In Progress' },
  { key: 'complete',  label: 'Complete'    },
  { key: 'closed',    label: 'Closed'      },
];

interface JobRow {
  id: string; org_id: string; customer_id: string;
  title: string; description: string | null; status: string; source: string;
  assigned_to: string | null; location: string | null; trade_type: string | null;
  scheduled_at: string | null; completed_at: string | null;
  estimated_value_cents: number | null; final_value_cents: number | null;
  job_number: string; created_at: string; updated_at: string;
  customer_name: string; assigned_to_name: string | null;
  estimate_total_cents: number | null;
}

export default function JobsPage() {
  const navigate = useNavigate();
  const { org }  = useAuth();
  const orgId    = org?.id ?? '';
  const [filter, setFilter] = useState<Filter>('all');
  const [searchParams] = useSearchParams();
  const customerFilter = searchParams.get('customer');

  const whereStatus    = filter === 'all'
    ? `status NOT IN ('cancelled')`
    : `status = '${filter}'`;
  const customerClause = customerFilter ? `AND j.customer_id = '${customerFilter}'` : '';

  const { data: rows } = useReactiveQuery<JobRow>(`
    SELECT
      j.*,
      c.name AS customer_name,
      u.name AS assigned_to_name,
      e.total_cents AS estimate_total_cents
    FROM jobs j
    LEFT JOIN customers  c ON c.id = j.customer_id
    LEFT JOIN users      u ON u.id = j.assigned_to
    LEFT JOIN estimates  e ON e.job_id = j.id AND e.status NOT IN ('declined', 'rejected', 'expired', 'superseded')
    WHERE j.org_id = ?
      AND j.${whereStatus}
      ${customerClause}
    ORDER BY
      CASE j.status
        WHEN 'active'    THEN 1
        WHEN 'scheduled' THEN 2
        WHEN 'lead'      THEN 3
        WHEN 'complete'  THEN 4
        WHEN 'closed'    THEN 5
        ELSE 6
      END,
      j.scheduled_at ASC,
      j.created_at DESC
    LIMIT 100
  `, [orgId]);

  const { data: customerRows } = useReactiveQuery<{ name: string }>(
    customerFilter
      ? `SELECT name FROM customers WHERE id = ? LIMIT 1`
      : `SELECT '' AS name WHERE 0`,
    customerFilter ? [customerFilter] : []
  );
  const customerName = customerRows?.[0]?.name;

  const jobs: JobCardData[] = rows.map(r => ({
    job: {
      id: r.id, org_id: r.org_id, customer_id: r.customer_id,
      title: r.title, description: r.description,
      status: r.status as JobStatus, source: r.source as any,
      assigned_to: r.assigned_to, location: r.location, trade_type: r.trade_type as any,
      scheduled_at: r.scheduled_at, completed_at: r.completed_at,
      estimated_value_cents: r.estimated_value_cents, final_value_cents: r.final_value_cents,
      job_number: r.job_number, created_at: r.created_at, updated_at: r.updated_at,
    },
    customer_name:    r.customer_name,
    assigned_to_name: r.assigned_to_name,
    ...(r.estimate_total_cents != null ? { estimate_total_cents: r.estimate_total_cents } : {}),
  }));

  return (
    <div className="flex flex-col h-full bg-surface">
      <PageHeader
        title="Jobs"
        actions={
          <Button variant="primary" size="sm" onClick={() => navigate('/jobs/new')}>
            + New
          </Button>
        }
      />

      {/* Customer filter banner */}
      {customerFilter && customerName && (
        <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-surface-border">
          <p className="text-field-xs text-content-secondary">
            Jobs for <span className="font-semibold text-content">{customerName}</span>
          </p>
          <button
            onClick={() => navigate('/jobs')}
            className="text-field-xs text-brand font-semibold touch-manipulation"
          >
            Clear
          </button>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b border-surface-border scrollbar-none">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 text-field-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
              filter === key
                ? 'bg-brand text-white'
                : 'text-content-secondary hover:text-content hover:bg-surface-raised'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-8">
            <p className="text-field-sm font-bold text-content-secondary">No jobs</p>
            <p className="text-field-xs text-content-muted mt-1">
              {filter === 'all'
                ? 'Tap "+ New" to create your first job'
                : `No ${JOB_STATUS_LABELS[filter as JobStatus] ?? filter} jobs`}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {jobs.map(j => (
              <JobCard
                key={j.job.id}
                data={j}
                onPress={() => navigate(`/jobs/${j.job.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
