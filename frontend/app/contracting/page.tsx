'use client';

import * as React from 'react';
import { api, type Contracting, type Creator } from '@/lib/api';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';

const YN = [
	{ value: 'Y', label: 'Y' },
	{ value: 'N', label: 'N' }
];

type ContractingForm = {
	creator: string;
	final_meeting: string;
	agreement_sent: string;
	agreement_signed: string;
	bank_verified: string;
	time_to_sign: string;
	renewal_date: string;
	renewal_note: string;
};

const EMPTY_FORM: ContractingForm = {
	creator: '',
	final_meeting: '',
	agreement_sent: '',
	agreement_signed: '',
	bank_verified: '',
	time_to_sign: '',
	renewal_date: '',
	renewal_note: ''
};

function YNCell({ value }: { value: string }) {
	if (value === 'Y') return <Tag tone="yes">Y</Tag>;
	if (value === 'N') return <Tag tone="no">N</Tag>;
	return <span style={{ color: 'var(--n-fg-subtle)' }}>—</span>;
}

export default function ContractingPage() {
	const [rows, setRows] = React.useState<Contracting[]>([]);
	const [creators, setCreators] = React.useState<Creator[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<Contracting | null>(null);
	const [form, setForm] = React.useState<ContractingForm>(EMPTY_FORM);

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			const [r, c] = await Promise.all([
				api.get<Contracting[]>('/contracting/'),
				api.get<Creator[]>('/creators/')
			]);
			setRows(r);
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

	function startEdit(row: Contracting) {
		setEditing(row);
		setForm({
			creator: String(row.creator),
			final_meeting: row.final_meeting,
			agreement_sent: row.agreement_sent,
			agreement_signed: row.agreement_signed,
			bank_verified: row.bank_verified,
			time_to_sign: row.time_to_sign,
			renewal_date: row.renewal_date ?? '',
			renewal_note: row.renewal_note
		});
		setOpen(true);
	}

	async function submit() {
		const payload = {
			creator: Number(form.creator),
			final_meeting: form.final_meeting,
			agreement_sent: form.agreement_sent,
			agreement_signed: form.agreement_signed,
			bank_verified: form.bank_verified,
			time_to_sign: form.time_to_sign,
			renewal_date: form.renewal_date || null,
			renewal_note: form.renewal_note
		};
		try {
			if (editing) {
				await api.patch(`/contracting/${editing.id}/`, payload);
			} else {
				await api.post('/contracting/', payload);
			}
			setOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(r: Contracting) {
		if (!confirm(`Delete contracting for "${r.creator_name}"?`)) return;
		await api.del(`/contracting/${r.id}/`);
		await load();
	}

	const fullyDone = React.useMemo(
		() =>
			rows.filter(
				(r) =>
					r.final_meeting === 'Y' && r.agreement_signed === 'Y' && r.bank_verified === 'Y'
			).length,
		[rows]
	);
	const pendingSig = React.useMemo(
		() => rows.filter((r) => r.agreement_sent === 'Y' && r.agreement_signed !== 'Y').length,
		[rows]
	);

	const set = <K extends keyof ContractingForm>(k: K, v: ContractingForm[K]) =>
		setForm((f) => ({ ...f, [k]: v }));

	return (
		<>
			<section className="space-y-6">
				<header className="space-y-2">
					<div
						className="text-[12px] font-medium uppercase"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
					>
						Workspace · Contracting
					</div>
					<div className="flex items-end justify-between flex-wrap gap-3">
						<div>
							<h1
								className="page-title text-[40px] leading-[1.15] font-bold"
								style={{ color: 'var(--n-fg)' }}
							>
								Contracting & Compliance
							</h1>
							<p
								className="text-[15px] max-w-[640px] mt-2"
								style={{ color: 'var(--n-fg-muted)' }}
							>
								Agreement and KYC status per creator.
							</p>
						</div>
						<Button variant="primary" onClick={startAdd}>
							<Icon name="plus" size={14} /> Add Entry
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
							Total Entries
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
							<span className="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]" />
							Fully Complete
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{fullyDone}
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
							Pending Signature
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{pendingSig}
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
							Completion Rate
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{rows.length > 0 ? `${Math.round((fullyDone / rows.length) * 100)}%` : '—'}
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
										<th className="text-center">Final Mtg</th>
										<th className="text-center">Agr Sent</th>
										<th className="text-center">Agr Signed</th>
										<th className="text-center">Bank / PAN</th>
										<th>Time to Sign</th>
										<th>Renewal Date</th>
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
											<td className="text-center">
												<YNCell value={r.final_meeting} />
											</td>
											<td className="text-center">
												<YNCell value={r.agreement_sent} />
											</td>
											<td className="text-center">
												<YNCell value={r.agreement_signed} />
											</td>
											<td className="text-center">
												<YNCell value={r.bank_verified} />
											</td>
											<td style={{ color: 'var(--n-fg-muted)' }}>{r.time_to_sign}</td>
											<td
												className="whitespace-nowrap"
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{r.renewal_date ?? r.renewal_note}
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
												colSpan={9}
												className="text-center py-8"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												No entries yet.
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
				title={editing ? 'Edit Contracting' : 'Add Contracting'}
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
						<Label>Creator</Label>
						<Select
							value={form.creator}
							onChange={(e) => set('creator', e.target.value)}
							options={creators.map((c) => ({ value: String(c.id), label: c.name }))}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Final Meeting</Label>
						<Select
							value={form.final_meeting}
							onChange={(e) => set('final_meeting', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Agreement Sent</Label>
						<Select
							value={form.agreement_sent}
							onChange={(e) => set('agreement_sent', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Agreement Signed</Label>
						<Select
							value={form.agreement_signed}
							onChange={(e) => set('agreement_signed', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Bank / PAN Verified</Label>
						<Select
							value={form.bank_verified}
							onChange={(e) => set('bank_verified', e.target.value)}
							options={YN}
							placeholder="—"
						/>
					</div>
					<div>
						<Label>Time to Sign</Label>
						<Input
							value={form.time_to_sign}
							onChange={(e) => set('time_to_sign', e.target.value)}
							placeholder="e.g. 2 weeks"
						/>
					</div>
					<div>
						<Label>Renewal Date</Label>
						<Input
							type="date"
							value={form.renewal_date}
							onChange={(e) => set('renewal_date', e.target.value)}
						/>
					</div>
					<div className="col-span-2">
						<Label>Renewal Note</Label>
						<Input
							value={form.renewal_note}
							onChange={(e) => set('renewal_note', e.target.value)}
							placeholder="Free-text"
						/>
					</div>
				</div>
			</Dialog>
		</>
	);
}
