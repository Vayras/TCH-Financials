'use client';

import * as React from 'react';
import styles from './reports.module.css';
import formStyles from '@/components/CreatorFormModal.module.css';
import QueryErrorState from '@/components/QueryErrorState';
import { ConflictError, type EmployeeReport } from '@/lib/api';
import { inr } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Icon from '@/components/ui/Icon';
import {
	useEmployeeReportsQuery,
	useCreateEmployeeReportMutation,
	useUpdateEmployeeReportMutation,
	useDeleteEmployeeReportMutation
} from './queries';
import { type EmployeeForm } from '@/lib/types';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

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
	const { data: rows = [], isLoading: loading, error: queryError, refetch } = useEmployeeReportsQuery();
	const createMutation = useCreateEmployeeReportMutation();
	const updateMutation = useUpdateEmployeeReportMutation();
	const deleteMutation = useDeleteEmployeeReportMutation();

	const error = queryError ? queryError.message : null;

	const [open, setOpen] = React.useState(false);
	const [editing, setEditing] = React.useState<EmployeeReport | null>(null);
	const [q, setQ] = React.useState('');
	const [week, setWeek] = React.useState('all');
	const [form, setForm] = React.useState<EmployeeForm>(EMPTY_FORM);
	const [deleting, setDeleting] = React.useState<EmployeeReport | null>(null);



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
		if (!form.employee_name.trim() || !form.week_ending) { toast.error('Choose a reporting week and enter a team member.'); return; }
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
				await updateMutation.mutateAsync({
					id: editing.id,
					version: editing.version,
					payload
				});
			} else {
				await createMutation.mutateAsync(payload);
			}
			setOpen(false);
			toast.success(editing ? 'Weekly report updated.' : 'Weekly report created.');
		} catch (e) {
			toast.error('Weekly report could not be saved.', { description: (e as Error).message });
			if (e instanceof ConflictError) {
				setOpen(false);
			}
		}
	}

	async function remove(r: EmployeeReport) {
		try {
			await deleteMutation.mutateAsync(r.id);
			setDeleting(null);
			toast.success('Weekly report deleted.');
		} catch (e) {
			toast.error('Weekly report could not be deleted.', { description: (e as Error).message });
		}
	}

	const weeks = [...new Set(rows.map((r) => r.week_ending).filter((date): date is string => Boolean(date)))].sort().reverse();
	const employees = [...new Set(rows.map((r) => r.employee_name))];
	const filtered = rows.filter((r) => (week === 'all' || r.week_ending === week) && r.employee_name.toLowerCase().includes(q.trim().toLowerCase()));
	const set = <K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) =>
		setForm((f) => ({ ...f, [k]: v }));

	return (
		<>
			<section className={styles.workspace}>
                <header className={styles.header}><div><h2>Historical manual reports</h2><p>Previously entered figures, preserved separately from automatic reporting.</p></div></header>
                {loading ? <p>Loading team reports…</p> : error ? <QueryErrorState description="Weekly reports are temporarily unavailable." onRetry={() => refetch()} /> : rows.length === 0 ? (
                    <p>No historical manual reports.</p>
                ) : <>
                    <div className={styles.filters}><label>Reporting week<select value={week} onChange={(e) => setWeek(e.target.value)}><option value="all">All weeks</option>{weeks.map((date) => <option key={date} value={date}>Week ending {date}</option>)}</select></label><label>Team member<Input placeholder="Search team members…" value={q} onChange={(e) => setQ(e.target.value)} /></label></div>
                    <p className={styles.summary}>{filtered.length} check-ins · {filtered.reduce((sum, r) => sum + r.new_outreach, 0)} new outreach · ₹{inr(filtered.reduce((sum, r) => sum + Number(r.revenue_locked || 0), 0)) || '0'} reported revenue</p>
                    <div className={styles.list}>{filtered.map((r) => <article key={r.id} className={styles.report}>
                        <div><h2>{r.employee_name}</h2><p>Week ending {r.week_ending || 'Not specified'}</p></div>
                        <div><span>Outreach</span><strong>{r.new_outreach}</strong></div>
                        <div><span>Confirmations</span><p>{r.paid_confirmations || 'No paid confirmations'}{r.barter_confirmations && <><br />Barter / PR: {r.barter_confirmations}</>}</p></div>
                        <div><span>Next-week priorities</span><p>{r.action_points || 'No priorities added'}</p></div>
                        <div className={styles.actions}><Button variant="outline" onClick={() => startEdit(r)}>Edit</Button><Button variant="danger" onClick={() => setDeleting(r)} aria-label={`Delete ${r.employee_name}'s report`}><Icon name="trash" size={14} /></Button></div>
                        <details className={styles.figures}><summary>Reported financials & campaign activity</summary><p>Revenue (excluding taxes): ₹{inr(Number(r.revenue_locked)) || '0'} · Agency fee: ₹{inr(Number(r.profit_locked)) || '0'} · Live campaigns: {r.live_campaigns}</p></details>
                    </article>)}{!filtered.length && <p className={styles.empty}>No check-ins match these filters.</p>}</div>
                </>}
            </section>

			<Dialog
				open={open}
                className={`${formStyles.dialog} ${styles.dialog}` }
				onOpenChange={setOpen}
				title={editing ? 'Edit weekly check-in' : 'Add weekly check-in'}
				footer={
					<>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button variant="primary" onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
							{createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save check-in'}
						</Button>
					</>
				}
			>
				<div className={formStyles.fields}>
					<div>
						<Label>Week ending (Thursday) *</Label>
						<Input
							type="date"
							value={form.week_ending}
							onChange={(e) => set('week_ending', e.target.value)}
						/>
					</div>
					<div>
						<Label>Team member *</Label>
						<Input
							list="report-team-members"
                            value={form.employee_name}
							onChange={(e) => set('employee_name', e.target.value)}
						/>
					</div>
					<h3 className={formStyles.sectionTitle}>This week’s progress</h3><div>
						<Label>New outreach (count)</Label>
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
						<Label>Confirmed revenue (₹, excluding taxes)</Label>
						<Input
							type="number"
							step="0.01"
							value={form.revenue_locked}
							onChange={(e) => set('revenue_locked', e.target.value)}
						/>
					</div>
					<div>
						<Label>Confirmed agency fee (₹)</Label>
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
					<p className={formStyles.hint}>Figures are manually reported for this week, not calculated from campaign records.</p>
					<div className="col-span-2">
						<Label>Next week’s priorities</Label>
						<Textarea
							placeholder="What will you focus on? Include any help you need."
                            value={form.action_points}
							onChange={(e) => set('action_points', e.target.value)}
						/>
					</div>
				</div>
			<datalist id="report-team-members">{employees.map((name) => <option key={name} value={name} />)}</datalist>
            </Dialog>
			<ConfirmDialog open={deleting !== null} onOpenChange={(value) => { if (!value) setDeleting(null); }} title="Delete weekly report?" description={`Delete ${deleting?.employee_name ?? 'this employee'}’s report for ${deleting?.week_ending ?? 'this week'}?`} confirmLabel="Delete report" confirmVariant="danger" pending={deleteMutation.isPending} onConfirm={() => { if (deleting) return remove(deleting); }} />
		</>
	);
}
