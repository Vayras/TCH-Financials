'use client';

import * as React from 'react';
import { getSupabase } from '@/lib/supabase';
import Icon from '@/components/ui/Icon';

interface ChangePasswordModalProps {
	isOpen: boolean;
	onClose: () => void;
	userEmail: string;
}

export function ChangePasswordModal({ isOpen, onClose, userEmail }: ChangePasswordModalProps) {
	const [currentPassword, setCurrentPassword] = React.useState('');
	const [newPassword, setNewPassword] = React.useState('');
	const [confirmPassword, setConfirmPassword] = React.useState('');

	const [showCurrent, setShowCurrent] = React.useState(false);
	const [showNew, setShowNew] = React.useState(false);
	const [showConfirm, setShowConfirm] = React.useState(false);

	const [error, setError] = React.useState<string | null>(null);
	const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);

	React.useEffect(() => {
		if (isOpen) {
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setShowCurrent(false);
			setShowNew(false);
			setShowConfirm(false);
			setError(null);
			setSuccessMsg(null);
			setBusy(false);
		}
	}, [isOpen]);

	if (!isOpen) return null;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccessMsg(null);

		if (!currentPassword) {
			setError('Please enter your current password.');
			return;
		}
		if (newPassword.length < 6) {
			setError('New password must be at least 6 characters.');
			return;
		}
		if (newPassword !== confirmPassword) {
			setError('New passwords do not match.');
			return;
		}
		if (currentPassword === newPassword) {
			setError('New password must be different from current password.');
			return;
		}

		setBusy(true);
		try {
			const supabase = getSupabase();

			// 1. Re-authenticate with current password to verify identity
			if (userEmail) {
				const { error: signInErr } = await supabase.auth.signInWithPassword({
					email: userEmail,
					password: currentPassword,
				});

				if (signInErr) {
					setError('Current password is incorrect.');
					setBusy(false);
					return;
				}
			}

			// 2. Update password in Supabase
			const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
			if (updateErr) {
				setError(updateErr.message);
				setBusy(false);
				return;
			}

			setSuccessMsg('✓ Password updated successfully!');
			setTimeout(() => {
				onClose();
			}, 1500);
		} catch (err: any) {
			setError(err?.message || 'Failed to change password. Please try again.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
			<div
				className="w-full max-w-[400px] rounded-lg p-6 shadow-xl border"
				style={{ background: 'var(--n-bg-soft)', borderColor: 'var(--n-border)' }}
			>
				<div className="flex items-center justify-between mb-5">
					<div className="flex items-center gap-2">
						<span style={{ color: 'var(--n-fg)' }}>
							<Icon name="key" size={18} />
						</span>
						<h2 className="text-[15px] font-semibold" style={{ color: 'var(--n-fg)' }}>
							Change Password
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="h-7 w-7 rounded flex items-center justify-center transition-colors"
						style={{ color: 'var(--n-fg-subtle)' }}
						onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
						onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
					>
						<Icon name="x" size={16} />
					</button>
				</div>

				{successMsg ? (
					<div className="py-6 text-center">
						<p className="text-[14px] font-medium mb-1" style={{ color: 'var(--n-accent, #10b981)' }}>
							{successMsg}
						</p>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
								Current Password
							</label>
							<div className="relative">
								<input
									type={showCurrent ? 'text' : 'password'}
									required
									autoFocus
									value={currentPassword}
									onChange={(e) => setCurrentPassword(e.target.value)}
									className="w-full h-9 rounded px-3 pr-9 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
									placeholder="Enter current password"
								/>
								<button
									type="button"
									onClick={() => setShowCurrent((v) => !v)}
									className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--n-fg-subtle)] hover:text-[var(--n-fg)] transition-colors"
									tabIndex={-1}
									title={showCurrent ? 'Hide password' : 'Show password'}
								>
									<Icon name={showCurrent ? 'eye-off' : 'eye'} size={15} />
								</button>
							</div>
						</div>

						<div>
							<label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
								New Password
							</label>
							<div className="relative">
								<input
									type={showNew ? 'text' : 'password'}
									required
									value={newPassword}
									onChange={(e) => setNewPassword(e.target.value)}
									className="w-full h-9 rounded px-3 pr-9 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
									placeholder="Min. 6 characters"
								/>
								<button
									type="button"
									onClick={() => setShowNew((v) => !v)}
									className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--n-fg-subtle)] hover:text-[var(--n-fg)] transition-colors"
									tabIndex={-1}
									title={showNew ? 'Hide password' : 'Show password'}
								>
									<Icon name={showNew ? 'eye-off' : 'eye'} size={15} />
								</button>
							</div>
						</div>

						<div>
							<label className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
								Confirm New Password
							</label>
							<div className="relative">
								<input
									type={showConfirm ? 'text' : 'password'}
									required
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="w-full h-9 rounded px-3 pr-9 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
									placeholder="Re-enter new password"
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
							<p className="text-[12.5px]" style={{ color: 'var(--n-danger, #ef4444)' }}>
								{error}
							</p>
						)}

						<div className="flex items-center justify-end gap-2 pt-2">
							<button
								type="button"
								onClick={onClose}
								className="h-8 px-3 rounded text-[13px] font-medium border border-[var(--n-border)] transition-colors"
								style={{ color: 'var(--n-fg)' }}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={busy}
								className="h-8 px-4 rounded text-[13px] font-medium transition-opacity disabled:opacity-60"
								style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
							>
								{busy ? 'Updating…' : 'Update Password'}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

export default ChangePasswordModal;
