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
import { type ColumnDef } from '@tanstack/react-table';
import type { CreatorForm } from '@/types/creator';
import {
	EMPTY_FORM,
	REL_FILTERS,
	STATUS_FILTERS,
	relTone,
	statusTone,
	uploadCreatorDocument
} from '@/lib/creators';
import {
	useCreatorsQuery,
	useCreateCreatorMutation,
	useUpdateCreatorMutation,
	useDeleteCreatorMutation
} from './queries';

export default function CreatorsPage() {
	const { data: rows = [], isLoading: loading, error: queryError } = useCreatorsQuery();
	const createMutation = useCreateCreatorMutation();
	const updateMutation = useUpdateCreatorMutation();
	const deleteMutation = useDeleteCreatorMutation();

	const error = queryError ? queryError.message : null;

	const [addOpen, setAddOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Creator | null>(null);
	const [q, setQ] = React.useState('');
	const [relFilter, setRelFilter] = React.useState('All');
	const [statusFilter, setStatusFilter] = React.useState('All');
	const [attachError, setAttachError] = React.useState<string | null>(null);

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
				location: isNonExclusive ? '' : form.location,
				ops_manager: form.talent_manager
			};
			let creatorId: number;
			if (editing) {
				await updateMutation.mutateAsync({
					id: editing.id,
					payload: { ...payload, version: editing.version }
				});
				creatorId = editing.id;
			} else {
				const created = await createMutation.mutateAsync(payload);
				creatorId = created.id;
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
			alert((e as Error).message);
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
			setDeletingCreator(null);
		} catch (e) {
			alert((e as Error).message);
		}
	}

	const filtered = React.useMemo(() => {
		const needle = q.trim().toLowerCase();
		return rows.filter((r) => {
			if (relFilter !== 'All' && r.relationship !== relFilter) return false;
			if (statusFilter !== 'All' && (r.status ?? 'Active') !== statusFilter) return false;
			if (!needle) return true;
			return (
				r.name?.toLowerCase().includes(needle) ||
				r.category?.toLowerCase().includes(needle) ||
				r.ops_manager?.toLowerCase().includes(needle)
			);
		});
	}, [rows, q, relFilter, statusFilter]);

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
					<button
						type="button"
						onClick={() => startEdit(row.original)}
						className="inline-link text-left"
						title={`View / edit ${row.original.name}`}
					>
						{row.original.name}
					</button>
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
							onClick={() => startEdit(row.original)}
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
							style={{ color: '#b91c1c' }}
							onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
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
				<header className="flex items-end justify-between flex-wrap gap-3">
					<h1
						className="page-title text-[28px] leading-[1.2] font-bold"
						style={{ color: 'var(--n-fg)' }}
					>
						Creator Database
					</h1>
					<Button variant="primary" onClick={startAdd}>
						<Icon name="plus" size={14} /> Add Creator
					</Button>
				</header>

				<div className="flex flex-wrap items-center gap-2">
					<div className="relative flex-1 min-w-[260px]">
						<span
							className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
							style={{ color: 'var(--n-fg-subtle)' }}
						>
							<Icon name="search" size={14} />
						</span>
						<input
							type="text"
							placeholder="Search name, niche, talent manager…"
							className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
							value={q}
							onChange={(e) => setQ(e.target.value)}
						/>
					</div>
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
				</div>

				{loading ? (
					<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
						Loading…
					</div>
				) : error ? (
					<div
						className="text-[14px] rounded p-3"
						style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
					>
						Error: {error}
					</div>
				) : (
					<DataTable
						data={filtered}
						columns={columns}
						numbered
						emptyMessage="No creators match."
					/>
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
