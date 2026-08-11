'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { api } from '@/lib/api';

export default function SignupPage() {
	const router = useRouter();
	const [name, setName] = React.useState('');
	const [email, setEmail] = React.useState('');
	const [password, setPassword] = React.useState('');
	const [role, setRole] = React.useState<'creator' | 'tch_member'>('creator');
	
	const [error, setError] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);
	const [success, setSuccess] = React.useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setBusy(true);

		try {
			// 1. Sign up on Supabase Auth
			const supabase = getSupabase();
			const { data, error: signUpError } = await supabase.auth.signUp({
				email,
				password,
			});

			if (signUpError) {
				setError(signUpError.message);
				setBusy(false);
				return;
			}

			const user = data.user;
			if (!user) {
				setError('Signup failed. Please try again.');
				setBusy(false);
				return;
			}

			// 2. Create local profile matching user ID and selection
			await api.post('/auth/signup-profile', {
				userId: user.id,
				email: email,
				displayName: name,
				role: role,
			});

			setSuccess(true);
		} catch (e: any) {
			setError(e.message || 'Something went wrong during sign-up.');
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

	if (success) {
		return (
			<div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--n-bg)' }}>
				<div
					className="w-full max-w-[400px] rounded-lg p-8 text-center"
					style={{ background: 'var(--n-bg-soft)', border: '1px solid var(--n-border)' }}
				>
					<div
						className="h-12 w-12 rounded-full flex items-center justify-center text-[20px] mx-auto mb-4"
						style={{ background: '#dcfce7', color: '#15803d' }}
					>
						✓
					</div>
					<h3 className="text-[16px] font-semibold mb-2">Request Submitted</h3>
					<p className="text-[13px] leading-relaxed mb-6" style={{ color: 'var(--n-fg-subtle)' }}>
						Your account registration request for **{role === 'creator' ? 'Creator' : 'TCH Member'}** access is pending admin approval. You will be able to log in once approved.
					</p>
					<Link
						href="/login"
						className="inline-flex items-center justify-center w-full h-9 rounded text-[13.5px] font-medium"
						style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
					>
						Return to Sign In
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--n-bg)' }}>
			<form
				onSubmit={submit}
				className="filter-popover w-full max-w-[420px] rounded-xl p-8 shadow-lg anim-fade-up"
			>
				<div className="flex items-center gap-2.5 mb-6">
					<div
						className="h-8 w-8 rounded flex items-center justify-center text-[15px] font-semibold select-none shadow-sm"
						style={{ background: 'var(--n-fg)', color: 'var(--n-bg)', boxShadow: '0 2px 4px rgba(0,0,0,0.12)' }}
					>
						T
					</div>
					<div>
						<div className="text-[15px] font-semibold leading-tight">TCH Financials</div>
						<div className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
							Request access to your workspace
						</div>
					</div>
				</div>

				<label className="block mb-3">
					<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
						Full Name
					</span>
					<input
						type="text"
						required
						autoFocus
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
						placeholder="e.g. Riya Kapoor"
					/>
				</label>

				<label className="block mb-3">
					<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
						Email Address
					</span>
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
						placeholder="e.g. riya@example.com"
					/>
				</label>

				<label className="block mb-4">
					<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
						Password
					</span>
					<input
						type="password"
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
						placeholder="At least 6 characters"
					/>
				</label>

				{/* Role Cards Selector */}
				<div className="mb-6">
					<span className="block text-[12px] font-medium mb-2" style={{ color: 'var(--n-fg-subtle)' }}>
						I am signing up as...
					</span>
					<div className="grid grid-cols-2 gap-3">
						<button
							type="button"
							onClick={() => setRole('creator')}
							className="flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer"
							style={{
								background: role === 'creator' ? 'rgba(88, 28, 135, 0.04)' : 'var(--n-bg)',
								borderColor: role === 'creator' ? '#7e22ce' : 'var(--n-border)',
								color: 'var(--n-fg)'
							}}
						>
							<span className="text-[20px] mb-1">🎬</span>
							<span className="text-[12.5px] font-semibold">Creator</span>
							<span className="text-[10px] opacity-70 mt-0.5">View my payouts &amp; submit invoices</span>
						</button>

						<button
							type="button"
							onClick={() => setRole('tch_member')}
							className="flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer"
							style={{
								background: role === 'tch_member' ? 'var(--n-bg-hover)' : 'var(--n-bg)',
								borderColor: role === 'tch_member' ? 'var(--n-fg)' : 'var(--n-border)',
								color: 'var(--n-fg)'
							}}
						>
							<span className="text-[20px] mb-1">🏢</span>
							<span className="text-[12.5px] font-semibold">TCH Member</span>
							<span className="text-[10px] opacity-70 mt-0.5">Manage deals &amp; operational items</span>
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
					className="w-full h-9 rounded text-[13.5px] font-medium transition-transform duration-100 active:scale-[0.985] disabled:opacity-60 cursor-pointer mb-4"
					style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
				>
					{busy ? 'Creating request…' : 'Submit Registration Request'}
				</button>

				<div className="text-center text-[12px] mt-2">
					<span style={{ color: 'var(--n-fg-subtle)' }}>Already have an account? </span>
					<Link href="/login" className="font-medium underline hover:text-[var(--n-accent)]">
						Sign In
					</Link>
				</div>
			</form>
		</div>
	);
}
