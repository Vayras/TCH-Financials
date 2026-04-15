<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type EmployeeReport } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Textarea from '$lib/components/ui/textarea.svelte';
	import Label from '$lib/components/ui/label.svelte';

	let rows = $state<EmployeeReport[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let open = $state(false);
	let editing = $state<EmployeeReport | null>(null);
	let q = $state('');
	let form = $state({ week_ending: '', employee_name: '', new_outreach: 0, paid_confirmations: '', revenue_locked: '', profit_locked: '', barter_confirmations: '', live_campaigns: 0, action_points: '' });

	async function load() {
		loading = true;
		try { rows = await api.get<EmployeeReport[]>('/employee-reports/'); }
		catch (e) { error = (e as Error).message; } finally { loading = false; }
	}

	function startAdd() {
		editing = null;
		form = { week_ending: '', employee_name: '', new_outreach: 0, paid_confirmations: '', revenue_locked: '', profit_locked: '', barter_confirmations: '', live_campaigns: 0, action_points: '' };
		open = true;
	}

	function startEdit(r: EmployeeReport) {
		editing = r;
		form = { week_ending: r.week_ending ?? '', employee_name: r.employee_name, new_outreach: r.new_outreach, paid_confirmations: r.paid_confirmations, revenue_locked: r.revenue_locked, profit_locked: r.profit_locked, barter_confirmations: r.barter_confirmations, live_campaigns: r.live_campaigns, action_points: r.action_points };
		open = true;
	}

	async function submit() {
		const payload = { ...form, week_ending: form.week_ending || null, new_outreach: Number(form.new_outreach) || 0, live_campaigns: Number(form.live_campaigns) || 0, revenue_locked: form.revenue_locked || '0', profit_locked: form.profit_locked || '0' };
		try {
			if (editing) { await api.patch(`/employee-reports/${editing.id}/`, payload); }
			else { await api.post('/employee-reports/', payload); }
			open = false; await load();
		} catch (e) { alert((e as Error).message); }
	}

	async function remove(r: EmployeeReport) {
		if (!confirm(`Delete report for "${r.employee_name}" (${r.week_ending})?`)) return;
		await api.del(`/employee-reports/${r.id}/`); await load();
	}

	onMount(load);

	let filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter(r => r.employee_name?.toLowerCase().includes(needle));
	});

	let totals = $derived.by(() => {
		let revenue = 0, profit = 0, outreach = 0;
		for (const r of rows) {
			revenue += Number(r.revenue_locked || 0);
			profit += Number(r.profit_locked || 0);
			outreach += r.new_outreach || 0;
		}
		return { revenue, profit, outreach };
	});

	let employees = $derived([...new Set(rows.map(r => r.employee_name))]);
</script>

<section class="space-y-4">
	<div class="border-b-2 border-blue-600 -mx-4 px-4 pb-3">
		<div class="flex items-end justify-between flex-wrap gap-2">
			<div>
				<h1 class="text-[18px] font-semibold uppercase tracking-wide text-slate-900">
					<span class="text-blue-600">Employee-Talent</span> Weekly Reports
				</h1>
				<p class="text-[12px] text-slate-500">Weekly performance log per employee.</p>
			</div>
			<Button variant="primary" onclick={startAdd}>+ Add Weekly Report</Button>
		</div>
	</div>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		<div class="border border-blue-200 bg-blue-50/50 px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-blue-700">Reports</div>
			<div class="text-[16px] font-semibold text-slate-900">{rows.length}</div>
		</div>
		<div class="border border-slate-200 bg-white px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-slate-500">Employees</div>
			<div class="text-[16px] font-semibold text-slate-900">{employees.length}</div>
		</div>
		<div class="border border-emerald-200 bg-emerald-50/40 px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-emerald-700">Total Revenue</div>
			<div class="text-[14px] font-semibold text-emerald-900">₹ {inr(totals.revenue)}</div>
		</div>
		<div class="border border-blue-200 bg-blue-50/30 px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-blue-700">Total Outreach</div>
			<div class="text-[16px] font-semibold text-slate-900">{totals.outreach}</div>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<input
			type="text"
			placeholder="Search employee…"
			class="h-8 w-[240px] border border-slate-300 px-2 text-[13px] rounded-sm focus:outline focus:outline-2 focus:outline-blue-500 bg-white"
			bind:value={q}
		/>
	</div>

	{#if loading}
		<div class="text-[13px] text-slate-500">Loading…</div>
	{:else if error}
		<div class="text-[13px] border border-rose-300 bg-rose-50 text-rose-800 p-2 rounded-sm">Error: {error}</div>
	{:else}
		<div class="overflow-x-auto rounded-sm border border-slate-200">
			<table class="grid-table">
				<thead>
					<tr>
						<th class="whitespace-nowrap">Week Ending</th>
						<th>Employee</th>
						<th class="num">Outreach</th>
						<th>Paid Confirmations</th>
						<th class="num">Revenue Locked</th>
						<th class="num">Profit Locked</th>
						<th>Barter / PR</th>
						<th class="num">Live</th>
						<th>Action Points</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as r (r.id)}
						<tr>
							<td class="whitespace-nowrap text-slate-600">{r.week_ending ?? ''}</td>
							<td class="font-medium text-slate-900">{r.employee_name}</td>
							<td class="num text-blue-700 font-semibold">{r.new_outreach}</td>
							<td class="text-slate-700">{r.paid_confirmations}</td>
							<td class="num text-emerald-700 font-semibold">{inr(r.revenue_locked)}</td>
							<td class="num text-emerald-600">{inr(r.profit_locked)}</td>
							<td class="text-slate-600">{r.barter_confirmations}</td>
							<td class="num text-blue-600">{r.live_campaigns}</td>
							<td class="text-slate-600 text-[12px]">{r.action_points}</td>
							<td>
								<div class="flex gap-1">
									<button type="button" onclick={() => startEdit(r)} class="h-7 px-2 text-[11px] uppercase tracking-wide border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded-sm">Edit</button>
									<button type="button" onclick={() => remove(r)} class="h-7 px-2 text-[11px] uppercase tracking-wide border border-slate-300 bg-white text-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-sm">Del</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if filtered.length === 0}
						<tr><td colspan="10" class="text-center text-slate-400 py-6">No reports yet.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Weekly Report' : 'Add Weekly Report'}>
	<div class="grid grid-cols-2 gap-3">
		<div><Label>Week Ending (Thursday)</Label><Input type="date" bind:value={form.week_ending} /></div>
		<div><Label>Employee Name</Label><Input bind:value={form.employee_name} /></div>
		<div><Label>New Outreach (count)</Label><Input type="number" bind:value={form.new_outreach} /></div>
		<div><Label>Paid Confirmations</Label><Input bind:value={form.paid_confirmations} placeholder="e.g. 1 - Eucerin" /></div>
		<div><Label>Revenue Locked (minus taxes)</Label><Input type="number" step="0.01" bind:value={form.revenue_locked} /></div>
		<div><Label>Profit Locked (TCH fee)</Label><Input type="number" step="0.01" bind:value={form.profit_locked} /></div>
		<div class="col-span-2"><Label>Barter / PR Confirmations</Label><Input bind:value={form.barter_confirmations} /></div>
		<div><Label>Live Campaigns (count)</Label><Input type="number" bind:value={form.live_campaigns} /></div>
		<div></div>
		<div class="col-span-2"><Label>Action Points for coming week</Label><Textarea bind:value={form.action_points} /></div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
