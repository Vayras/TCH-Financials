'use client';

import * as React from 'react';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import Icon from '@/components/ui/Icon';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      // AuthGuard's onAuthStateChange handles routing based on profile status.
      // We do NOT redirect here to avoid a flicker for pending/rejected users.
    } finally {
      setBusy(false);
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
        <form onSubmit={submit} className={styles.form}>
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
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
            </span>
          </label>

          {error && (
            <p className="mb-2 text-[13px]" style={{ color: 'var(--color-danger)' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={styles.submit}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

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
