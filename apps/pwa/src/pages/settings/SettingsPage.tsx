import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, Section, Card, Button } from '@trades-saas/core-ui';
import { useAuth, signOut } from '../../providers';
import { icalFeedUrl } from '@trades-saas/core-types';
import { getSupabaseClient } from '@trades-saas/core-auth';

const supabase = getSupabaseClient();

export default function SettingsPage() {
  const navigate        = useNavigate();
  const { user, org }   = useAuth();
  const [copied, setCopied] = useState(false);

  // Review settings state
  const [googleUrl,    setGoogleUrl]    = useState((org as any)?.google_review_url    ?? '');
  const [yelpUrl,      setYelpUrl]      = useState((org as any)?.yelp_review_url      ?? '');
  const [facebookUrl,  setFacebookUrl]  = useState((org as any)?.facebook_review_url  ?? '');
  const [delayHours,   setDelayHours]   = useState<number>((org as any)?.review_delay_hours ?? 2);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewSaved,  setReviewSaved]  = useState(false);

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

  const saveReviewSettings = async () => {
    if (!org?.id) return;
    setSavingReview(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('organizations') as any)
        .update({
          google_review_url:   googleUrl   || null,
          yelp_review_url:     yelpUrl     || null,
          facebook_review_url: facebookUrl || null,
          review_delay_hours:  delayHours,
        })
        .eq('id', org.id);
      if (error) throw error;
      setReviewSaved(true);
      setTimeout(() => setReviewSaved(false), 2000);
    } finally {
      setSavingReview(false);
    }
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

      {/* RepuGuard — Review Links */}
      <Section title="Review Links (RepuGuard)">
        <Card elevation="raised" padding="md">
          <p className="text-field-xs text-content-muted mb-4">
            Paste your direct review page URLs. These are sent to customers after each completed job.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">
                Google Review URL
              </label>
              <input
                type="url"
                value={googleUrl}
                onChange={e => setGoogleUrl(e.target.value)}
                placeholder="https://g.page/r/your-business/review"
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
              />
            </div>
            <div>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">
                Yelp Review URL
              </label>
              <input
                type="url"
                value={yelpUrl}
                onChange={e => setYelpUrl(e.target.value)}
                placeholder="https://www.yelp.com/biz/your-business"
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
              />
            </div>
            <div>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">
                Facebook Review URL
              </label>
              <input
                type="url"
                value={facebookUrl}
                onChange={e => setFacebookUrl(e.target.value)}
                placeholder="https://www.facebook.com/your-page/reviews"
                className="w-full bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none placeholder:text-content-muted"
              />
            </div>
            <div>
              <label className="block text-field-xs font-semibold text-content-secondary mb-1">
                Send review request (hours after job completion)
              </label>
              <input
                type="number"
                min={0}
                max={168}
                value={delayHours}
                onChange={e => setDelayHours(Number(e.target.value))}
                className="w-28 bg-surface-sunken text-content text-field-sm rounded-input px-3 py-2.5
                           border border-surface-border focus:border-brand outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              size="sm"
              onClick={saveReviewSettings}
              disabled={savingReview}
            >
              {reviewSaved ? '✓ Saved' : savingReview ? 'Saving…' : 'Save Review Settings'}
            </Button>
          </div>
        </Card>
      </Section>

      {/* Price Book */}
      <Section title="Price Book">
        <Card elevation="raised" padding="md" pressable onClick={() => navigate('/settings/price-book')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-field-sm text-content">Manage Price Book</p>
              <p className="text-field-xs text-content-muted">Add, edit, or deactivate line items</p>
            </div>
            <span className="text-content-muted">›</span>
          </div>
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
