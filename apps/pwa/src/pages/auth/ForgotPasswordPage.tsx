import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Input } from '@trades-saas/core-ui';
import { getSupabaseClient } from '@trades-saas/core-auth';

const supabase = getSupabaseClient();

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface">
      <div className="bg-brand px-6 pt-16 pb-10">
        <h1 className="font-bold text-field-2xl text-white">Reset Password</h1>
        <p className="text-field-sm text-white/70 mt-1">We'll send you a reset link</p>
      </div>

      <div className="flex-1 px-6 py-8">
        {sent ? (
          <div className="max-w-sm">
            <div className="bg-surface-raised border border-success/20 rounded-card p-4 mb-6">
              <p className="text-field-sm text-success font-semibold">Check your email</p>
              <p className="text-field-xs text-content-secondary mt-1">
                We sent a password reset link to {email}
              </p>
            </div>
            <Button variant="secondary" fullWidth onClick={() => navigate('/auth/login')}>
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-sm">
            <Field label="Email">
              <Input
                type="email"
                placeholder="you@yourbusiness.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>

            {error && (
              <div className="bg-surface-raised border border-danger/20 rounded-card px-4 py-3">
                <p className="text-field-sm text-danger">{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Send Reset Link
            </Button>

            <button
              type="button"
              className="text-field-sm text-brand font-medium text-center py-2 touch-manipulation"
              onClick={() => navigate('/auth/login')}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
