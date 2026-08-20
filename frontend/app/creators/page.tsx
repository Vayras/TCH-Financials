'use client';

import * as React from 'react';
import { ConflictError, type Creator } from '@/lib/api';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import Dialog from '@/components/ui/Dialog';
import { cn, formatDoj } from '@/lib/utils';
import CreatorFormModal from '@/components/CreatorFormModal';
import DataTable from '@/components/DataTable';
import PageHeader from '@/components/PageHeader';
import FilterToolbar from '@/components/FilterToolbar';
import Pagination from '@/components/Pagination';
import QueryErrorState from '@/components/QueryErrorState';
import useDebounce from '@/hooks/useDebounce';
import { type ColumnDef } from '@tanstack/react-table';
import type { CreatorForm } from '@/types/creator';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';
import Link from 'next/link';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
	EMPTY_FORM,
	REL_FILTERS,
	STATUS_FILTERS,
	relTone,
	statusTone,
	uploadCreatorDocument
} from '@/lib/creators';
import { parseCreatorLinks, serializeCreatorLinks } from '@/lib/creators';
import {
	useCreatorsPageQuery,
	useCreateCreatorMutation,
	useUpdateCreatorMutation,
	useDeleteCreatorMutation,
	useCreateCreatorAccountMutation
} from './queries';
import Label from '@/components/ui/Label';
import { useAuth } from '@/components/AuthGuard';

export default function CreatorsPage() {
	const { role } = useAuth();
	const isAccounts = role === 'accounts';
	const createMutation = useCreateCreatorMutation();
	const updateMutation = useUpdateCreatorMutation();
	const deleteMutation = useDeleteCreatorMutation();
	const createAccountMutation = useCreateCreatorAccountMutation();

	const [addOpen, setAddOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Creator | null>(null);
	const [confirmEditing, setConfirmEditing] = React.useState<Creator | null>(null);

	const [accountTarget, setAccountTarget] = React.useState<Creator | null>(null);
	const [tempPassword, setTempPassword] = React.useState('');
	const [createdCreds, setCreatedCreds] = React.useState<{ email: string; pass: string } | null>(null);
	const [inputEmail, setInputEmail] = React.useState('');
	const [q, setQ] = React.useState('');
	const [relFilter, setRelFilter] = React.useState('All');
	const [statusFilter, setStatusFilter] = React.useState('All');
	const [attachError, setAttachError] = React.useState<string | null>(null);
	const [page, setPage] = React.useState(1);
	const [pageSize, setPageSize] = React.useState(25);
	const debouncedSearch = useDebounce(q.trim(), 500);
	const creatorsQuery = useCreatorsPageQuery({
		page,
		pageSize,
		search: debouncedSearch || undefined,
		relationship: relFilter === 'All' ? undefined : relFilter,
		status: statusFilter === 'All' ? undefined : statusFilter
	});
	const rows = creatorsQuery.data?.items ?? [];
	const total = creatorsQuery.data?.total ?? 0;
	const loading = creatorsQuery.isLoading;
	const error = creatorsQuery.error;

	React.useEffect(() => setPage(1), [debouncedSearch, relFilter, statusFilter, pageSize]);

	function startAdd() {
		setEditing(null);
		setAttachError(null);
		setAddOpen(true);
	}

	function startEdit(r: Creator) {
		setEditing(r);
		setAttachError(null);
		setAddOpen(true);
	}

	async function submit(form: CreatorForm) {
		try {
			const isNonExclusive = form.relation === 'Non-Exclusive';
			const payload = {
				name: form.name,
				category: form.niche,
				relationship: form.relation,
				status: isNonExclusive ? 'Active' : form.status,
				doj: isNonExclusive ? null : (isNaN(form.doj.getTime()) ? null : form.doj.toISOString().slice(0, 10)),
				profile_url: serializeCreatorLinks(form.url),
				location: form.location,
				ops_manager: form.talent_manager,
				email: form.email
			};
			let creatorId: number;
			if (editing) {
				await updateMutation.mutateAsync({
					id: editing.id,
					payload: { ...payload, version: editing.version }
				});
				creatorId = editing.id;
				toast.success('Creator updated.');
			} else {
				const created = await createMutation.mutateAsync(payload);
				creatorId = created.id;
				toast.success('Creator created.');
			}

			const failed: string[] = [];
			for (const a of form.attachments) {
				try {
					await uploadCreatorDocument(creatorId, a.doc_type, a.file, a.file.name);
				} catch {
					failed.push(`${a.doc_type} (${a.file.name})`);
				}
			}
			if (failed.length > 0) {
				setAttachError(
					`Creator saved, but these attachments failed to upload: ${failed.join(', ')}. Re-open Edit to retry.`
				);
				return;
			}
			setAddOpen(false);
		} catch (e) {
			toast.error('Creator could not be saved.', { description: (e as Error).message });
			if (e instanceof ConflictError) {
				setAddOpen(false);
			}
		}
	}

	const [deletingCreator, setDeletingCreator] = React.useState<Creator | null>(null);

	async function remove(r: Creator) {
		setDeletingCreator(r);
	}

	async function handleCreateAccount(e: React.FormEvent) {
		e.preventDefault();
		if (!accountTarget || !tempPassword) return;

		try {
			await createAccountMutation.mutateAsync({
				id: accountTarget.id,
				password: tempPassword
			});
			setCreatedCreds({
				email: accountTarget.email || '',
				pass: tempPassword
			});
			toast.success('Creator portal account created successfully.');
			creatorsQuery.refetch();
		} catch (err: unknown) {
			toast.error('Failed to create account.', { description: errorMessage(err) });
		}
	}

	async function handleSaveEmail(e: React.FormEvent) {
		e.preventDefault();
		if (!accountTarget || !inputEmail.trim()) return;

		try {
			await updateMutation.mutateAsync({
				id: accountTarget.id,
				payload: {
					name: accountTarget.name,
					category: accountTarget.category,
					relationship: accountTarget.relationship,
					status: accountTarget.status,
					doj: accountTarget.doj,
					profile_url: accountTarget.profile_url,
					location: accountTarget.location,
					ops_manager: accountTarget.ops_manager,
					email: inputEmail.trim().toLowerCase(),
					version: accountTarget.version
				}
			});
			setAccountTarget({
				...accountTarget,
				email: inputEmail.trim().toLowerCase()
			});
			toast.success('Email updated successfully.');
			creatorsQuery.refetch();
		} catch (err: unknown) {
			toast.error('Failed to update email.', { description: errorMessage(err) });
		}
	}

	async function confirmDelete() {
		if (!deletingCreator) return;
		try {
			await deleteMutation.mutateAsync(deletingCreator.id);
			toast.success('Creator deleted.');
			setDeletingCreator(null);
		} catch (e) {
			toast.error('Creator could not be deleted.', { description: (e as Error).message });
		}
	}

	const initialForm = React.useMemo<CreatorForm>(
		() =>
			editing
				? {
						name: editing.name,
						niche: editing.category,
						relation: editing.relationship,
						status: editing.status ?? 'Active',
						doj: editing.doj ? new Date(editing.doj) : EMPTY_FORM.doj,
						url: parseCreatorLinks(editing.profile_url),
						location: editing.location,
						talent_manager: editing.ops_manager,
						attachments: [],
						email: editing.email || ''
					}
				: EMPTY_FORM,
		[editing]
	);

	const columns = React.useMemo<ColumnDef<Creator, unknown>[]>(
		() => {
			const shared: ColumnDef<Creator, unknown>[] = [
			{
				accessorKey: 'name',
				header: 'Creator Name',
				meta: { tdClassName: 'font-medium' },
				cell: ({ row }) => (
					<Link
						href={`/creators/${row.original.id}`}
						className="inline-link text-left"
						title={`View ${row.original.name}`}
					>
						{row.original.name}
					</Link>
				)
			},
			{
				accessorKey: 'category',
				header: 'Niche',
				meta: { tdStyle: { color: 'var(--n-fg-muted)' } }
			},
			{
				accessorKey: 'relationship',
				header: 'Relation',
				cell: ({ row }) =>
					row.original.relationship && (
						<Tag tone={relTone(row.original.relationship)}>{row.original.relationship}</Tag>
					)
			},
			{
				accessorKey: 'status',
				header: 'Status',
				cell: ({ row }) => (
					<Tag tone={statusTone(row.original.status ?? 'Active')}>
						{row.original.status ?? 'Active'}
					</Tag>
				)
			},
			{
				id: 'portal',
				accessorKey: 'portalStatus',
				header: 'Portal Status',
				cell: ({ row }) => {
					const pStatus = row.original.portalStatus || 'inactive';
					const email = row.original.email || '';
					const tone = pStatus === 'active' ? 'yes' : pStatus === 'invited' ? 'markup' : 'neutral';
					const label = pStatus === 'active' ? 'Portal Active' : pStatus === 'invited' ? 'Invited' : 'Manual';
					return (
						<div className="flex flex-col gap-0.5">
							<Tag tone={tone}>{label}</Tag>
							{email && (
								<span className="text-[10px] text-gray-400 font-mono truncate max-w-[120px]" title={email}>
									{email}
								</span>
							)}
						</div>
					);
				}
			},
			{
				accessorKey: 'doj',
				header: 'DOJ',
				meta: { tdClassName: 'whitespace-nowrap', tdStyle: { color: 'var(--n-fg-muted)' } },
				cell: ({ row }) => formatDoj(row.original.doj)
			},
			{
				accessorKey: 'profile_url',
				header: 'URL',
				enableSorting: false,
				cell: ({ row }) =>
					parseCreatorLinks(row.original.profile_url)[0] && (
						<a
							className="inline-link text-[12px]"
							href={parseCreatorLinks(row.original.profile_url)[0]}
							target="_blank"
							rel="noopener"
						>
							link ↗
						</a>
					)
			},
			{
				accessorKey: 'location',
				header: 'Location',
				meta: { tdStyle: { color: 'var(--n-fg-muted)' } }
			},
			{
				accessorKey: 'ops_manager',
				header: 'Talent Manager',
				meta: { tdStyle: { color: 'var(--n-fg)' } }
			},
			];
			if (isAccounts) return shared.filter((column) => column.id !== 'portal');
			return [...shared, {
				id: 'actions',
				header: 'Actions',
				enableSorting: false,
				meta: { thClassName: 'w-[90px]' },
				cell: ({ row }) => (
					<div className="flex gap-0.5 justify-end">
						{row.original.portalStatus !== 'active' && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									const hasEmail = row.original.email && row.original.email.toLowerCase() !== 'na';
									setAccountTarget(row.original);
									setTempPassword('Temp' + Math.random().toString(36).slice(-8) + '!');
									setCreatedCreds(null);
									setInputEmail(hasEmail ? (row.original.email ?? '') : '');
								}}
								aria-label="Create Portal Account"
								title="Create Portal Account"
								style={{ color: 'var(--n-accent)' }}
							>
								<Icon name="key" size={14} />
							</Button>
						)}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setConfirmEditing(row.original)}
							aria-label="Edit creator"
							title="Edit creator"
						>
							<Icon name="edit" size={14} />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => remove(row.original)}
							aria-label="Delete creator"
							title="Delete creator"
							style={{ color: 'var(--color-danger)' }}
							onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-danger-bg)')}
							onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
						>
							<Icon name="trash" size={14} />
						</Button>
					</div>
				)
			}];
		},

		[isAccounts]
	);

	return (
		<>
			<section className="space-y-6">
				<PageHeader
					title={isAccounts ? 'Creators' : 'Creator Database'}
					description={isAccounts ? 'Review creator metrics, payment context, and assigned campaigns.' : 'Manage creator profiles, relationships, status, and ownership.'}
					actions={!isAccounts ? <Button variant="primary" onClick={startAdd}>
						<Icon name="plus" size={14} /> Add Creator
					</Button> : undefined}
				/>

				<FilterToolbar search={{ value: q, onChange: setQ, placeholder: 'Search name, niche, talent manager…' }} resultCount={total} resultLabel={total === 1 ? 'creator' : 'creators'}>
					<div className="seg-toggle">
						{REL_FILTERS.map((f) => (
							<button
								key={f}
								type="button"
								className={cn(relFilter === f && 'active')}
								onClick={() => setRelFilter(f)}
							>
								{f}
							</button>
						))}
					</div>
					<div className="seg-toggle">
						{STATUS_FILTERS.map((f) => (
							<button
								key={f}
								type="button"
								className={cn(statusFilter === f && 'active')}
								onClick={() => setStatusFilter(f)}
							>
								{f}
							</button>
						))}
					</div>
				</FilterToolbar>

				{error ? (
					<QueryErrorState description="The creator database is temporarily unavailable." onRetry={() => creatorsQuery.refetch()} />
				) : (
					<div className="server-table-wrap">
						<DataTable data={rows} columns={columns} loading={loading} numbered pagination={false} rowOffset={(page - 1) * pageSize} emptyMessage="No creators match the current filters." />
						{!loading && total > 0 && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
					</div>
				)}
			</section>

			{!isAccounts && <CreatorFormModal
				open={addOpen}
				onOpenChange={setAddOpen}
				title={editing ? 'Edit Creator' : 'Add Creator'}
				submitLabel={editing ? 'Save' : 'Create'}
				initial={initialForm}
				onSubmit={submit}
				error={attachError}
				requireAttachments={!editing}
				creatorId={editing?.id ?? null}
			/>}
			{!isAccounts && <ConfirmDialog open={confirmEditing !== null} onOpenChange={(value) => { if (!value) setConfirmEditing(null); }} title="Edit this creator?" description={`You are about to update ${confirmEditing?.name ?? 'this creator'}’s master profile.`} confirmLabel="Continue to edit" onConfirm={() => { if (confirmEditing) startEdit(confirmEditing); setConfirmEditing(null); }} />}

			{!isAccounts && <Dialog
				open={deletingCreator !== null}
				onOpenChange={(open) => {
					if (!open) setDeletingCreator(null);
				}}
				title="Delete Creator"
				className="max-w-md"
				footer={
					<>
						<Button variant="outline" onClick={() => setDeletingCreator(null)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={confirmDelete}>
							Delete
						</Button>
					</>
				}
			>
				<div className="space-y-2 text-[14px]">
					<p style={{ color: 'var(--n-fg)' }}>
						Are you sure you want to delete <strong>{deletingCreator?.name}</strong>?
					</p>
					<p style={{ color: 'var(--n-fg-subtle)' }}>
						This creator will be removed from the master database. This action cannot be undone.
					</p>
				</div>
			</Dialog>}

			{/* Create Portal Account Dialog */}
			{!isAccounts && <Dialog
				open={accountTarget !== null}
				onOpenChange={(open) => {
					if (!open) setAccountTarget(null);
				}}
				title="Create Portal Account"
				className="max-w-md"
				footer={
					(() => {
						const emailMissing = !accountTarget?.email || accountTarget.email.toLowerCase() === 'na';
						if (createdCreds) {
							return <Button variant="primary" onClick={() => setAccountTarget(null)}>Done</Button>;
						}
						if (emailMissing) {
							return (
								<>
									<Button variant="outline" onClick={() => setAccountTarget(null)}>Cancel</Button>
									<Button variant="primary" onClick={handleSaveEmail} disabled={updateMutation.isPending}>
										{updateMutation.isPending ? 'Saving…' : 'Save Email & Continue'}
									</Button>
								</>
							);
						}
						return (
							<>
								<Button variant="outline" onClick={() => setAccountTarget(null)}>Cancel</Button>
								<Button variant="primary" onClick={handleCreateAccount} disabled={createAccountMutation.isPending}>
									{createAccountMutation.isPending ? 'Creating…' : 'Create Account'}
								</Button>
							</>
						);
					})()
				}
			>
				{(() => {
					const emailMissing = !accountTarget?.email || accountTarget.email.toLowerCase() === 'na';
					if (createdCreds) {
						return (
							<div className="space-y-4 text-[12px]">
								<div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 space-y-2">
									<p className="font-bold text-[14px]">✓ Portal Account Active</p>
									<p>Provide the following credentials to the creator so they can log in:</p>
								</div>
								<div className="p-4 rounded-lg bg-gray-50 border space-y-2.5 font-mono">
									<div>
										<span className="text-[11px] text-gray-400 block font-sans font-medium">EMAIL</span>
										<span className="text-gray-800 text-[12px] font-semibold select-all">{createdCreds.email}</span>
									</div>
									<div>
										<span className="text-[11px] text-gray-400 block font-sans font-medium">TEMPORARY PASSWORD</span>
										<span className="text-gray-800 text-[12px] font-semibold select-all">{createdCreds.pass}</span>
									</div>
								</div>
								<p className="text-[12px] text-gray-400">
									The creator can change this password at any time inside their profile settings after logging in.
								</p>
							</div>
						);
					}

					if (emailMissing) {
						return (
							<div className="space-y-4 text-[12px]">
								<div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[12.5px] leading-relaxed">
									<strong>Email Required</strong>: This creator does not have a registered email address. Please enter an email address to activate their login portal.
								</div>
								<form onSubmit={handleSaveEmail} className="space-y-4">
									<div>
										<Label>Creator Email Address</Label>
										<input
											type="email"
											value={inputEmail}
											onChange={(e) => setInputEmail(e.target.value)}
											required
											className="w-full h-9 rounded px-3 text-[12px] bg-white border border-gray-300 focus:outline-none focus:border-[#7e22ce] mt-1"
											placeholder="e.g. creator@example.com"
										/>
									</div>
								</form>
							</div>
						);
					}

					return (
						<div className="space-y-4 text-[12px]">
							<p style={{ color: 'var(--n-fg-subtle)' }}>
								You are creating a login profile for <strong>{accountTarget?.name}</strong> using their email <strong>{accountTarget?.email}</strong>.
							</p>
							<form onSubmit={handleCreateAccount} className="space-y-4">
								<div>
									<Label>Temporary Password</Label>
									<input
										type="text"
										value={tempPassword}
										onChange={(e) => setTempPassword(e.target.value)}
										required
										className="w-full h-9 rounded px-3 text-[12px] bg-white border border-gray-300 focus:outline-none focus:border-[#7e22ce] mt-1"
										placeholder="Minimum 6 characters"
									/>
								</div>
							</form>
						</div>
					);
				})()}
			</Dialog>}
		</>
	);
}
