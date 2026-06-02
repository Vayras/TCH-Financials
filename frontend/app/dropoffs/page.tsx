'use client';

import * as React from 'react';
import { api, type DropOff, type Creator } from '@/lib/api';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';

type DropOffForm = {
	creator: string;
	creator_name_raw: string;
	drop_off_date: string;
	drop_off_date_note: string;
	reason: string;
	learning: string;
	duration: string;
};

const EMPTY_FORM: DropOffForm = {
	creator: '',
	creator_name_raw: '',
	drop_off_date: '',
	drop_off_date_note: '',
	reason: '',
	learning: '',
	duration: ''
};

export default function DropoffsPage() {
	const [rows, setRows] = React.useState<DropOff[]>([]);
	const [creators, setCreators] = React.useState<Creator[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<DropOff | null>(null);
	const [form, setForm] = React.useState<DropOffForm>(EMPTY_FORM);

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			const [d, c] = await Promise.all([
				api.get<DropOff[]>('/dropoffs/'),
				api.get<Creator[]>('/creators/')
			]);
			setRows(d);
			setCreators(c);
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
		setOpen(true);
	}

	function startEdit(r: DropOff) {
		setEditing(r);
		setForm({
			creator: r.creator ? String(r.creator) : '',
			creator_name_raw: r.creator_name_raw,
			drop_off_date: r.drop_off_date ?? '',
			drop_off_date_note: r.drop_off_date_note,
			reason: r.reason,
			learning: r.learning,
			duration: r.duration
		});
		setOpen(true);
	}

	async function submit() {
		const payload = {
			...form,
			creator: form.creator ? Number(form.creator) : null,
			drop_off_date: form.drop_off_date || null
		};
		try {
			if (editing) {
				await api.patch(`/dropoffs/${editing.id}/`, payload);
			} else {
				await api.post('/dropoffs/', payload);
			}
			setOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(r: DropOff) {
		if (!confirm(`Delete drop-off entry for "${r.creator_name}"?`)) return;
		await api.del(`/dropoffs/${r.id}/`);
		await load();
	}

	const set = <K extends keyof DropOffForm>(k: K, v: DropOffForm[K]) =>
		setForm((f) => ({ ...f, [k]: v }));

	return (
		<>
			<section className="space-y-6">
				<header className="space-y-2">
					<div
						className="text-[12px] font-medium uppercase"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
					>
						Workspace · Drop-offs
					</div>
					<div className="flex items-end justify-between flex-wrap gap-3">
						<div>
							<h1
								className="page-title text-[40px] leading-[1.15] font-bold"
								style={{ color: 'var(--n-fg)' }}
							>
								Drop-offs
							</h1>
							<p
								className="text-[15px] max-w-[640px] mt-2"
								style={{ color: 'var(--n-fg-muted)' }}
							>
								Log of creators who left TCH, with reason and learning.
							</p>
						</div>
						<Button variant="primary" onClick={startAdd}>
							<Icon name="plus" size={14} /> Add Drop-off
						</Button>
					</div>
				</header>

				<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Total Drop-offs
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
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							With Date
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{rows.filter((r) => r.drop_off_date).length}
						</div>
					</div>
					<div
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Linked to Creator
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{rows.filter((r) => r.creator).length}
						</div>
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
										<th>Creator</th>
										<th className="whitespace-nowrap w-[130px]">Drop-off Date</th>
										<th>Reason</th>
										<th>Learning / Action</th>
										<th className="whitespace-nowrap">Duration</th>
										<th className="w-[110px]">Actions</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((r, i) => (
										<tr key={r.id}>
											<td className="num" style={{ color: 'var(--n-fg-subtle)' }}>
												{i + 1}
											</td>
											<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
												{r.creator_name}
											</td>
											<td className="whitespace-nowrap">
												{r.drop_off_date ? (
													<span className="font-medium" style={{ color: 'var(--n-fg)' }}>
														{r.drop_off_date}
													</span>
												) : (
													<span
														className="text-[13px]"
														style={{ color: 'var(--n-fg-subtle)' }}
													>
														{r.drop_off_date_note || '—'}
													</span>
												)}
											</td>
											<td style={{ color: 'var(--n-fg)' }}>{r.reason}</td>
											<td className="text-[13.5px]" style={{ color: 'var(--n-fg-muted)' }}>
												{r.learning}
											</td>
											<td className="whitespace-nowrap">
												<Tag tone="neutral">{r.duration}</Tag>
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
									{rows.length === 0 && (
										<tr>
											<td
												colSpan={7}
												className="text-center py-8"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												No drop-offs recorded.
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</section>

			<Dialog
				open={open}
				onOpenChange={setOpen}
				title={editing ? 'Edit Drop-off' : 'Add Drop-off'}
				footer={
					<>
						<Button variant="outline" onClick={() => setOpen(false)}>
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
						<Label>Creator (pick from master)</Label>
						<Select
							value={form.creator}
							onChange={(e) => set('creator', e.target.value)}
							options={creators.map((c) => ({ value: String(c.id), label: c.name }))}
							placeholder="— pick or use raw name below —"
						/>
					</div>
					<div className="col-span-2">
						<Label>Creator Name (raw, if not in master)</Label>
						<Input
							value={form.creator_name_raw}
							onChange={(e) => set('creator_name_raw', e.target.value)}
						/>
					</div>
					<div>
						<Label>Drop-off Date</Label>
						<Input
							type="date"
							value={form.drop_off_date}
							onChange={(e) => set('drop_off_date', e.target.value)}
						/>
					</div>
					<div>
						<Label>Date Note</Label>
						<Input
							value={form.drop_off_date_note}
							onChange={(e) => set('drop_off_date_note', e.target.value)}
							placeholder="e.g. when contract expires"
						/>
					</div>
					<div>
						<Label>Duration of Association</Label>
						<Input
							value={form.duration}
							onChange={(e) => set('duration', e.target.value)}
							placeholder="e.g. 1 year"
						/>
					</div>
					<div />
					<div className="col-span-2">
						<Label>Reason for Drop-off</Label>
						<Textarea
							value={form.reason}
							onChange={(e) => set('reason', e.target.value)}
						/>
					</div>
					<div className="col-span-2">
						<Label>Learning / Action</Label>
						<Textarea
							value={form.learning}
							onChange={(e) => set('learning', e.target.value)}
						/>
					</div>
				</div>
			</Dialog>
		</>
	);
}
