'use client';

import * as React from 'react';
import { getSupabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import PageHeader from '@/components/PageHeader';
import { toast } from 'sonner';
import {
	useAdminUsersQuery,
	useApproveUserMutation,
	useRejectUserMutation,
	useRevokeAccessMutation,
	useDeleteUserMutation,
	useUpdateRoleMutation,
	useInviteUserMutation,
	useRemoveInviteMutation,
	type Profile,
	type Invitation,
} from './queries';

interface ConfirmTarget {
	id: string;
	email: string;
	role?: 'admin' | 'member';
}

export default function UsersPage() {
	const [activeTab, setActiveTab] = React.useState<'users' | 'invitations'>('users');
	const [currentUserEmail, setCurrentUserEmail] = React.useState<string>('');

	// React Query hooks
	const { data, isLoading } = useAdminUsersQuery();
	const approveMutation = useApproveUserMutation();
	const rejectMutation = useRejectUserMutation();
	const revokeMutation = useRevokeAccessMutation();
	const deleteMutation = useDeleteUserMutation();
	const updateRoleMutation = useUpdateRoleMutation();
	const inviteMutation = useInviteUserMutation();
	const removeInviteMutation = useRemoveInviteMutation();

	const profiles = data?.profiles ?? [];
	const invitations = data?.invitations ?? [];

	// Dialog states
	const [inviteOpen, setInviteOpen] = React.useState(false);
	const [inviteEmail, setInviteEmail] = React.useState('');
	const [inviteRole, setInviteRole] = React.useState<'admin' | 'member'>('member');

	const [revokeTarget, setRevokeTarget] = React.useState<ConfirmTarget | null>(null);
	const [deleteTarget, setDeleteTarget] = React.useState<ConfirmTarget | null>(null);
	const [removeInviteTarget, setRemoveInviteTarget] = React.useState<ConfirmTarget | null>(null);

	// Action dropdown state
	const [openActionId, setOpenActionId] = React.useState<string | null>(null);

	React.useEffect(() => {
		getSupabase().auth.getSession().then(({ data: { session } }) => {
			if (session?.user?.email) {
				setCurrentUserEmail(session.user.email);
			}
		});
	}, []);

	// Close action dropdown on outside click
	React.useEffect(() => {
		function handleClickOutside() {
			setOpenActionId(null);
		}
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	}, []);

	const invitedEmailSet = React.useMemo(
		() => new Set(invitations.map((inv) => inv.email.toLowerCase())),
		[invitations],
	);

	async function handleRoleChange(id: string, newRole: 'admin' | 'member') {
		try {
			await updateRoleMutation.mutateAsync({ id, role: newRole });
			toast.success(`Role updated to ${newRole}.`);
		} catch (err: any) {
			toast.error(err.message || 'Failed to update role.');
		}
	}

	async function handleApprove(id: string) {
		try {
			await approveMutation.mutateAsync(id);
			toast.success('User access approved.');
		} catch (err: any) {
			toast.error(err.message || 'Approval failed.');
		}
	}

	async function handleReject(id: string) {
		try {
			await rejectMutation.mutateAsync(id);
			toast.success('User access rejected.');
		} catch (err: any) {
			toast.error(err.message || 'Rejection failed.');
		}
	}

	async function confirmRevoke() {
		if (!revokeTarget) return;
		try {
			await revokeMutation.mutateAsync(revokeTarget.id);
			toast.success(`Access revoked for ${revokeTarget.email}.`);
			setRevokeTarget(null);
		} catch (err: any) {
			toast.error(err.message || 'Failed to revoke access.');
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		try {
			await deleteMutation.mutateAsync(deleteTarget.id);
			toast.success(`${deleteTarget.email} permanently deleted.`);
			setDeleteTarget(null);
		} catch (err: any) {
			toast.error(err.message || 'Failed to delete user.');
		}
	}

	async function confirmRemoveInvite() {
		if (!removeInviteTarget) return;
		try {
			await removeInviteMutation.mutateAsync(removeInviteTarget.id);
			toast.success(`Invitation for ${removeInviteTarget.email} removed.`);
			setRemoveInviteTarget(null);
		} catch (err: any) {
			toast.error(err.message || 'Failed to remove invitation.');
		}
	}

	async function submitInvite(e: React.FormEvent) {
		e.preventDefault();
		if (!inviteEmail.trim()) {
			toast.error('Email is required.');
			return;
		}
		try {
			await inviteMutation.mutateAsync({
				email: inviteEmail.trim().toLowerCase(),
				role: inviteRole,
			});
			toast.success(`Invitation sent to ${inviteEmail}`);
			setInviteEmail('');
			setInviteRole('member');
			setInviteOpen(false);
		} catch (err: any) {
			toast.error(err.message || 'Failed to send invite.');
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<PageHeader title="User Management" description="Review signup requests and invite team members." />
				<Button variant="primary" onClick={() => setInviteOpen(true)}>
					<Icon name="plus" size={14} /> Invite User
				</Button>
			</div>

			{/* ─── Tabs ─────────────────────────────────────────────────────── */}
			<div className="flex gap-4 border-b border-[var(--n-border)] pb-px">
				{(['users', 'invitations'] as const).map((tab) => (
					<button
						key={tab}
						type="button"
						onClick={() => setActiveTab(tab)}
						className="pb-2 text-[14px] font-medium transition-colors border-b-2 capitalize"
						style={{
							borderColor: activeTab === tab ? 'var(--n-fg)' : 'transparent',
							color: activeTab === tab ? 'var(--n-fg)' : 'var(--n-fg-subtle)',
						}}
					>
						{tab === 'users' ? `Users (${profiles.length})` : `Invitations (${invitations.length})`}
					</button>
				))}
			</div>

			{/* ─── Tables ───────────────────────────────────────────────────── */}
			{isLoading ? (
				<div className="py-12 text-center text-[13.5px]" style={{ color: 'var(--n-fg-subtle)' }}>
					Loading...
				</div>
			) : (
				<div className="overflow-visible rounded-lg border border-[var(--n-border)] bg-[var(--n-bg-soft)]">
					{activeTab === 'users' ? (
						<table className="w-full text-left border-collapse text-[13px]">
							<thead>
								<tr className="border-b border-[var(--n-border)]" style={{ background: 'var(--n-bg-sidebar)' }}>
									<th className="p-3 font-medium">Email</th>
									<th className="p-3 font-medium">Role</th>
									<th className="p-3 font-medium">Status</th>
									<th className="p-3 font-medium">Joined</th>
									<th className="p-3 font-medium text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{profiles.length === 0 ? (
									<tr>
										<td colSpan={5} className="p-8 text-center text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
											No users found.
										</td>
									</tr>
								) : (
									profiles.map((p) => {
										const wasInvited = invitedEmailSet.has(p.email.toLowerCase());
										const isSelf = p.email.toLowerCase() === currentUserEmail.toLowerCase();
										const isMenuOpen = openActionId === p.id;

										return (
											<tr key={p.id} className="border-b border-[var(--n-border)] last:border-0 bg-[var(--n-bg)]">
												<td className="p-3">
													<div className="flex items-center gap-2">
														<span className="font-medium">{p.email}</span>
														{wasInvited && (
															<span
																className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full"
																style={{
																	background: '#e0e7ff',
																	color: '#4338ca',
																	border: '1px solid #c7d2fe',
																}}
															>
																✉ Invited
															</span>
														)}
													</div>
												</td>
												{/* Role Selector / Display */}
												<td className="p-3">
													{isSelf ? (
														<Tag color={p.role === 'admin' ? 'purple' : 'gray'}>{p.role}</Tag>
													) : (
														<select
															value={p.role}
															disabled={updateRoleMutation.isPending}
															onChange={(e) => handleRoleChange(p.id, e.target.value as 'admin' | 'member')}
															className="h-7 rounded px-2 text-[12px] font-medium bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] cursor-pointer transition-colors"
														>
															<option value="member">member</option>
															<option value="admin">admin</option>
														</select>
													)}
												</td>
												<td className="p-3">
													<Tag color={p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : 'yellow'}>
														{p.status}
													</Tag>
												</td>
												<td className="p-3" style={{ color: 'var(--n-fg-subtle)' }}>
													{new Date(p.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
												</td>
												{/* Action Menu Dropdown */}
												<td className="p-3 text-right relative">
													<div className="relative inline-block text-left">
														<button
															type="button"
															onClick={(e) => {
																e.stopPropagation();
																setOpenActionId(isMenuOpen ? null : p.id);
															}}
															className="h-7 w-7 rounded flex items-center justify-center border border-[var(--n-border)] hover:bg-[var(--n-bg-soft)] transition-colors font-bold text-[14px] leading-none select-none"
															style={{ color: 'var(--n-fg-subtle)' }}
														>
															⋮
														</button>

														{isMenuOpen && (
															<div
																onClick={(e) => e.stopPropagation()}
																className="absolute right-0 mt-1 w-44 rounded-md shadow-lg bg-[var(--n-bg-soft)] border border-[var(--n-border)] z-50 py-1 text-left text-[12.5px]"
															>
																{p.status !== 'approved' && (
																	<button
																		type="button"
																		onClick={() => {
																			setOpenActionId(null);
																			handleApprove(p.id);
																		}}
																		className="w-full text-left px-3 py-1.5 hover:bg-[var(--n-bg)] flex items-center gap-2 text-emerald-600 font-medium"
																	>
																		<Icon name="check" size={13} /> Approve Access
																	</button>
																)}

																{p.status === 'pending' && (
																	<button
																		type="button"
																		onClick={() => {
																			setOpenActionId(null);
																			handleReject(p.id);
																		}}
																		className="w-full text-left px-3 py-1.5 hover:bg-[var(--n-bg)] flex items-center gap-2 text-rose-600"
																	>
																		<Icon name="x" size={13} /> Reject Access
																	</button>
																)}

																{p.status === 'approved' && !isSelf && (
																	<button
																		type="button"
																		onClick={() => {
																			setOpenActionId(null);
																			setRevokeTarget({ id: p.id, email: p.email });
																		}}
																		className="w-full text-left px-3 py-1.5 hover:bg-[var(--n-bg)] flex items-center gap-2 text-amber-600"
																	>
																		<Icon name="lock" size={13} /> Revoke Access
																	</button>
																)}

																{!isSelf && (
																	<>
																		<div className="my-1 border-t border-[var(--n-border)]" />
																		<button
																			type="button"
																			onClick={() => {
																				setOpenActionId(null);
																				setDeleteTarget({ id: p.id, email: p.email });
																			}}
																			className="w-full text-left px-3 py-1.5 hover:bg-[var(--n-bg)] flex items-center gap-2 text-rose-600 font-medium"
																		>
																			<Icon name="trash" size={13} /> Delete User
																		</button>
																	</>
																)}
															</div>
														)}
													</div>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					) : (
						/* ─── Invitations tab ───────────────────────────────────────── */
						<table className="w-full text-left border-collapse text-[13px]">
							<thead>
								<tr className="border-b border-[var(--n-border)]" style={{ background: 'var(--n-bg-sidebar)' }}>
									<th className="p-3 font-medium">Invited Email</th>
									<th className="p-3 font-medium">Assigned Role</th>
									<th className="p-3 font-medium">Sent Date</th>
									<th className="p-3 font-medium">Status</th>
									<th className="p-3 font-medium text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{invitations.length === 0 ? (
									<tr>
										<td colSpan={5} className="p-8 text-center text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
											No invitations sent yet.
										</td>
									</tr>
								) : (
									invitations.map((inv) => (
										<tr key={inv.id} className="border-b border-[var(--n-border)] last:border-0 bg-[var(--n-bg)]">
											<td className="p-3 font-medium">{inv.email}</td>
											<td className="p-3">
												<Tag color={inv.role === 'admin' ? 'purple' : 'gray'}>{inv.role}</Tag>
											</td>
											<td className="p-3" style={{ color: 'var(--n-fg-subtle)' }}>
												{new Date(inv.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
											</td>
											<td className="p-3">
												{inv.acceptedAt ? (
													<span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
														style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
														✓ Accepted {new Date(inv.acceptedAt).toLocaleDateString(undefined, { dateStyle: 'short' })}
													</span>
												) : (
													<span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
														style={{ background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a' }}>
														⏳ Pending
													</span>
												)}
											</td>
											<td className="p-3 text-right">
												<button
													type="button"
													title={inv.acceptedAt ? 'Remove invitation record' : 'Cancel invitation'}
													onClick={() => setRemoveInviteTarget({ id: inv.id, email: inv.email })}
													className="h-7 w-7 rounded flex items-center justify-center transition-colors hover:bg-rose-50 ml-auto"
													style={{ color: '#dc2626', border: '1px solid #fecaca' }}
												>
													<Icon name="trash" size={13} />
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					)}
				</div>
			)}

			{/* ─── Invite User Dialog ──────────────────────────────────────── */}
			<Dialog open={inviteOpen} onOpenChange={setInviteOpen} title="Invite New User" description="Invite team members to access the workspace.">
				<form onSubmit={submitInvite} className="flex flex-col gap-4">
					<label className="block">
						<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
							Email Address
						</span>
						<input
							type="email"
							required
							value={inviteEmail}
							onChange={(e) => setInviteEmail(e.target.value)}
							className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
							placeholder="e.g. user@theculturehub.co.in"
						/>
					</label>
					<label className="block">
						<span className="block text-[12px] font-medium mb-1" style={{ color: 'var(--n-fg-subtle)' }}>
							Role
						</span>
						<select
							value={inviteRole}
							onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
							className="w-full h-9 rounded px-3 text-[13.5px] bg-[var(--n-bg)] text-[var(--n-fg)] border border-[var(--n-border)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
						>
							<option value="member">Member (Standard Workspace access)</option>
							<option value="admin">Admin (Full User and Workspace control)</option>
						</select>
					</label>
					<div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--n-border)]">
						<Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
						<Button variant="primary" type="submit" disabled={inviteMutation.isPending}>
							{inviteMutation.isPending ? 'Inviting...' : 'Send Invitation'}
						</Button>
					</div>
				</form>
			</Dialog>

			{/* ─── Revoke Access Confirmation ──────────────────────────────── */}
			<Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }} title="Revoke Access?" description="">
				<div className="flex flex-col gap-5">
					<div className="rounded-lg p-4 text-[13px] leading-relaxed border"
						style={{ background: 'var(--n-bg)', borderColor: '#f59e0b44' }}>
						<p className="font-medium mb-1" style={{ color: '#b45309' }}>⚠ This will block their access immediately.</p>
						<p style={{ color: 'var(--n-fg-subtle)' }}>
							<strong>{revokeTarget?.email}</strong>'s access will be revoked and active sessions invalidated within
							seconds. You can re-approve them at any time.
						</p>
					</div>
					<div className="flex justify-end gap-2 pt-2 border-t border-[var(--n-border)]">
						<Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revokeMutation.isPending}>Cancel</Button>
						<button type="button" disabled={revokeMutation.isPending} onClick={confirmRevoke}
							className="h-9 px-4 rounded text-[13.5px] font-medium transition-opacity disabled:opacity-60"
							style={{ background: '#d97706', color: '#fff' }}>
							{revokeMutation.isPending ? 'Revoking…' : 'Revoke Access'}
						</button>
					</div>
				</div>
			</Dialog>

			{/* ─── Delete User Confirmation ─────────────────────────────────── */}
			<Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }} title="Delete User?" description="">
				<div className="flex flex-col gap-5">
					<div className="rounded-lg p-4 text-[13px] leading-relaxed border"
						style={{ background: 'var(--n-bg)', borderColor: '#ef444444' }}>
						<p className="font-medium mb-1" style={{ color: '#dc2626' }}>🗑 This action cannot be undone.</p>
						<p style={{ color: 'var(--n-fg-subtle)' }}>
							<strong>{deleteTarget?.email}</strong> will be permanently deleted from the system. They will lose access
							immediately. To restore access, you must send a new invitation.
						</p>
					</div>
					<div className="flex justify-end gap-2 pt-2 border-t border-[var(--n-border)]">
						<Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
						<button type="button" disabled={deleteMutation.isPending} onClick={confirmDelete}
							className="h-9 px-4 rounded text-[13.5px] font-medium transition-opacity disabled:opacity-60"
							style={{ background: '#dc2626', color: '#fff' }}>
							{deleteMutation.isPending ? 'Deleting…' : 'Delete Permanently'}
						</button>
					</div>
				</div>
			</Dialog>

			{/* ─── Remove Invitation Confirmation ──────────────────────────── */}
			<Dialog open={!!removeInviteTarget} onOpenChange={(o) => { if (!o) setRemoveInviteTarget(null); }} title="Remove Invitation?" description="">
				<div className="flex flex-col gap-5">
					<div className="rounded-lg p-4 text-[13px] leading-relaxed border"
						style={{ background: 'var(--n-bg)', borderColor: '#ef444433' }}>
						<p className="font-medium mb-1" style={{ color: '#dc2626' }}>This will remove the invitation record.</p>
						<p style={{ color: 'var(--n-fg-subtle)' }}>
							The invitation for <strong>{removeInviteTarget?.email}</strong> will be removed. If the invitation was
							not yet accepted, the associated Supabase account will also be deleted.
						</p>
					</div>
					<div className="flex justify-end gap-2 pt-2 border-t border-[var(--n-border)]">
						<Button variant="outline" onClick={() => setRemoveInviteTarget(null)} disabled={removeInviteMutation.isPending}>Cancel</Button>
						<button type="button" disabled={removeInviteMutation.isPending} onClick={confirmRemoveInvite}
							className="h-9 px-4 rounded text-[13.5px] font-medium transition-opacity disabled:opacity-60"
							style={{ background: '#dc2626', color: '#fff' }}>
							{removeInviteMutation.isPending ? 'Removing…' : 'Remove Invitation'}
						</button>
					</div>
				</div>
			</Dialog>
		</div>
	);
}
