'use client';

import * as React from 'react';
import { api, type Creator } from '@/lib/api';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

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

const REL_FILTERS = ['All', 'Exclusive', 'Friend', 'Dropping', 'NonTCH'];

type CreatorForm = {
	name: string;
	category: string;
	source: string;
	stage: string;
	relationship: string;
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

export default function CreatorsPage() {
	const [rows, setRows] = React.useState<Creator[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [addOpen, setAddOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Creator | null>(null);
	const [q, setQ] = React.useState('');
	const [relFilter, setRelFilter] = React.useState('All');
	const [form, setForm] = React.useState<CreatorForm>(EMPTY_FORM);

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			const fresh = await api.get<Creator[]>('/creators/');
			setRows(fresh);
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		load();
	}, [load]);

	function startAdd() {
		setEditing(null);
		setForm(EMPTY_FORM);
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
				await api.patch(`/creators/${editing.id}/`, payload);
			} else {
				await api.post('/creators/', payload);
			}
			setAddOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
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
			if (!needle) return true;
			return (
				r.name?.toLowerCase().includes(needle) ||
				r.category?.toLowerCase().includes(needle) ||
				r.ops_manager?.toLowerCase().includes(needle)
			);
		});
	}, [rows, q, relFilter]);

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
										<th>Location</th>
										<th>Ops Mgr</th>
										<th>DOJ</th>
										<th>Profile</th>
										<th className="w-[110px]">Actions</th>
									</tr>
								</thead>
								<tbody>
									{filtered.map((r, i) => (
										<tr key={r.id}>
											<td className="num" style={{ color: 'var(--n-fg-subtle)' }}>
												{i + 1}
											</td>
											<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
												{r.name}
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
												colSpan={11}
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
				</div>
			</Dialog>
		</>
	);
}
