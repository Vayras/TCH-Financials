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
	let form = $state({
		week_ending: '',
		employee_name: '',
		new_outreach: 0,
		paid_confirmations: '',
		revenue_locked: '',
		profit_locked: '',
		barter_confirmations: '',
		live_campaigns: 0,
		action_points: ''
	});

	async function load() {
		loading = true;
		try {
			rows = await api.get<EmployeeReport[]>('/employee-reports/');
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	function startAdd() {
		editing = null;
		form = {
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
		open = true;
	}

	function startEdit(r: EmployeeReport) {
		editing = r;
		form = {
			week_ending: r.week_ending ?? '',
			employee_name: r.employee_name,
			new_outreach: r.new_outreach,
			paid_confirmations: r.paid_confirmations,
			revenue_locked: r.revenue_locked,
			profit_locked: r.profit_locked,
			barter_confirmations: r.barter_confirmations,
			live_campaigns: r.live_campaigns,
			action_points: r.action_points
		};
		open = true;
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
			open = false;
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

	onMount(load);
</script>

<section class="space-y-3">
	<div class="flex items-end justify-between flex-wrap gap-2">
		<div>
			<h1 class="text-[18px] font-semibold uppercase tracking-wide">Employee-Talent — Weekly</h1>
			<p class="text-[12px] text-neutral-700">Weekly performance log per employee.</p>
		</div>
		<Button variant="primary" onclick={startAdd}>+ Add Weekly Report</Button>
	</div>

	{#if loading}
		<div class="text-[13px] text-neutral-700">Loading…</div>
	{:else if error}
		<div class="text-[13px] border border-black p-2">Error: {error}</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="grid-table">
				<thead>
					<tr>
						<th>Week Ending</th>
						<th>Employee</th>
						<th class="num">New Outreach</th>
						<th>Paid Confirmations</th>
						<th class="num">Revenue Locked</th>
						<th class="num">Profit Locked</th>
						<th>Barter / PR</th>
						<th class="num">Live Campaigns</th>
						<th>Action Points</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r (r.id)}
						<tr>
							<td>{r.week_ending ?? ''}</td>
							<td>{r.employee_name}</td>
							<td class="num">{r.new_outreach}</td>
							<td>{r.paid_confirmations}</td>
							<td class="num">{inr(r.revenue_locked)}</td>
							<td class="num">{inr(r.profit_locked)}</td>
							<td>{r.barter_confirmations}</td>
							<td class="num">{r.live_campaigns}</td>
							<td>{r.action_points}</td>
							<td>
								<Button variant="ghost" onclick={() => startEdit(r)}>Edit</Button>
								<Button variant="ghost" onclick={() => remove(r)}>Del</Button>
							</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr><td colspan="10" class="text-center text-neutral-700">No reports yet.</td></tr>
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
