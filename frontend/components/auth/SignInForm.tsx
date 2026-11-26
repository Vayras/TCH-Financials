'use client';

import * as React from 'react';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import Icon from '@/components/ui/Icon';
import styles from './SignIn.module.css';

// 'signed-in' is optimistic: once the password is accepted we show success
// straight away and stay in that state while AuthGuard loads the profile and
// navigates, instead of flashing back to an idle form.
type Phase = 'idle' | 'signing-in' | 'signed-in';

// If the guard hasn't moved us on by then, something went wrong loading the
// profile; hand the form back rather than spinning forever.
const OPEN_WORKSPACE_TIMEOUT_MS = 12_000;

const NETWORK_ERROR = 'We couldn’t reach the sign-in service. Check your connection and try again.';

// Supabase's messages are terse and technical; say what to do next instead.
function friendlyError(message: string) {
  const m = message.toLowerCase();
  // supabase-js reports network failures as an error result, not a throw.
  if (m.includes('failed to fetch') || m.includes('network')) return NETWORK_ERROR;
  if (m.includes('invalid login credentials'))
    return 'That email and password don’t match. Check them and try again.';
  if (m.includes('email not confirmed'))
    return 'Confirm your email address first. Check your inbox for the link we sent.';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Too many attempts. Wait a minute, then try again.';
  return message;
}

export interface SignInContent {
  subtitle: string;
  // Footer link for people without an account.
  signupHref: string;
  panel: {
    eyebrow: string;
    title: string;
    features: { icon: string; text: string }[];
  };
}

// Shared by the team sign-in (/login) and the creator sign-in (/creator/login).
// Routing after sign-in is AuthGuard's job, based on the profile's role.
export default function SignInForm({ content }: { content: SignInContent }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const passwordRef = React.useRef<HTMLInputElement>(null);
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
        setError(friendlyError(error.message));
        setPhase('idle');
        // Roll back: keep the email, clear the password and put the cursor there.
        setPassword('');
        requestAnimationFrame(() => passwordRef.current?.focus());
        return;
      }
      // AuthGuard's onAuthStateChange handles routing based on profile status.
      // We do NOT redirect here to avoid a flicker for pending/rejected users.
      setPhase('signed-in');
    } catch {
      setError(NETWORK_ERROR);
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
          <p className={styles.subtitle}>{content.subtitle}</p>

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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className={styles.input}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                ref={passwordRef}
                className={`${styles.input} ${styles.inputWithAction}`}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
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
            <p id="login-error" role="alert" className={styles.error}>
              <Icon name="info" size={15} />
              <span>{error}</span>
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
            New here? <Link href={content.signupHref}>Request access</Link>
          </p>
        </form>

        <aside className={styles.aside} aria-hidden="true">
          <div>
            <p className={styles.asideEyebrow}>{content.panel.eyebrow}</p>
            <p className={styles.asideTitle}>{content.panel.title}</p>
          </div>
          <ul className={styles.asideList}>
            {content.panel.features.map((f) => (
              <li key={f.text}>
                <span>
                  <Icon name={f.icon} size={15} />
                </span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
