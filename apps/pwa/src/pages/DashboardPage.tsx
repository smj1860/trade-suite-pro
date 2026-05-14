import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers';
import {
  PageHeader, Section, StatCard, JobCard,
  ModuleGate, EmptyState, Button,
  useReactiveQuery, useActiveModules,
} from '@trades-saas/core-ui';
import type { JobCardData } from '@trades-saas/core-ui';

// =============================================================================
// DASHBOARD
//
// Shows contextual stats and recent jobs based on active modules.
// All data reads from local SQLite via PowerSync — loads instantly offline.
// =============================================================================

interface JobRow {
  id: string; org_id: string; customer_id: string; title: string;
  description: string | null; status: string; source: string;
  assigned_to: string | null; location: string | null; trade_type: string | null;
  scheduled_at: string | null; completed_at: string | null;
  estimated_value_cents: number | null; final_value_cents: number | null;
  job_number: string; created_at: string; updated_at: string;
  customer_name: string; assigned_to_name: string | null;
}

interface StatRow { total: number }

export default function DashboardPage() {
  const navigate      = useNavigate();
  const { user, org } = useAuth();
  const activeModules = useActiveModules();

  const orgId = org?.id ?? '';

  // Recent active + scheduled jobs
  const { data: recentJobs } = useReactiveQuery<JobRow>(`
    SELECT j.*, c.name AS customer_name, u.name AS assigned_to_name
    FROM jobs j
    LEFT JOIN customers c ON c.id = j.customer_id
    LEFT JOIN users u ON u.id = j.assigned_to
    WHERE j.org_id = ?
      AND j.status IN ('lead','scheduled','active')
    ORDER BY j.updated_at DESC
    LIMIT 8
  `, [orgId]);

  // Stats
  const { data: openJobs }     = useReactiveQuery<StatRow>(`SELECT COUNT(*) as total FROM jobs WHERE org_id = ? AND status NOT IN ('closed','cancelled')`, [orgId]);
  const { data: activeSeqs }   = useReactiveQuery<StatRow>(`SELECT COUNT(*) as total FROM follow_up_sequences WHERE org_id = ? AND status = 'active'`, [orgId]);
  const { data: unpaidInvs }   = useReactiveQuery<StatRow>(`SELECT COUNT(*) as total FROM invoices WHERE org_id = ? AND status IN ('sent','viewed','partial','overdue')`, [orgId]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const jobsData: JobCardData[] = recentJobs.map(j => ({
    job: {
      id: j.id, org_id: j.org_id, customer_id: j.customer_id,
      title: j.title, description: j.description,
      status: j.status as JobCardData['job']['status'],
      source: j.source as JobCardData['job']['source'],
      assigned_to: j.assigned_to, location: j.location,
      trade_type: j.trade_type as JobCardData['job']['trade_type'],
      scheduled_at: j.scheduled_at, completed_at: j.completed_at,
      estimated_value_cents: j.estimated_value_cents,
      final_value_cents: j.final_value_cents,
      job_number: j.job_number, created_at: j.created_at, updated_at: j.updated_at,
    },
    customer_name:    j.customer_name,
    assigned_to_name: j.assigned_to_name,
    ...(j.estimated_value_cents != null ? { estimate_total_cents: j.estimated_value_cents } : {}),
  }));

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header */}
      <PageHeader
        title={`${greeting}, ${firstName}`}
        {...(org?.name ? { subtitle: org.name } : {})}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/jobs/new')}
          >
            + New Job
          </Button>
        }
      />

      {/* Stats row */}
      <Section>
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="Open Jobs"
            value={String(openJobs[0]?.total ?? 0)}
            icon="🔧"
          />
          <ModuleGate module="leads" activeModules={activeModules} fallback={
            <StatCard label="Sequences" value="—" icon="🎯" />
          }>
            <StatCard
              label="Sequences"
              value={String(activeSeqs[0]?.total ?? 0)}
              icon="🎯"
              {...(activeSeqs[0]?.total ? { delta: 'active' } : {})}
            />
          </ModuleGate>
          <ModuleGate module="estimates" activeModules={activeModules} fallback={
            <StatCard label="Unpaid" value="—" icon="💳" />
          }>
            <StatCard
              label="Unpaid"
              value={String(unpaidInvs[0]?.total ?? 0)}
              icon="💳"
              deltaUp={false}
              {...(unpaidInvs[0]?.total ? { delta: `${unpaidInvs[0].total} invoice${unpaidInvs[0].total !== 1 ? 's' : ''}` } : {})}
            />
          </ModuleGate>
        </div>
      </Section>

      {/* Recent jobs */}
      <Section
        title="Recent Jobs"
        action={
          <button
            className="text-field-xs text-brand font-medium touch-manipulation"
            onClick={() => navigate('/jobs')}
          >
            See all
          </button>
        }
      >
        {jobsData.length === 0 ? (
          <EmptyState
            icon="🔧"
            title="No open jobs"
            description="Tap + New Job to get started"
            action={
              <Button variant="primary" onClick={() => navigate('/jobs/new')}>
                Create First Job
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {jobsData.map(data => (
              <JobCard
                key={data.job.id}
                data={data}
                mode="compact"
                onPress={() => navigate(`/jobs/${data.job.id}`)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Upgrade prompts for inactive modules */}
      {activeModules.length < 3 && (
        <Section title="Available Add-ons">
          <div className="flex flex-col gap-2">
            {(['leads', 'estimates', 'reviews'] as const)
              .filter(m => !activeModules.includes(m))
              .map(module => (
                <ModuleTeaser key={module} module={module} onPress={() => navigate(`/settings/billing?module=${module}`)} />
              ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Module teaser card ───────────────────────────────────────────────────────

import type { ModuleName } from '@trades-saas/core-types';
import { MODULE_DISPLAY_NAMES, MODULE_TAGLINES, MODULE_PRICES_STANDALONE } from '@trades-saas/core-types';

const MODULE_ICONS: Record<ModuleName, string> = {
  leads: '🎯', estimates: '📋', reviews: '⭐',
};

function ModuleTeaser({ module, onPress }: { module: ModuleName; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="flex items-center gap-3 bg-surface-raised border border-surface-border rounded-card p-4 text-left touch-manipulation active:scale-[0.99] transition-transform"
    >
      <div className="w-10 h-10 rounded-lg bg-brand-pale flex items-center justify-center text-xl shrink-0">
        {MODULE_ICONS[module]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-field-sm text-content">
          {MODULE_DISPLAY_NAMES[module]}
        </p>
        <p className="text-field-xs text-content-muted truncate">{MODULE_TAGLINES[module]}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-field-xs text-content-secondary">${MODULE_PRICES_STANDALONE[module]}/mo</p>
        <p className="text-[10px] text-brand font-semibold">Add →</p>
      </div>
    </button>
  );
}
