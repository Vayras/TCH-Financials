'use client';

import * as React from 'react';
import { api, type EmployeeReport } from '@/lib/api';
import { inr } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Icon from '@/components/ui/Icon';

type EmployeeForm = {
	week_ending: string;
	employee_name: string;
	new_outreach: number;
	paid_confirmations: string;
	revenue_locked: string;
	profit_locked: string;
	barter_confirmations: string;
	live_campaigns: number;
	action_points: string;
};

const EMPTY_FORM: EmployeeForm = {
	week_ending: '',
	employee_name: '',
	new_outreach: 0,
	paid_confirmations: '',
	revenue_locked: '',
	profit_locked: '',
	barter_confirmations: '',
	live_campaigns: 0,
	action_points: ''
};

export default function EmployeesPage() {
	const [rows, setRows] = React.useState<EmployeeReport[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<EmployeeReport | null>(null);
	const [q, setQ] = React.useState('');
	const [form, setForm] = React.useState<EmployeeForm>(EMPTY_FORM);

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			const fresh = await api.get<EmployeeReport[]>('/employee-reports/');
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
		setOpen(true);
	}

	function startEdit(r: EmployeeReport) {
		setEditing(r);
		setForm({
			week_ending: r.week_ending ?? '',
			employee_name: r.employee_name,
			new_outreach: r.new_outreach,
			paid_confirmations: r.paid_confirmations,
			revenue_locked: r.revenue_locked,
			profit_locked: r.profit_locked,
			barter_confirmations: r.barter_confirmations,
			live_campaigns: r.live_campaigns,
			action_points: r.action_points
		});
		setOpen(true);
	}

	async function submit() {
		const payload = {
			...form,
			week_ending: form.week_ending || null,
			new_outreach: Number(form.new_outreach) || 0,
			live_campaigns: Number(form.live_campaigns) || 0,
			revenue_locked: form.revenue_locked || '0',
			profit_locked: form.profit_locked || '0'
		};
		try {
			if (editing) {
				await api.patch(`/employee-reports/${editing.id}/`, payload);
			} else {
				await api.post('/employee-reports/', payload);
			}
			setOpen(false);
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(r: EmployeeReport) {
		if (!confirm(`Delete report for "${r.employee_name}" (${r.week_ending})?`)) return;
		await api.del(`/employee-reports/${r.id}/`);
		await load();
	}

	const filtered = React.useMemo(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((r) => r.employee_name?.toLowerCase().includes(needle));
	}, [rows, q]);

	const totals = React.useMemo(() => {
		let revenue = 0;
		let profit = 0;
		let outreach = 0;
		for (const r of rows) {
			revenue += Number(r.revenue_locked || 0);
			profit += Number(r.profit_locked || 0);
			outreach += r.new_outreach || 0;
		}
		return { revenue, profit, outreach };
	}, [rows]);

	const employees = React.useMemo(
		() => [...new Set(rows.map((r) => r.employee_name))],
		[rows]
	);

	const set = <K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) =>
		setForm((f) => ({ ...f, [k]: v }));

	return (
		<>
			<section className="space-y-6">
				<header className="space-y-2">
					<div
						className="text-[12px] font-medium uppercase"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
					>
						Workspace · Employees
					</div>
					<div className="flex items-end justify-between flex-wrap gap-3">
						<div>
							<h1
								className="page-title text-[40px] leading-[1.15] font-bold"
								style={{ color: 'var(--n-fg)' }}
							>
								Weekly Reports
							</h1>
							<p
								className="text-[15px] max-w-[640px] mt-2"
								style={{ color: 'var(--n-fg-muted)' }}
							>
								Weekly performance log per employee — outreach, confirmations, revenue, and live
								campaigns.
							</p>
						</div>
						<Button variant="primary" onClick={startAdd}>
							<Icon name="plus" size={14} /> Add Weekly Report
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
							Reports
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
							Employees
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{employees.length}
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
							Total Revenue
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							₹ {inr(totals.revenue)}
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
							Total Outreach
						</div>
						<div
							className="text-[22px] font-semibold tabular-nums mt-1"
							style={{ color: 'var(--n-fg)' }}
						>
							{totals.outreach}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="relative flex-1 min-w-[260px]">
						<span
							className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
							style={{ color: 'var(--n-fg-subtle)' }}
						>
							<Icon name="search" size={14} />
						</span>
						<input
							type="text"
							placeholder="Search employee…"
							className="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
							value={q}
							onChange={(e) => setQ(e.target.value)}
						/>
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
										<th className="whitespace-nowrap">Week Ending</th>
										<th>Employee</th>
										<th className="num">Outreach</th>
										<th>Paid Confirmations</th>
										<th className="num">Revenue Locked</th>
										<th className="num">Profit Locked</th>
										<th>Barter / PR</th>
										<th className="num">Live</th>
										<th>Action Points</th>
										<th className="w-[110px]">Actions</th>
									</tr>
								</thead>
								<tbody>
									{filtered.map((r) => (
										<tr key={r.id}>
											<td
												className="whitespace-nowrap"
												style={{ color: 'var(--n-fg-muted)' }}
											>
												{r.week_ending ?? ''}
											</td>
											<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
												{r.employee_name}
											</td>
											<td
												className="num font-semibold"
												style={{ color: 'var(--n-fg)' }}
											>
												{r.new_outreach}
											</td>
											<td style={{ color: 'var(--n-fg)' }}>{r.paid_confirmations}</td>
											<td className="num font-semibold" style={{ color: '#1f6f43' }}>
												{inr(r.revenue_locked)}
											</td>
											<td className="num" style={{ color: '#1f6f43' }}>
												{inr(r.profit_locked)}
											</td>
											<td style={{ color: 'var(--n-fg-muted)' }}>{r.barter_confirmations}</td>
											<td className="num" style={{ color: 'var(--n-fg)' }}>
												{r.live_campaigns}
											</td>
											<td className="text-[13.5px]" style={{ color: 'var(--n-fg-muted)' }}>
												{r.action_points}
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
												colSpan={10}
												className="text-center py-8"
												style={{ color: 'var(--n-fg-subtle)' }}
											>
												No reports yet.
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
				title={editing ? 'Edit Weekly Report' : 'Add Weekly Report'}
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
					<div>
						<Label>Week Ending (Thursday)</Label>
						<Input
							type="date"
							value={form.week_ending}
							onChange={(e) => set('week_ending', e.target.value)}
						/>
					</div>
					<div>
						<Label>Employee Name</Label>
						<Input
							value={form.employee_name}
							onChange={(e) => set('employee_name', e.target.value)}
						/>
					</div>
					<div>
						<Label>New Outreach (count)</Label>
						<Input
							type="number"
							value={form.new_outreach}
							onChange={(e) => set('new_outreach', Number(e.target.value))}
						/>
					</div>
					<div>
						<Label>Paid Confirmations</Label>
						<Input
							value={form.paid_confirmations}
							onChange={(e) => set('paid_confirmations', e.target.value)}
							placeholder="e.g. 1 - Eucerin"
						/>
					</div>
					<div>
						<Label>Revenue Locked (minus taxes)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.revenue_locked}
							onChange={(e) => set('revenue_locked', e.target.value)}
						/>
					</div>
					<div>
						<Label>Profit Locked (TCH fee)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.profit_locked}
							onChange={(e) => set('profit_locked', e.target.value)}
						/>
					</div>
					<div className="col-span-2">
						<Label>Barter / PR Confirmations</Label>
						<Input
							value={form.barter_confirmations}
							onChange={(e) => set('barter_confirmations', e.target.value)}
						/>
					</div>
					<div>
						<Label>Live Campaigns (count)</Label>
						<Input
							type="number"
							value={form.live_campaigns}
							onChange={(e) => set('live_campaigns', Number(e.target.value))}
						/>
					</div>
					<div />
					<div className="col-span-2">
						<Label>Action Points for coming week</Label>
						<Textarea
							value={form.action_points}
							onChange={(e) => set('action_points', e.target.value)}
						/>
					</div>
				</div>
			</Dialog>
		</>
	);
}
