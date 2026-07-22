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
import {
	useCreatorsPageQuery,
	useCreateCreatorMutation,
	useUpdateCreatorMutation,
	useDeleteCreatorMutation
} from './queries';

export default function CreatorsPage() {
	const createMutation = useCreateCreatorMutation();
	const updateMutation = useUpdateCreatorMutation();
	const deleteMutation = useDeleteCreatorMutation();

	const [addOpen, setAddOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Creator | null>(null);
	const [confirmEditing, setConfirmEditing] = React.useState<Creator | null>(null);
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
				profile_url: form.url[0] ?? '',
				location: form.location,
				ops_manager: form.talent_manager
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
						url: editing.profile_url ? [editing.profile_url] : [],
						location: editing.location,
						talent_manager: editing.ops_manager,
						attachments: []
					}
				: EMPTY_FORM,
		[editing]
	);

	const columns = React.useMemo<ColumnDef<Creator, unknown>[]>(
		() => [
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
					row.original.profile_url && (
						<a
							className="inline-link text-[13px]"
							href={row.original.profile_url}
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
			{
				id: 'actions',
				header: 'Actions',
				enableSorting: false,
				meta: { thClassName: 'w-[90px]' },
				cell: ({ row }) => (
					<div className="flex gap-0.5 justify-end">
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
			}
		],

		[]
	);

	return (
		<>
			<section className="space-y-6">
				<PageHeader
					title="Creator Database"
					description="Manage creator profiles, relationships, status, and ownership."
					actions={<Button variant="primary" onClick={startAdd}>
						<Icon name="plus" size={14} /> Add Creator
					</Button>}
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

			<CreatorFormModal
				open={addOpen}
				onOpenChange={setAddOpen}
				title={editing ? 'Edit Creator' : 'Add Creator'}
				submitLabel={editing ? 'Save' : 'Create'}
				initial={initialForm}
				onSubmit={submit}
				error={attachError}
				requireAttachments={!editing}
				creatorId={editing?.id ?? null}
			/>
			<ConfirmDialog open={confirmEditing !== null} onOpenChange={(value) => { if (!value) setConfirmEditing(null); }} title="Edit this creator?" description={`You are about to update ${confirmEditing?.name ?? 'this creator'}’s master profile.`} confirmLabel="Continue to edit" onConfirm={() => { if (confirmEditing) startEdit(confirmEditing); setConfirmEditing(null); }} />

			<Dialog
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
			</Dialog>
		</>
	);
}
