'use client';

import * as React from 'react';
import { useAuth } from '@/components/AuthGuard';
import { useUpdateProfileMutation, ROLE_LABELS } from '../users/queries';
import Button from '@/components/ui/Button';
import Label from '@/components/ui/Label';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';

export default function ProfilePage() {
	const { email, role, status, displayName } = useAuth();
	const updateProfileMutation = useUpdateProfileMutation();

	const [name, setName] = React.useState(displayName || '');

	React.useEffect(() => {
		if (displayName) setName(displayName);
	}, [displayName]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) {
			toast.error('Display Name cannot be empty.');
			return;
		}

		try {
			await updateProfileMutation.mutateAsync({ displayName: name });
			toast.success('Profile updated successfully.', {
				description: 'Please reload or re-login to see name updates across all dashboards.'
			});
		} catch (err: any) {
			toast.error('Failed to update profile.', { description: err.message });
		}
	}

	return (
		<div className="space-y-6 max-w-2xl">
			<PageHeader title="My Profile Settings" description="View account permissions and customize display parameters." />

			<div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
				{/* Account Overview details */}
				<div className="grid grid-cols-2 gap-4 pb-6 border-b border-gray-100">
					<div>
						<span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Email Address</span>
						<span className="text-[13.5px] font-semibold text-gray-800 block mt-0.5">{email || '—'}</span>
					</div>
					<div>
						<span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Assigned Role</span>
						<span className="text-[13px] font-semibold text-gray-800 block mt-0.5">
							{ROLE_LABELS[role] ?? role}
						</span>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label>Display Name</Label>
						<input
							type="text"
							required
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full h-9 rounded px-3 text-[13.5px] bg-white border border-gray-300 focus:outline-none focus:border-[#7e22ce] mt-1"
							placeholder="e.g. Riya Kapoor"
						/>
						<p className="text-[11.5px] text-gray-400 mt-1">
							This name will be displayed in the sidebar menu and logs.
						</p>
					</div>

					<Button
						type="submit"
						variant="primary"
						disabled={updateProfileMutation.isPending}
						className="w-full sm:w-auto h-9"
					>
						{updateProfileMutation.isPending ? 'Saving changes…' : 'Save Settings'}
					</Button>
				</form>
			</div>
		</div>
	);
}
