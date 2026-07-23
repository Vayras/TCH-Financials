'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/api';

export default function PendingPage() {
	const router = useRouter();
	const [email, setEmail] = React.useState<string>('');
	const [status, setStatus] = React.useState<string>('pending');

	React.useEffect(() => {
		const supabase = getSupabase();
		let active = true;
		let channel: any = null;

		async function init() {
			const { data: { session } } = await supabase.auth.getSession();
			if (!session) {
				router.replace('/login');
				return;
			}

			if (!active) return;
			setEmail(session.user.email ?? '');

			try {
				const info = await api.get<{ status: string }>('/auth/me');
				setStatus(info.status);
				if (info.status === 'approved') {
					router.replace('/');
					return;
				}
			} catch (err) {
				console.error('Failed to fetch status', err);
			}

			channel = supabase
				.channel(`profile-status-${session.user.id}`)
				.on(
					'postgres_changes',
					{
						event: 'UPDATE',
						schema: 'public',
						table: 'tch_profile',
						filter: `id=eq.${session.user.id}`,
					},
					(payload) => {
						if (active) {
							setStatus(payload.new.status);
							if (payload.new.status === 'approved') {
								router.replace('/');
							}
						}
					}
				)
				.subscribe();
		}

		init();

		return () => {
			active = false;
			if (channel) {
				supabase.removeChannel(channel);
			}
		};
	}, [router]);

	async function handleSignOut() {
		await getSupabase().auth.signOut();
		router.replace('/login');
	}

	return (
		<div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--n-bg)' }}>
			<div
				className="w-full max-w-[400px] rounded-lg p-8 text-center"
				style={{ background: 'var(--n-bg-soft)', border: '1px solid var(--n-border)' }}
			>
				<div className="flex justify-center mb-6">
					<div
						className="h-12 w-12 rounded flex items-center justify-center text-[20px] font-semibold animate-pulse"
						style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
					>
						T
					</div>
				</div>

				<h1 className="text-[18px] font-semibold mb-2">Access Pending Approval</h1>
				
				<p className="text-[13.5px] leading-relaxed mb-6" style={{ color: 'var(--n-fg-subtle)' }}>
					Your account <span className="font-semibold">{email}</span> has been registered and is pending approval by an admin.
				</p>

				<div className="rounded p-4 mb-6 text-left border" style={{ borderColor: 'var(--n-border)' }}>
					<div className="flex items-center justify-between text-[13px]">
						<span style={{ color: 'var(--n-fg-subtle)' }}>Status</span>
						<span className="font-semibold uppercase tracking-wider text-[11px] px-2 py-0.5 rounded" style={{
							background: status === 'rejected' ? '#ffebeb' : '#fff8e6',
							color: status === 'rejected' ? '#d1242f' : '#b27a00',
						}}>
							{status}
						</span>
					</div>
				</div>

				{status === 'rejected' ? (
					<p className="text-[13px] mb-6 text-red-600">
						Your request has been declined. Please contact the administrator.
					</p>
				) : (
					<p className="text-[12.5px] mb-6" style={{ color: 'var(--n-fg-subtle)' }}>
						This page will redirect automatically as soon as your access is approved.
					</p>
				)}

				<button
					type="button"
					onClick={handleSignOut}
					className="w-full h-9 rounded text-[13.5px] font-medium transition-opacity"
					style={{ background: 'var(--n-fg)', color: 'var(--n-bg)' }}
				>
					Sign Out
				</button>
			</div>
		</div>
	);
}
