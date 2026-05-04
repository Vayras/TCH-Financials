<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type EmployeeReport } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Textarea from '$lib/components/ui/textarea.svelte';
	import Label from '$lib/components/ui/label.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

	let rows = $state<EmployeeReport[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let open = $state(false);
	let editing = $state<EmployeeReport | null>(null);
	let q = $state('');
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

	let filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((r) => r.employee_name?.toLowerCase().includes(needle));
	});

	let totals = $derived.by(() => {
		let revenue = 0;
		let profit = 0;
		let outreach = 0;
		for (const r of rows) {
			revenue += Number(r.revenue_locked || 0);
			profit += Number(r.profit_locked || 0);
			outreach += r.new_outreach || 0;
		}
		return { revenue, profit, outreach };
	});

	let employees = $derived([...new Set(rows.map((r) => r.employee_name))]);
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Employees
		</div>
		<div class="flex items-end justify-between flex-wrap gap-3">
			<div>
				<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
					Weekly Reports
				</h1>
				<p class="text-[15px] max-w-[640px] mt-2" style="color: var(--n-fg-muted);">
					Weekly performance log per employee — outreach, confirmations, revenue, and live
					campaigns.
				</p>
			</div>
			<Button variant="primary" onclick={startAdd}>
				<Icon name="plus" size={14} /> Add Weekly Report
			</Button>
		</div>
	</header>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Reports
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{rows.length}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Employees
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{employees.length}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]"></span>
				Total Revenue
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				₹ {inr(totals.revenue)}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Total Outreach
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{totals.outreach}
			</div>
		</div>
	</div>

	<div class="flex items-center gap-2">
		<div class="relative flex-1 min-w-[260px]">
			<span
				class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
				style="color: var(--n-fg-subtle);"
			>
				<Icon name="search" size={14} />
			</span>
			<input
				type="text"
				placeholder="Search employee…"
				class="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
				bind:value={q}
			/>
		</div>
	</div>

	{#if loading}
		<div class="text-[14px] py-8 text-center" style="color: var(--n-fg-subtle);">Loading…</div>
	{:else if error}
		<div
			class="text-[14px] rounded p-3"
			style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;"
		>
			Error: {error}
		</div>
	{:else}
		<div class="tbl-card">
			<div class="scroll-x">
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
								<td class="whitespace-nowrap" style="color: var(--n-fg-muted);">
									{r.week_ending ?? ''}
								</td>
								<td class="font-medium" style="color: var(--n-fg);">{r.employee_name}</td>
								<td class="num font-semibold" style="color: var(--n-fg);">
									{r.new_outreach}
								</td>
								<td style="color: var(--n-fg);">{r.paid_confirmations}</td>
								<td class="num font-semibold" style="color: #1f6f43;">
									{inr(r.revenue_locked)}
								</td>
								<td class="num" style="color: #1f6f43;">{inr(r.profit_locked)}</td>
								<td style="color: var(--n-fg-muted);">{r.barter_confirmations}</td>
								<td class="num" style="color: var(--n-fg);">{r.live_campaigns}</td>
								<td class="text-[13.5px]" style="color: var(--n-fg-muted);">
									{r.action_points}
								</td>
								<td>
									<div class="flex gap-1">
										<Button variant="ghost" onclick={() => startEdit(r)}>Edit</Button>
										<Button variant="danger" onclick={() => remove(r)}>Del</Button>
									</div>
								</td>
							</tr>
						{/each}
						{#if filtered.length === 0}
							<tr>
								<td
									colspan="10"
									class="text-center py-8"
									style="color: var(--n-fg-subtle);"
								>
									No reports yet.
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Weekly Report' : 'Add Weekly Report'}>
	<div class="grid grid-cols-2 gap-3">
		<div>
			<Label>Week Ending (Thursday)</Label>
			<Input type="date" bind:value={form.week_ending} />
		</div>
		<div>
			<Label>Employee Name</Label>
			<Input bind:value={form.employee_name} />
		</div>
		<div>
			<Label>New Outreach (count)</Label>
			<Input type="number" bind:value={form.new_outreach} />
		</div>
		<div>
			<Label>Paid Confirmations</Label>
			<Input bind:value={form.paid_confirmations} placeholder="e.g. 1 - Eucerin" />
		</div>
		<div>
			<Label>Revenue Locked (minus taxes)</Label>
			<Input type="number" step="0.01" bind:value={form.revenue_locked} />
		</div>
		<div>
			<Label>Profit Locked (TCH fee)</Label>
			<Input type="number" step="0.01" bind:value={form.profit_locked} />
		</div>
		<div class="col-span-2">
			<Label>Barter / PR Confirmations</Label>
			<Input bind:value={form.barter_confirmations} />
		</div>
		<div>
			<Label>Live Campaigns (count)</Label>
			<Input type="number" bind:value={form.live_campaigns} />
		</div>
		<div></div>
		<div class="col-span-2">
			<Label>Action Points for coming week</Label>
			<Textarea bind:value={form.action_points} />
		</div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
