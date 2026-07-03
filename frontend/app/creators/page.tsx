'use client';

import * as React from 'react';
import { api, ConflictError, type Creator, type CreatorDocument } from '@/lib/api';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import { cn, downloadFile, formatDocDate, formatDoj } from '@/lib/utils';
import CreatorFormModal from '@/components/CreatorFormModal';
import DataTable from '@/components/DataTable';
import { type ColumnDef } from '@tanstack/react-table';
import type { CreatorForm } from '@/types/creator';
import {
	DOC_TYPES,
	EMPTY_FORM,
	REL_FILTERS,
	STATUS_FILTERS,
	relTone,
	statusTone,
	uploadCreatorDocument
} from '@/lib/creators';

export default function CreatorsPage() {
	const [rows, setRows] = React.useState<Creator[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [addOpen, setAddOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Creator | null>(null);
	const [q, setQ] = React.useState('');
	const [relFilter, setRelFilter] = React.useState('All');
	const [statusFilter, setStatusFilter] = React.useState('All');
	const [attachError, setAttachError] = React.useState<string | null>(null);

	// Documents modal state
	const [docsCreator, setDocsCreator] = React.useState<Creator | null>(null);
	const [docs, setDocs] = React.useState<CreatorDocument[]>([]);
	const [docsLoading, setDocsLoading] = React.useState(false);
	const [docType, setDocType] = React.useState('Other');
	const [docLabel, setDocLabel] = React.useState('');
	const [docFile, setDocFile] = React.useState<File | null>(null);
	const [uploading, setUploading] = React.useState(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const loadDocs = React.useCallback(async (creatorId: number) => {
		setDocsLoading(true);
		try {
			const list = await api.get<CreatorDocument[]>(`/creator-documents/?creator=${creatorId}`);
			setDocs(list);
		} catch (e) {
			alert((e as Error).message);
		} finally {
			setDocsLoading(false);
		}
	}, []);

	function openDocs(c: Creator) {
		setDocsCreator(c);
		setDocs([]);
		setDocType('Other');
		setDocLabel('');
		setDocFile(null);
		if (fileInputRef.current) fileInputRef.current.value = '';
		loadDocs(c.id);
	}

	async function uploadDoc() {
		if (!docsCreator || !docFile) return;
		setUploading(true);
		try {
			await uploadCreatorDocument(docsCreator.id, docType, docFile, docLabel);
			setDocFile(null);
			setDocLabel('');
			if (fileInputRef.current) fileInputRef.current.value = '';
			await loadDocs(docsCreator.id);
		} catch (e) {
			alert((e as Error).message);
		} finally {
			setUploading(false);
		}
	}

	async function deleteDoc(id: number) {
		if (!docsCreator) return;
		if (!confirm('Delete this document?')) return;
		try {
			await api.del(`/creator-documents/${id}/`);
			await loadDocs(docsCreator.id);
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function downloadDoc(d: CreatorDocument) {
		try {
			await downloadFile(d.file, d.label || undefined);
		} catch (e) {
			alert((e as Error).message);
		}
	}

	const load = React.useCallback(async () => {
		setLoading(true);
		let shown = false;
		try {
			await api.getSWR<Creator[]>('/creators/', (d) => {
				shown = true;
				setRows(d);
				setLoading(false);
			});
		} catch (e) {
			if (!shown) setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		load();
	}, [load]);

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
			const payload = {
				name: form.name,
				category: form.niche,
				relationship: form.relation,
				status: form.status,
				doj: isNaN(form.doj.getTime()) ? null : form.doj.toISOString().slice(0, 10),
				profile_url: form.url[0] ?? '',
				location: form.location,
				ops_manager: form.talent_manager
			};
			let creatorId: number;
			if (editing) {
				await api.patch(`/creators/${editing.id}/`, { ...payload, version: editing.version });
				creatorId = editing.id;
			} else {
				const created = await api.post<Creator>('/creators/', payload);
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
					`Creator saved, but these attachments failed to upload: ${failed.join(', ')}. Use “Docs” to retry.`
				);
				await load();
				return;
			}
			setAddOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
			if (e instanceof ConflictError) {
				setAddOpen(false);
				await load();
			}
		}
	}

	async function remove(r: Creator) {
		if (!confirm(`Delete creator "${r.name}"?`)) return;
		try {
			await api.del(`/creators/${r.id}/`);
			await load();
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
				meta: { thClassName: 'w-[160px]' },
				cell: ({ row }) => (
					<div className="flex gap-1">
						<Button variant="ghost" onClick={() => openDocs(row.original)}>
							Docs
						</Button>
						<Button variant="ghost" onClick={() => startEdit(row.original)}>
							Edit
						</Button>
						<Button variant="danger" onClick={() => remove(row.original)}>
							Del
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
			/>

			<Dialog
				open={docsCreator !== null}
				onOpenChange={(o) => {
					if (!o) setDocsCreator(null);
				}}
				title={docsCreator ? `Documents · ${docsCreator.name}` : 'Documents'}
				footer={
					<Button variant="outline" onClick={() => setDocsCreator(null)}>
						Close
					</Button>
				}
			>
				<div className="space-y-4">
					<div>
						<div
							className="text-[11.5px] font-medium uppercase mb-1.5"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							On file
						</div>
						{docsLoading ? (
							<div className="text-[13px] py-4 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
								Loading…
							</div>
						) : docs.length === 0 ? (
							<div
								className="text-[13px] rounded p-4 text-center"
								style={{ border: '1px dashed var(--n-border)', color: 'var(--n-fg-subtle)' }}
							>
								No documents uploaded yet.
							</div>
						) : (
							<ul className="rounded border divide-y" style={{ borderColor: 'var(--n-border)' }}>
								{docs.map((d) => (
									<li key={d.id} className="flex items-center gap-2 px-3 py-2">
										<Tag tone="neutral">{d.doc_type}</Tag>
										<div className="min-w-0 flex-1">
											<a
												className="inline-link text-[13.5px] font-medium"
												href={d.file}
												target="_blank"
												rel="noopener"
											>
												{d.label || d.file.split('/').pop()} ↗
											</a>
											<div className="text-[11.5px]" style={{ color: 'var(--n-fg-subtle)' }}>
												Uploaded {formatDocDate(d.uploaded_at)}
											</div>
										</div>
										<Button variant="ghost" onClick={() => downloadDoc(d)}>
											<Icon name="download" size={13} /> Download
										</Button>
										<Button variant="danger" onClick={() => deleteDoc(d.id)}>
											Del
										</Button>
									</li>
								))}
							</ul>
						)}
					</div>

					<div className="rounded p-3" style={{ background: 'var(--n-bg-soft)' }}>
						<div
							className="text-[11.5px] font-medium uppercase mb-2"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Upload a document
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div>
								<Label>Type</Label>
								<Select
									value={docType}
									onChange={(e) => setDocType(e.target.value)}
									options={DOC_TYPES}
								/>
							</div>
							<div>
								<Label>Label (optional)</Label>
								<Input
									value={docLabel}
									onChange={(e) => setDocLabel(e.target.value)}
									placeholder="e.g. Signed MOU 2026"
								/>
							</div>
							<div className="col-span-2">
								<Label>File</Label>
								<input
									ref={fileInputRef}
									type="file"
									onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
									className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
								/>
							</div>
						</div>
						<div className="mt-3 flex justify-end">
							<Button variant="primary" onClick={uploadDoc} disabled={!docFile || uploading}>
								<Icon name="plus" size={14} /> {uploading ? 'Uploading…' : 'Upload'}
							</Button>
						</div>
					</div>
				</div>
			</Dialog>
		</>
	);
}
