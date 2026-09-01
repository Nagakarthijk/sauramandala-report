'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';

export function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/workspace';

  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'sign_in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push(next);
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setCheckEmail(true);
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-5">
          <div>
            <h1 className="font-heading text-2xl">TFFP Platform</h1>
            <p className="text-sm text-ink/60">
              {mode === 'sign_in' ? 'Sign in to your workspace.' : 'Create an account.'}
            </p>
          </div>

          {checkEmail ? (
            <p className="text-sm text-forest">
              Check your email for a confirmation link, then sign in.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'sign_in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error ? <p className="text-sm text-rust">{error}</p> : null}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Please wait…' : mode === 'sign_in' ? 'Sign in' : 'Sign up'}
              </Button>
            </form>
          )}

          <div className="flex items-center gap-2 text-xs text-ink/40">
            <div className="h-px flex-1 bg-ink/10" />
            or
            <div className="h-px flex-1 bg-ink/10" />
          </div>

          <Button variant="secondary" className="w-full" onClick={handleGoogle} type="button">
            Continue with Google
          </Button>

          <button
            type="button"
            className="w-full text-center text-xs text-ink/50 hover:underline"
            onClick={() => {
              setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in');
              setError(null);
              setCheckEmail(false);
            }}
          >
            {mode === 'sign_in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
