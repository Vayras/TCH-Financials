'use client';

import * as React from 'react';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import Icon from '@/components/ui/Icon';
import styles from './login.module.css';

// 'signed-in' is optimistic: once the password is accepted we show success
// straight away and stay in that state while AuthGuard loads the profile and
// navigates, instead of flashing back to an idle form.
type Phase = 'idle' | 'signing-in' | 'signed-in';

// If the guard hasn't moved us on by then, something went wrong loading the
// profile; hand the form back rather than spinning forever.
const OPEN_WORKSPACE_TIMEOUT_MS = 12_000;

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const busy = phase !== 'idle';

  React.useEffect(() => {
    if (phase !== 'signed-in') return;
    const timer = window.setTimeout(() => {
      setPhase('idle');
      setError('You’re signed in, but we couldn’t open your workspace. Please try again.');
    }, OPEN_WORKSPACE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setPhase('signing-in');
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setPhase('idle');
        return;
      }
      // AuthGuard's onAuthStateChange handles routing based on profile status.
      // We do NOT redirect here to avoid a flicker for pending/rejected users.
      setPhase('signed-in');
    } catch {
      setError('We couldn’t reach the sign-in service. Check your connection and try again.');
      setPhase('idle');
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--n-bg)' }}
      >
        <p className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
          Auth is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).
        </p>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.card} anim-fade-up`}>
        {busy && <span className={styles.progress} aria-hidden="true" />}
        <form onSubmit={submit} className={styles.form} aria-busy={busy}>
          <div className={styles.brandRow}>
            <span className={styles.logo} aria-hidden="true">
              T
            </span>
            TCH Financials
          </div>

          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your TCH workspace.</p>

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <span className={styles.inputWrap}>
              <Icon name="mail" size={16} className={styles.inputIcon} />
              <input
                type="email"
                required
                autoFocus
                disabled={busy}
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <span className={styles.inputWrap}>
              <Icon name="lock" size={16} className={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={busy}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${styles.input} ${styles.inputWithAction}`}
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>

          {error && (
            <p className="mb-2 text-[13px]" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`${styles.submit} ${phase === 'signed-in' ? styles.submitDone : ''}`}
          >
            {phase === 'signing-in' && <span className={styles.spinner} aria-hidden="true" />}
            {phase === 'signed-in' && <Icon name="check" size={16} />}
            {phase === 'signing-in'
              ? 'Signing in…'
              : phase === 'signed-in'
                ? 'Signed in · opening your workspace…'
                : 'Sign in'}
          </button>
          <p className="sr-only" role="status" aria-live="polite">
            {phase === 'signing-in'
              ? 'Signing in'
              : phase === 'signed-in'
                ? 'Signed in. Opening your workspace.'
                : ''}
          </p>

          <p className={styles.footer}>
            New here? <Link href="/signup">Request access</Link>
          </p>
        </form>

        <aside className={styles.aside} aria-hidden="true">
          <div>
            <p className={styles.asideEyebrow}>The Creative Hook</p>
            <p className={styles.asideTitle}>
              Campaigns, deals and creator payouts, all in one place.
            </p>
          </div>
          <ul className={styles.asideList}>
            <li>
              <span>
                <Icon name="briefcase" size={15} />
              </span>
              <span>Track every brand deal and campaign</span>
            </li>
            <li>
              <span>
                <Icon name="pie" size={15} />
              </span>
              <span>See agency fees and payouts at a glance</span>
            </li>
            <li>
              <span>
                <Icon name="users" size={15} />
              </span>
              <span>Work alongside creators in their portal</span>
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
