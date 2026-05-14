import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Section, Card, Button } from '@trades-saas/core-ui';
import { useAuth, signOut } from '../../providers';
import { icalFeedUrl } from '@trades-saas/core-types';

export default function SettingsPage() {
  const navigate        = useNavigate();
  const { user, org }   = useAuth();
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login', { replace: true });
  };

  const calToken = ''; // loaded from calendar_integrations table in module session
  const feedUrl  = calToken ? icalFeedUrl(calToken) : null;

  const copyFeedUrl = async () => {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader title="Settings" />

      {/* Profile */}
      <Section title="Profile">
        <Card elevation="raised" padding="md">
          <p className="font-semibold text-field-base text-content">{user?.name}</p>
          <p className="text-field-sm text-content-secondary">{user?.email}</p>
          <p className="text-field-xs text-content-muted mt-1 capitalize">{user?.role} — {org?.name}</p>
        </Card>
      </Section>

      {/* Google Calendar */}
      <Section title="Google Calendar">
        <Card elevation="raised" padding="md">
          <p className="text-field-sm text-content font-medium mb-1">Sync jobs to your calendar</p>
          <p className="text-field-xs text-content-muted mb-3">
            Subscribe to your TradeSuite job schedule in Google Calendar, Apple Calendar, or Outlook.
          </p>
          {feedUrl ? (
            <>
              <div className="bg-surface-sunken rounded-input px-3 py-2 mb-3">
                <p className="font-mono text-[11px] text-content-secondary break-all">{feedUrl}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={copyFeedUrl} fullWidth>
                  {copied ? '✓ Copied' : 'Copy Link'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open('https://support.tradesuite.com/calendar', '_blank')}
                >
                  How to add
                </Button>
              </div>
            </>
          ) : (
            <Button variant="secondary" size="sm">
              Generate Calendar Link
            </Button>
          )}
        </Card>
      </Section>

      {/* Billing */}
      <Section title="Plan & Billing">
        <Card elevation="raised" padding="md" pressable onClick={() => navigate('/settings/billing')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-field-sm text-content">Manage Plan</p>
              <p className="text-field-xs text-content-muted">Add or remove modules</p>
            </div>
            <span className="text-content-muted">›</span>
          </div>
        </Card>
      </Section>

      {/* Danger zone */}
      <Section>
        <Button variant="danger" fullWidth onClick={handleSignOut}>
          Sign Out
        </Button>
      </Section>
    </div>
  );
}
