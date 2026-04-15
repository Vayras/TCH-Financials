<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Overview } from '$lib/api';
	import { inr, pct } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';

	let fyStart = $state(2025);
	let data = $state<Overview | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let view = $state<'month' | 'quarter'>('month');

	async function load() {
		loading = true; error = null;
		try { data = await api.get<Overview>(`/overview/?fy=${fyStart}`); }
		catch (e) { error = (e as Error).message; } finally { loading = false; }
	}

	onMount(load);

	function fyLabelFor(start: number): string {
		return `FY ${start % 100}-${(start + 1) % 100}`;
	}

	const BUCKET_COLORS: Record<string, string> = {
		Exclusive: 'text-violet-700',
		Dropping: 'text-orange-600',
		Friend: 'text-emerald-700',
		NonTCH: 'text-slate-600',
	};
</script>

<section class="space-y-4">
	<div class="border-b-2 border-slate-700 -mx-4 px-4 pb-3">
		<div class="flex items-end justify-between flex-wrap gap-2">
			<div>
				<h1 class="text-[18px] font-semibold uppercase tracking-wide text-slate-900">Current Overview</h1>
				<p class="text-[12px] text-slate-500">Derived live from Commercial Tracking. Add a deal there and these numbers update.</p>
			</div>
			<div class="flex items-center gap-2">
				<label class="text-[11px] uppercase tracking-wide text-slate-600 font-medium" for="fy-select">Fiscal Year</label>
				<select
					id="fy-select"
					class="h-8 border border-slate-300 bg-white px-2 text-[13px] rounded-sm"
					bind:value={fyStart}
					onchange={load}
				>
					<option value={2025}>{fyLabelFor(2025)}</option>
					<option value={2026}>{fyLabelFor(2026)}</option>
					<option value={2027}>{fyLabelFor(2027)}</option>
				</select>
				<Button variant={view === 'month' ? 'primary' : 'outline'} onclick={() => (view = 'month')}>Month</Button>
				<Button variant={view === 'quarter' ? 'primary' : 'outline'} onclick={() => (view = 'quarter')}>Quarter</Button>
				<Button variant="outline" onclick={load}>Refresh</Button>
			</div>
		</div>
	</div>

	{#if loading}
		<div class="text-[13px] text-slate-500">Loading…</div>
	{:else if error}
		<div class="text-[13px] border border-rose-300 bg-rose-50 text-rose-800 p-2 rounded-sm">Error: {error}</div>
	{:else if data}
		{@const cols = view === 'month' ? data.months : data.quarters}
		{@const src = view === 'month'
			? { totals: data.totals.by_month, emw: data.emw_billing.by_month, profits: data.profits.by_month, emwPct: data.emw_pct.by_month, profitPct: data.profit_pct.by_month }
			: { totals: data.totals.by_quarter, emw: data.emw_billing.by_quarter, profits: data.profits.by_quarter, emwPct: data.emw_pct.by_quarter, profitPct: data.profit_pct.by_quarter }}

		<div class="overflow-x-auto rounded-sm border border-slate-200">
			<table class="grid-table">
				<thead>
					<tr>
						<th class="w-[200px] bg-slate-800 text-white">{data.fy} Billing</th>
						{#each cols as c (c.key)}
							<th class="num bg-slate-800 text-white">{c.label}</th>
						{/each}
						<th class="num bg-slate-900 text-white">FY Total</th>
					</tr>
				</thead>
				<tbody>
					{#each data.bucket_order as b (b)}
						{@const row = data.rows[b]}
						{@const bySel = view === 'month' ? row.by_month : row.by_quarter}
						<tr>
							<td class="font-medium {BUCKET_COLORS[b] ?? ''}">{row.label}</td>
							{#each cols as c (c.key)}
								<td class="num">{inr(bySel[c.key])}</td>
							{/each}
							<td class="num font-semibold">{inr(row.total)}</td>
						</tr>
					{/each}

					<tr class="row-total">
						<td>Total Billing</td>
						{#each cols as c (c.key)}
							<td class="num">{inr(src.totals[c.key])}</td>
						{/each}
						<td class="num">{inr(data.totals.total)}</td>
					</tr>
					<tr>
						<td class="text-blue-700">EMW Billing</td>
						{#each cols as c (c.key)}
							<td class="num text-blue-700">{inr(src.emw[c.key])}</td>
						{/each}
						<td class="num text-blue-700 font-semibold">{inr(data.emw_billing.total)}</td>
					</tr>
					<tr>
						<td class="text-blue-500">EMW Billing %</td>
						{#each cols as c (c.key)}
							<td class="num text-blue-500">{pct(src.emwPct[c.key])}</td>
						{/each}
						<td class="num text-blue-500">{pct(data.emw_pct.total)}</td>
					</tr>
					<tr>
						<td class="text-emerald-700">Profits (TCH Fee)</td>
						{#each cols as c (c.key)}
							<td class="num text-emerald-700">{inr(src.profits[c.key])}</td>
						{/each}
						<td class="num text-emerald-700 font-semibold">{inr(data.profits.total)}</td>
					</tr>
					<tr>
						<td class="text-emerald-500">Profit Ratio</td>
						{#each cols as c (c.key)}
							<td class="num text-emerald-500">{pct(src.profitPct[c.key])}</td>
						{/each}
						<td class="num text-emerald-500">{pct(data.profit_pct.total)}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="text-[11px] text-slate-400 uppercase tracking-wide">
			Buckets are derived from each creator's relationship (Exclusive / Friend / Dropping / Non TCH).
			EMW billing is the subset of deals where the billing entity contains "EMW".
		</div>
	{/if}
</section>
