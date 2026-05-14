import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader, Section, Card, Button, Badge, ModuleBadge, useActiveModules } from '@trades-saas/core-ui';
import { MODULE_DISPLAY_NAMES, MODULE_TAGLINES, MODULE_PRICES_STANDALONE, BUNDLE_PRICES } from '@trades-saas/core-types';
import type { ModuleName } from '@trades-saas/core-types';
import { getSupabaseClient } from '@trades-saas/core-auth';

const MODULE_ICONS: Record<ModuleName, string> = {
  leads: '🎯', estimates: '📋', reviews: '⭐',
};

export default function BillingPage() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const activeModules  = useActiveModules();
  const [loading, setLoading] = useState(false);

  const highlightedModule = params.get('module') as ModuleName | null;

  const openStripePortal = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: { returnUrl: window.location.href },
      });
      if (error) throw error;
      window.location.href = data.url;
    } catch (err) {
      console.error('Stripe portal error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader title="Plan & Billing" onBack={() => navigate('/settings')} />

      {/* Current plan */}
      <Section title="Active Modules">
        {activeModules.length === 0 ? (
          <Card elevation="raised" padding="md">
            <p className="text-field-sm text-content-secondary">No modules active. Choose a plan below.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {activeModules.map(m => (
              <Card key={m} elevation="flat" padding="sm">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{MODULE_ICONS[m]}</span>
                  <div>
                    <p className="font-semibold text-field-sm text-content">{MODULE_DISPLAY_NAMES[m]}</p>
                    <p className="text-field-xs text-content-muted">{MODULE_TAGLINES[m]}</p>
                  </div>
                  <Badge variant="success" className="ml-auto">Active</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* Available modules */}
      <Section title="Add Modules">
        <div className="flex flex-col gap-3">
          {(['leads', 'estimates', 'reviews'] as ModuleName[])
            .filter(m => !activeModules.includes(m))
            .map(m => (
              <Card
                key={m}
                elevation="raised"
                padding="md"
                className={highlightedModule === m ? 'ring-2 ring-accent' : ''}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">{MODULE_ICONS[m]}</span>
                  <div className="flex-1">
                    <p className="font-bold text-field-base text-content">{MODULE_DISPLAY_NAMES[m]}</p>
                    <p className="text-field-xs text-content-secondary">{MODULE_TAGLINES[m]}</p>
                  </div>
                  <p className="font-mono font-semibold text-money-sm text-content shrink-0">
                    ${MODULE_PRICES_STANDALONE[m]}/mo
                  </p>
                </div>
                <Button variant="accent" size="md" fullWidth onClick={openStripePortal} loading={loading}>
                  Add {MODULE_DISPLAY_NAMES[m]}
                </Button>
              </Card>
            ))}
        </div>
      </Section>

      {/* Bundle pricing */}
      <Section title="Bundle Deals">
        <Card elevation="raised" padding="md">
          <p className="text-field-xs text-content-muted mb-3">All three modules together:</p>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-field-base text-content">TradeSuite Pro</p>
            <p className="font-mono font-bold text-money-base text-brand">$149/mo</p>
          </div>
          <p className="text-field-xs text-content-muted mb-4">Save $28/month vs. individual pricing</p>
          <Button variant="primary" fullWidth onClick={openStripePortal} loading={loading}>
            Upgrade to Pro
          </Button>
        </Card>
      </Section>

      {/* Manage existing subscription */}
      {activeModules.length > 0 && (
        <Section>
          <Button variant="secondary" fullWidth onClick={openStripePortal} loading={loading}>
            Manage Subscription
          </Button>
          <p className="text-field-xs text-content-muted text-center mt-2">
            Update payment method, cancel, or change plans
          </p>
        </Section>
      )}
    </div>
  );
}
