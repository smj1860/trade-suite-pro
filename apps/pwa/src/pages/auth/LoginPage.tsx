import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../../providers';
import { Button, Field, Input } from '@trades-saas/core-ui';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface">
      {/* Header */}
      <div className="bg-brand px-6 pt-16 pb-10">
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
          <span className="text-2xl">🔧</span>
        </div>
        <h1 className="font-display font-bold text-field-2xl text-white">TradeSuite</h1>
        <p className="text-field-sm text-white/70 mt-1">Sign in to your account</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 py-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-sm">
          <Field label="Email" >
            <Input
              type="email"
              placeholder="you@yourbusiness.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              required
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3">
              <p className="text-field-sm text-danger font-medium">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
          >
            Sign In
          </Button>

          <button
            type="button"
            className="text-field-sm text-brand font-medium text-center py-2 touch-manipulation"
            onClick={() => navigate('/auth/forgot-password')}
          >
            Forgot your password?
          </button>
        </form>
      </div>

      <p className="text-center text-field-xs text-content-muted px-6 pb-8">
        Need an account?{' '}
        <a href="https://tradesuite.com/signup" className="text-brand font-medium">
          Get started
        </a>
      </p>
    </div>
  );
}
