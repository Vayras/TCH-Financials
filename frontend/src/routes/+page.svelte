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
		loading = true;
		error = null;
		try {
			data = await api.get<Overview>(`/overview/?fy=${fyStart}`);
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function fyLabelFor(start: number): string {
		return `FY ${start % 100}-${(start + 1) % 100}`;
	}
</script>

<section class="space-y-4">
	<div class="flex items-end justify-between flex-wrap gap-2">
		<div>
			<h1 class="text-[18px] font-semibold uppercase tracking-wide">Current Overview</h1>
			<p class="text-[12px] text-neutral-700">Derived live from Commercial Tracking. Add a deal there, and these numbers update.</p>
		</div>
		<div class="flex items-center gap-2">
			<label class="text-[11px] uppercase tracking-wide" for="fy-select">Fiscal Year</label>
			<select
				id="fy-select"
				class="h-8 border border-black bg-white px-2 text-[13px]"
				bind:value={fyStart}
				onchange={load}
			>
				<option value={2025}>{fyLabelFor(2025)}</option>
				<option value={2026}>{fyLabelFor(2026)}</option>
				<option value={2027}>{fyLabelFor(2027)}</option>
			</select>
			<Button variant={view === 'month' ? 'primary' : 'outline'} onclick={() => (view = 'month')}>
				Month
			</Button>
			<Button variant={view === 'quarter' ? 'primary' : 'outline'} onclick={() => (view = 'quarter')}>
				Quarter
			</Button>
			<Button variant="outline" onclick={load}>Refresh</Button>
		</div>
	</div>

	{#if loading}
		<div class="text-[13px] text-neutral-700">Loading…</div>
	{:else if error}
		<div class="text-[13px] text-black border border-black p-2">Error: {error}</div>
	{:else if data}
		{@const cols = view === 'month' ? data.months : data.quarters}
		{@const src =
			view === 'month'
				? { totals: data.totals.by_month, emw: data.emw_billing.by_month, profits: data.profits.by_month, emwPct: data.emw_pct.by_month, profitPct: data.profit_pct.by_month }
				: { totals: data.totals.by_quarter, emw: data.emw_billing.by_quarter, profits: data.profits.by_quarter, emwPct: data.emw_pct.by_quarter, profitPct: data.profit_pct.by_quarter }}

		<div class="overflow-x-auto">
			<table class="grid-table">
				<thead>
					<tr>
						<th class="w-[220px]">{data.fy} Billing</th>
						{#each cols as c (c.key)}
							<th class="num">{c.label}</th>
						{/each}
						<th class="num">FY Total</th>
					</tr>
				</thead>
				<tbody>
					{#each data.bucket_order as b (b)}
						{@const row = data.rows[b]}
						{@const bySel = view === 'month' ? row.by_month : row.by_quarter}
						<tr>
							<td>{row.label}</td>
							{#each cols as c (c.key)}
								<td class="num">{inr(bySel[c.key])}</td>
							{/each}
							<td class="num">{inr(row.total)}</td>
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
						<td>EMW Billing</td>
						{#each cols as c (c.key)}
							<td class="num">{inr(src.emw[c.key])}</td>
						{/each}
						<td class="num">{inr(data.emw_billing.total)}</td>
					</tr>
					<tr>
						<td>EMW Billing %</td>
						{#each cols as c (c.key)}
							<td class="num">{pct(src.emwPct[c.key])}</td>
						{/each}
						<td class="num">{pct(data.emw_pct.total)}</td>
					</tr>
					<tr>
						<td>Profits (TCH Fee)</td>
						{#each cols as c (c.key)}
							<td class="num">{inr(src.profits[c.key])}</td>
						{/each}
						<td class="num">{inr(data.profits.total)}</td>
					</tr>
					<tr>
						<td>Profit Ratio</td>
						{#each cols as c (c.key)}
							<td class="num">{pct(src.profitPct[c.key])}</td>
						{/each}
						<td class="num">{pct(data.profit_pct.total)}</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="text-[11px] text-neutral-700 uppercase tracking-wide">
			Buckets are derived from each creator's relationship (Exclusive / Friend / Dropping / Non TCH).
			EMW billing is the subset of deals where the billing entity contains "EMW".
		</div>
	{/if}
</section>
