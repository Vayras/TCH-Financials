'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export default function LoginPage() {
	const router = useRouter();
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
			<div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--n-bg)' }}>
				<p className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
					Auth is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing).
				</p>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--n-bg)' }}>
			<form
				onSubmit={submit}
				className="w-full max-w-[360px] rounded-lg p-8"
				style={{ background: 'var(--n-bg-soft)', border: '1px solid var(--n-border)' }}
			>
				<div className="flex items-center gap-2.5 mb-6">
					<div
						className="h-8 w-8 rounded flex items-center justify-center text-[15px] font-semibold"
						style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
					>
						T
					</div>
					<div>
						<div className="text-[15px] font-semibold leading-tight">TCH Financials</div>
						<div className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
							Sign in to continue
						</div>
					</div>
				</div>

				<label className="block mb-3">
					<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
						Email
					</span>
					<input
						type="email"
						required
						autoFocus
						autoComplete="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
					/>
				</label>

				<label className="block mb-5">
					<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
						Password
					</span>
					<input
						type="password"
						required
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
					/>
				</label>

				{error && (
					<p className="mb-4 text-[12.5px]" style={{ color: 'var(--n-danger, #d1242f)' }}>
						{error}
					</p>
				)}

				<button
					type="submit"
					disabled={busy}
					className="w-full h-9 rounded text-[13.5px] font-medium transition-opacity disabled:opacity-60"
					style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
				>
					{busy ? 'Signing in…' : 'Sign in'}
				</button>
			</form>
		</div>
	);
}
