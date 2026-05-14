import React from 'react';
import { PageHeader, ModuleGate, EmptyState, useActiveModules } from '@trades-saas/core-ui';
import { useAuth } from '../providers';

// JobDetailPage — module build session implements full feature set
export default function JobDetailPage({ mode }: { mode?: string }) {
  const { org } = useAuth();
  const activeModules = useActiveModules();

  return (
    <div className="flex flex-col">
      <PageHeader title="JobDetailPage" />
      <div className="px-4 py-8 text-center text-content-muted">
        <p className="text-field-sm">Coming in module build session</p>
        <p className="text-field-xs mt-1">Org: {org?.name ?? 'Loading...'}</p>
      </div>
    </div>
  );
}
