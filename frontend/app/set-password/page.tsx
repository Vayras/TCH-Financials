'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/api';

export default function SetPasswordPage() {
	const router = useRouter();
	const [password, setPassword] = React.useState('');
	const [confirm, setConfirm] = React.useState('');
	const [error, setError] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);
	const [done, setDone] = React.useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (password.length < 6) {
			setError('Password must be at least 6 characters.');
			return;
		}
		if (password !== confirm) {
			setError('Passwords do not match.');
			return;
		}

		setBusy(true);
		try {
			const supabase = getSupabase();
			const { error } = await supabase.auth.updateUser({ password });
			if (error) {
				setError(error.message);
				return;
			}

			// Inform backend that password has been set so passwordSet = true in DB
			await api.post('/auth/complete-password-setup');
			setDone(true);
			// Sign out the temporary invite session so user logs in cleanly with their new password
			setTimeout(async () => {
				await supabase.auth.signOut();
				router.replace('/login');
			}, 1500);
		} finally {
			setBusy(false);
		}
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
							Set your password to complete sign-up
						</div>
					</div>
				</div>

				{done ? (
					<div className="text-center py-4">
						<p className="text-[14px] font-medium mb-1" style={{ color: 'var(--n-accent)' }}>
							✓ Password set successfully
						</p>
						<p className="text-[12.5px]" style={{ color: 'var(--n-fg-subtle)' }}>
							Redirecting you to sign in…
						</p>
					</div>
				) : (
					<>
						<p className="text-[12.5px] mb-5 leading-relaxed" style={{ color: 'var(--n-fg-subtle)' }}>
							Welcome! You've been invited to TCH Financials. Please set a password to secure your account.
						</p>

						<label className="block mb-3">
							<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
								New Password
							</span>
							<input
								type="password"
								required
								autoFocus
								autoComplete="new-password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
								placeholder="Min. 6 characters"
							/>
						</label>

						<label className="block mb-5">
							<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
								Confirm Password
							</span>
							<input
								type="password"
								required
								autoComplete="new-password"
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
								placeholder="Re-enter password"
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
							{busy ? 'Setting password…' : 'Set Password & Continue'}
						</button>
					</>
				)}
			</form>
		</div>
	);
}
