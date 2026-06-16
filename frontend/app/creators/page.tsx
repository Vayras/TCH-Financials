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
import { cn, inr } from '@/lib/utils';
import { useFiscalYear } from '@/lib/fiscal-year';

function fyLabelFor(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

// Per-creator activity for the selected fiscal year, keyed by creator id.
type CreatorFyStat = { deals: number; billing: string; profit: string };
type CreatorInsightRow = {
	creator_id: number | null;
	total_count: number;
	total_billing: string;
	total_profit: string;
};
type CreatorInsights = { fy_start: number; creators: CreatorInsightRow[] };

const REL = [
	{ value: 'Exclusive', label: 'Exclusive' },
	{ value: 'Friend', label: 'Friend' },
	{ value: 'Dropping', label: 'Dropping out soon' },
	{ value: 'NonTCH', label: 'Non TCH' }
];
const STAGE = [
	{ value: 'Lead', label: 'Lead' },
	{ value: 'Discussing', label: 'Discussing' },
	{ value: 'Closed', label: 'Closed' },
	{ value: 'Dropped', label: 'Dropped' }
];
const SOURCE = [
	{ value: 'EMW', label: 'EMW' },
	{ value: 'TCH', label: 'TCH' },
	{ value: 'OTHER', label: 'Other' }
];

const STATUS = [
	{ value: 'Active', label: 'Active' },
	{ value: 'Inactive', label: 'Inactive' }
];

const REL_FILTERS = ['All', 'Exclusive', 'Friend', 'Dropping', 'NonTCH'];
const STATUS_FILTERS = ['All', 'Active', 'Inactive'];

const DOC_TYPES = [
	{ value: 'Agreement', label: 'Contract / Agreement' },
	{ value: 'PAN', label: 'PAN Card' },
	{ value: 'Aadhaar', label: 'Aadhaar Card' },
	{ value: 'Cheque', label: 'Cancelled Cheque' },
	{ value: 'Bank', label: 'Bank Details' },
	{ value: 'GST', label: 'GST' },
	{ value: 'Other', label: 'Other' }
];

// Attachment slots shown in the Add Creator popup. Contract is only relevant
// for creators TCH actually contracts; Non-TCH / Friends have no agreement.
const ATTACH_SLOTS: { key: string; label: string; contract?: boolean }[] = [
	{ key: 'Agreement', label: 'Contract / Agreement', contract: true },
	{ key: 'PAN', label: 'PAN Card' },
	{ key: 'Aadhaar', label: 'Aadhaar Card' },
	{ key: 'Cheque', label: 'Cancelled Cheque' }
];
const NO_CONTRACT_RELATIONSHIPS = ['NonTCH', 'Friend'];

function formatDocDate(s: string): string {
	const d = new Date(s);
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

type CreatorForm = {
	name: string;
	category: string;
	source: string;
	stage: string;
	relationship: string;
	status: string;
	doj: string;
	doj_note: string;
	profile_url: string;
	location: string;
	ops_manager: string;
	notes: string;
};

const EMPTY_FORM: CreatorForm = {
	name: '',
	category: '',
	source: '',
	stage: '',
	relationship: 'Friend',
	status: 'Active',
	doj: '',
	doj_note: '',
	profile_url: '',
	location: '',
	ops_manager: '',
	notes: ''
};

function relTone(rel: string) {
	if (rel === 'Exclusive') return 'exclusive' as const;
	if (rel === 'Dropping') return 'dropping' as const;
	if (rel === 'NonTCH') return 'nontch' as const;
	return 'friend' as const;
}
function stageTone(stage: string) {
	if (stage === 'Closed') return 'yes' as const;
	if (stage === 'Dropped') return 'no' as const;
	if (stage === 'Discussing') return 'accent' as const;
	return 'neutral' as const;
}
function statusTone(status: string) {
	return status === 'Active' ? ('yes' as const) : ('no' as const);
}

export default function CreatorsPage() {
	const { fyStart } = useFiscalYear();
	const [rows, setRows] = React.useState<Creator[]>([]);
	// FY-scoped deals/billing per creator, refreshed whenever the fiscal year
	// changes via the global selector.
	const [fyStats, setFyStats] = React.useState<Map<number, CreatorFyStat>>(new Map());
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [addOpen, setAddOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Creator | null>(null);
	const [q, setQ] = React.useState('');
	const [relFilter, setRelFilter] = React.useState('All');
	const [statusFilter, setStatusFilter] = React.useState('All');
	const [form, setForm] = React.useState<CreatorForm>(EMPTY_FORM);
	// Files chosen in the Add Creator popup, keyed by doc_type. Uploaded right
	// after the creator is created.
	const [attachments, setAttachments] = React.useState<Record<string, File | null>>({});
	const [attachError, setAttachError] = React.useState<string | null>(null);

	// Documents modal state
	const [docsCreator, setDocsCreator] = React.useState<Creator | null>(null);
	const [docs, setDocs] = React.useState<CreatorDocument[]>([]);
	const [docsLoading, setDocsLoading] = React.useState(false);
	const [docType, setDocType] = React.useState('Agreement');
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
		setDocType('Agreement');
		setDocLabel('');
		setDocFile(null);
		if (fileInputRef.current) fileInputRef.current.value = '';
		loadDocs(c.id);
	}

	async function uploadDoc() {
		if (!docsCreator || !docFile) return;
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append('creator', String(docsCreator.id));
			fd.append('doc_type', docType);
			fd.append('label', docLabel);
			fd.append('file', docFile);
			await api.upload<CreatorDocument>('/creator-documents/', fd);
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

	// Force a save-to-disk. The file is served cross-origin (API host), so the
	// <a download> attribute is ignored — fetch as a blob and download that.
	async function downloadDoc(d: CreatorDocument) {
		try {
			const res = await fetch(d.file);
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = d.label || d.file.split('/').pop() || 'document';
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
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

	// Pull per-creator FY activity (deals / billing / profit) for the selected
	// year; rebuilds the lookup whenever the global fiscal year changes.
	React.useEffect(() => {
		let cancelled = false;
		api.get<CreatorInsights>(`/creator-insights/?fy=${fyStart}`)
			.then((d) => {
				if (cancelled) return;
				const m = new Map<number, CreatorFyStat>();
				for (const r of d.creators) {
					if (r.creator_id != null) {
						m.set(r.creator_id, {
							deals: r.total_count,
							billing: r.total_billing,
							profit: r.total_profit
						});
					}
				}
				setFyStats(m);
			})
			.catch(() => {
				if (!cancelled) setFyStats(new Map());
			});
		return () => {
			cancelled = true;
		};
	}, [fyStart]);

	function startAdd() {
		setEditing(null);
		setForm(EMPTY_FORM);
		setAttachments({});
		setAttachError(null);
		setAddOpen(true);
	}

	function startEdit(r: Creator) {
		setEditing(r);
		setForm({
			name: r.name,
			category: r.category,
			source: r.source,
			stage: r.stage,
			relationship: r.relationship,
			status: r.status ?? 'Active',
			doj: r.doj ?? '',
			doj_note: r.doj_note,
			profile_url: r.profile_url,
			location: r.location,
			ops_manager: r.ops_manager,
			notes: r.notes
		});
		setAddOpen(true);
	}

	async function submit() {
		try {
			const payload = { ...form, doj: form.doj || null };
			if (editing) {
				// version powers the optimistic-lock check: a concurrent edit
				// by someone else makes the server answer 409 instead of
				// overwriting their change.
				await api.patch(`/creators/${editing.id}/`, { ...payload, version: editing.version });
			} else {
				const created = await api.post<Creator>('/creators/', payload);
				// Upload any attachments picked in the popup. The contract slot is
				// skipped for Non-TCH / Friends (no agreement on file for them).
				const noContract = NO_CONTRACT_RELATIONSHIPS.includes(form.relationship);
				const pending = ATTACH_SLOTS.filter(
					(s) => attachments[s.key] && !(s.contract && noContract)
				);
				const failed: string[] = [];
				for (const slot of pending) {
					try {
						const fd = new FormData();
						fd.append('creator', String(created.id));
						fd.append('doc_type', slot.key);
						fd.append('label', slot.label);
						fd.append('file', attachments[slot.key] as File);
						await api.upload<CreatorDocument>('/creator-documents/', fd);
					} catch {
						failed.push(slot.label);
					}
				}
				if (failed.length > 0) {
					// The creator was created; only some files failed. Keep the
					// dialog open so they can retry via the Docs modal instead.
					setAttachError(
						`Creator saved, but these attachments failed to upload: ${failed.join(', ')}. Use “Docs” to retry.`
					);
					await load();
					return;
				}
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

	const counts = React.useMemo(
		() => ({
			exclusive: rows.filter((r) => r.relationship === 'Exclusive').length,
			friend: rows.filter((r) => r.relationship === 'Friend').length,
			dropping: rows.filter((r) => r.relationship === 'Dropping').length
		}),
		[rows]
	);

	const set = <K extends keyof CreatorForm>(k: K, v: CreatorForm[K]) =>
		setForm((f) => ({ ...f, [k]: v }));

	return (
		<>
			<section className="space-y-6">
				<header className="space-y-2">
					<div
						className="text-[12px] font-medium uppercase"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
					>
						Workspace · Creators
					</div>
					<div className="flex items-end justify-between flex-wrap gap-3">
						<div>
							<h1
								className="page-title text-[40px] leading-[1.15] font-bold"
								style={{ color: 'var(--n-fg)' }}
							>
								Creator Pipeline
							</h1>
							<p
								className="text-[15px] max-w-[640px] mt-2"
								style={{ color: 'var(--n-fg-muted)' }}
							>
								Master list of all creators TCH works with — relationship status, source, and ops
								owner.
							</p>
						</div>
						<Button variant="primary" onClick={startAdd}>
							<Icon name="plus" size={14} /> Add Creator
						</Button>
					</div>
				</header>

				<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Total Creators
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{rows.length}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							<span className="h-1.5 w-1.5 rounded-full bg-[#a371d3]" />
							Exclusives
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{counts.exclusive}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
							Friends
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{counts.friend}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							<span className="h-1.5 w-1.5 rounded-full bg-[#d9730d]" />
							Dropping
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{counts.dropping}
						</div>
					</div>
				</div>

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
							placeholder="Search name, category, ops manager…"
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
								{f === 'NonTCH' ? 'Non TCH' : f}
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
					<div className="tbl-card">
						<div className="scroll-x">
							<table className="grid-table">
								<thead>
									<tr>
										<th className="w-8 num">#</th>
										<th>Creator Name</th>
										<th>Category / Niche</th>
										<th>Source</th>
										<th>Stage</th>
										<th>Relationship</th>
										<th>Status</th>
										<th className="num" title={`Deals invoiced in ${fyLabelFor(fyStart)}`}>
											Deals · {fyLabelFor(fyStart)}
										</th>
										<th className="num" title={`Billing invoiced in ${fyLabelFor(fyStart)}`}>
											Billing · {fyLabelFor(fyStart)}
										</th>
										<th>Location</th>
										<th>Ops Mgr</th>
										<th>DOJ</th>
										<th>Profile</th>
										<th className="w-[160px]">Actions</th>
									</tr>
								</thead>
								<tbody>
									{filtered.map((r, i) => (
										<tr key={r.id}>
											<td className="num" style={{ color: 'var(--n-fg-subtle)' }}>
												{i + 1}
											</td>
											<td className="font-medium">
												<button
													type="button"
													onClick={() => startEdit(r)}
													className="inline-link text-left"
													title={`View / edit ${r.name}`}
												>
													{r.name}
												</button>
											</td>
											<td style={{ color: 'var(--n-fg-muted)' }}>{r.category}</td>
											<td>
												{r.source && (
													<Tag tone={r.source === 'EMW' ? 'emw' : 'neutral'}>{r.source}</Tag>
												)}
											</td>
											<td>{r.stage && <Tag tone={stageTone(r.stage)}>{r.stage}</Tag>}</td>
											<td>
												{r.relationship && (
													<Tag tone={relTone(r.relationship)}>
														{r.relationship === 'NonTCH' ? 'Non TCH' : r.relationship}
													</Tag>
												)}
											</td>
											<td>
												<Tag tone={statusTone(r.status ?? 'Active')}>
													{r.status ?? 'Active'}
												</Tag>
											</td>
											<td className="num tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
												{fyStats.get(r.id)?.deals ?? '—'}
											</td>
											<td className="num tabular-nums" style={{ color: 'var(--n-fg)' }}>
												{fyStats.has(r.id) ? inr(fyStats.get(r.id)!.billing) : '—'}
											</td>
											<td style={{ color: 'var(--n-fg-muted)' }}>{r.location}</td>
											<td style={{ color: 'var(--n-fg)' }}>{r.ops_manager}</td>
											<td
												className="whitespace-nowrap"
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{r.doj ?? r.doj_note}
											</td>
											<td>
												{r.profile_url && (
													<a
														className="inline-link text-[13px]"
														href={r.profile_url}
														target="_blank"
														rel="noopener"
													>
														link ↗
													</a>
												)}
											</td>
											<td>
												<div className="flex gap-1">
													<Button variant="ghost" onClick={() => openDocs(r)}>
														Docs
													</Button>
													<Button variant="ghost" onClick={() => startEdit(r)}>
														Edit
													</Button>
													<Button variant="danger" onClick={() => remove(r)}>
														Del
													</Button>
												</div>
											</td>
										</tr>
									))}
									{filtered.length === 0 && (
										<tr>
											<td
												colSpan={14}
												className="text-center py-8"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												No creators match.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="tbl-caption">
							<span>Tip · scroll horizontally on narrow screens to see all columns.</span>
						</div>
					</div>
				)}
			</section>

			<Dialog
				open={addOpen}
				onOpenChange={setAddOpen}
				title={editing ? 'Edit Creator' : 'Add Creator'}
				footer={
					<>
						<Button variant="outline" onClick={() => setAddOpen(false)}>
							Cancel
						</Button>
						<Button variant="primary" onClick={submit}>
							{editing ? 'Save' : 'Create'}
						</Button>
					</>
				}
			>
				<div className="grid grid-cols-2 gap-3">
					<div className="col-span-2">
						<Label>Name</Label>
						<Input
							value={form.name}
							onChange={(e) => set('name', e.target.value)}
							placeholder="Saili Satwe"
						/>
					</div>
					<div>
						<Label>Category / Niche</Label>
						<Input
							value={form.category}
							onChange={(e) => set('category', e.target.value)}
							placeholder="Lifestyle / Fashion"
						/>
					</div>
					<div>
						<Label>Source</Label>
						<Select
							value={form.source}
							onChange={(e) => set('source', e.target.value)}
							options={SOURCE}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Stage</Label>
						<Select
							value={form.stage}
							onChange={(e) => set('stage', e.target.value)}
							options={STAGE}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Relationship</Label>
						<Select
							value={form.relationship}
							onChange={(e) => set('relationship', e.target.value)}
							options={REL}
						/>
					</div>
					<div>
						<Label>Status</Label>
						<Select
							value={form.status}
							onChange={(e) => set('status', e.target.value)}
							options={STATUS}
						/>
					</div>
					<div>
						<Label>DOJ</Label>
						<Input
							type="date"
							value={form.doj}
							onChange={(e) => set('doj', e.target.value)}
						/>
					</div>
					<div>
						<Label>DOJ Note</Label>
						<Input
							value={form.doj_note}
							onChange={(e) => set('doj_note', e.target.value)}
							placeholder="e.g. MOU Date"
						/>
					</div>
					<div>
						<Label>Location</Label>
						<Input
							value={form.location}
							onChange={(e) => set('location', e.target.value)}
							placeholder="Mumbai"
						/>
					</div>
					<div>
						<Label>Ops Manager</Label>
						<Input
							value={form.ops_manager}
							onChange={(e) => set('ops_manager', e.target.value)}
							placeholder="Arzoo / Akshita"
						/>
					</div>
					<div className="col-span-2">
						<Label>Profile URL</Label>
						<Input
							type="url"
							value={form.profile_url}
							onChange={(e) => set('profile_url', e.target.value)}
							placeholder="https://www.instagram.com/…"
						/>
					</div>
					<div className="col-span-2">
						<Label>Notes</Label>
						<Input
							value={form.notes}
							onChange={(e) => set('notes', e.target.value)}
						/>
					</div>

					{!editing && (
						<div className="col-span-2 rounded p-3 mt-1" style={{ background: 'var(--n-bg-soft)' }}>
							<div
								className="text-[11.5px] font-medium uppercase mb-2"
								style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
							>
								Attachments (optional)
							</div>
							<div className="grid grid-cols-2 gap-3">
								{ATTACH_SLOTS.filter(
									(s) => !(s.contract && NO_CONTRACT_RELATIONSHIPS.includes(form.relationship))
								).map((slot) => (
									<div key={slot.key}>
										<Label>{slot.label}</Label>
										<input
											type="file"
											onChange={(e) =>
												setAttachments((a) => ({ ...a, [slot.key]: e.target.files?.[0] ?? null }))
											}
											className="block w-full text-[12.5px] file:mr-2 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-2 file:py-1 file:text-[12.5px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
										/>
									</div>
								))}
							</div>
							{NO_CONTRACT_RELATIONSHIPS.includes(form.relationship) && (
								<div className="text-[11.5px] mt-2" style={{ color: 'var(--n-fg-subtle)' }}>
									No contract for {form.relationship === 'NonTCH' ? 'Non-TCH' : 'Friend'} creators.
								</div>
							)}
							{attachError && (
								<div
									className="text-[12px] rounded p-2 mt-2"
									style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
								>
									{attachError}
								</div>
							)}
						</div>
					)}
				</div>
			</Dialog>

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
