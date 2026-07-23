'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/api';

import Icon from '@/components/ui/Icon';

export default function SetPasswordPage() {
	const router = useRouter();
	const [password, setPassword] = React.useState('');
	const [confirm, setConfirm] = React.useState('');
	const [showPassword, setShowPassword] = React.useState(false);
	const [showConfirm, setShowConfirm] = React.useState(false);

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
			
			// Directly navigate to dashboard so user doesn't have to re-enter login details
			setTimeout(() => {
				router.replace('/');
			}, 1200);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--n-bg)' }}>
			<form
				onSubmit={submit}
				className="w-full max-w-[360px] rounded-lg p-8 shadow-sm"
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
						<p className="text-[14px] font-medium mb-1" style={{ color: 'var(--n-accent, #10b981)' }}>
							✓ Password set successfully
						</p>
						<p className="text-[12.5px]" style={{ color: 'var(--n-fg-subtle)' }}>
							Entering workspace…
						</p>
					</div>
				) : (
					<>
						<p className="text-[12.5px] mb-5 leading-relaxed" style={{ color: 'var(--n-fg-subtle)' }}>
							Welcome! You've been invited to TCH Financials. Please set a password to secure your account.
						</p>

						<div className="mb-3">
							<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
								New Password
							</span>
							<div className="relative">
								<input
									type={showPassword ? 'text' : 'password'}
									required
									autoFocus
									autoComplete="new-password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full h-9 rounded px-3 pr-9 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
									placeholder="Min. 6 characters"
								/>
								<button
									type="button"
									onClick={() => setShowPassword((v) => !v)}
									className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--n-fg-subtle)] hover:text-[var(--n-fg)] transition-colors"
									tabIndex={-1}
									title={showPassword ? 'Hide password' : 'Show password'}
								>
									<Icon name={showPassword ? 'eye-off' : 'eye'} size={15} />
								</button>
							</div>
						</div>

						<div className="mb-5">
							<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
								Confirm Password
							</span>
							<div className="relative">
								<input
									type={showConfirm ? 'text' : 'password'}
									required
									autoComplete="new-password"
									value={confirm}
									onChange={(e) => setConfirm(e.target.value)}
									className="w-full h-9 rounded px-3 pr-9 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
									placeholder="Re-enter password"
								/>
								<button
									type="button"
									onClick={() => setShowConfirm((v) => !v)}
									className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--n-fg-subtle)] hover:text-[var(--n-fg)] transition-colors"
									tabIndex={-1}
									title={showConfirm ? 'Hide password' : 'Show password'}
								>
									<Icon name={showConfirm ? 'eye-off' : 'eye'} size={15} />
								</button>
							</div>
						</div>

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
