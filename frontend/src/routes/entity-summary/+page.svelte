<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type EntitySummary, type EntityRow } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';

	let fyStart = $state(2025);
	let entityFilter = $state('');
	let searchInput = $state('');
	let data = $state<EntitySummary | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let expandedEntity = $state<string | null>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const params = new URLSearchParams({ fy: String(fyStart) });
			if (entityFilter) params.set('entity', entityFilter);
			data = await api.get<EntitySummary>(`/entity-summary/?${params}`);
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

	function applyFilter() {
		entityFilter = searchInput.trim();
		load();
	}

	function clearFilter() {
		searchInput = '';
		entityFilter = '';
		load();
	}

	function toggleExpand(entity: string) {
		expandedEntity = expandedEntity === entity ? null : entity;
	}

	function profitPct(row: EntityRow): string {
		const billing = Number(row.total_billing);
		const profit = Number(row.total_profit);
		if (!billing) return '—';
		return `${((profit / billing) * 100).toFixed(1)}%`;
	}
</script>

<section class="space-y-4">
	<div class="flex items-end justify-between flex-wrap gap-2">
		<div>
			<h1 class="text-[20px] font-semibold uppercase tracking-wide">Billing Entity Summary</h1>
			<p class="text-[14px] text-neutral-700">Total billing and TCH profit grouped by billing entity. Source: Commercial Tracking.</p>
		</div>
		<div class="flex items-center gap-2 flex-wrap">
			<input
				type="text"
				placeholder="Filter by entity name…"
				bind:value={searchInput}
				class="h-8 border border-black bg-white px-2 text-[15px] w-52"
				onkeydown={(e) => e.key === 'Enter' && applyFilter()}
			/>
			<Button variant="outline" onclick={applyFilter}>Filter</Button>
			{#if entityFilter}
				<Button variant="outline" onclick={clearFilter}>Clear</Button>
			{/if}

			<label class="text-[13px] uppercase tracking-wide" for="fy-select-ent">FY</label>
			<select
				id="fy-select-ent"
				class="h-8 border border-black bg-white px-2 text-[15px]"
				bind:value={fyStart}
				onchange={load}
			>
				<option value={2025}>{fyLabelFor(2025)}</option>
				<option value={2026}>{fyLabelFor(2026)}</option>
				<option value={2027}>{fyLabelFor(2027)}</option>
			</select>
			<Button variant="outline" onclick={load}>Refresh</Button>
		</div>
	</div>

	{#if !loading && !error && data}
		<div class="flex gap-4 flex-wrap">
			<div class="border border-black px-4 py-2 min-w-[180px]">
				<div class="text-[11px] uppercase tracking-wide text-neutral-600">
					{entityFilter ? `"${entityFilter}" Billing` : 'Total Billing'}
				</div>
				<div class="text-[22px] font-bold">{inr(data.grand_total_billing)}</div>
			</div>
			<div class="border border-black px-4 py-2 min-w-[180px]">
				<div class="text-[11px] uppercase tracking-wide text-neutral-600">TCH Profit</div>
				<div class="text-[22px] font-bold text-emerald-700">{inr(data.grand_total_profit)}</div>
			</div>
			<div class="border border-black px-4 py-2 min-w-[140px]">
				<div class="text-[11px] uppercase tracking-wide text-neutral-600">Entities</div>
				<div class="text-[22px] font-bold">{data.entities.length}</div>
			</div>
			{#if entityFilter}
				<div class="border border-black px-4 py-2 min-w-[160px] border-emerald-400">
					<div class="text-[11px] uppercase tracking-wide text-emerald-700">Filter Active</div>
					<div class="text-[15px] font-semibold">{entityFilter}</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if loading}
		<div class="text-[15px] text-neutral-700">Loading…</div>
	{:else if error}
		<div class="text-[15px] border border-black p-2">Error: {error}</div>
	{:else if data}
		<div class="overflow-x-auto">
			<table class="grid-table">
				<thead>
					<tr>
						<th></th>
						<th>Billing Entity</th>
						<th class="num">Deals</th>
						<th class="num">Total Billing</th>
						<th class="num">TCH Profit</th>
						<th class="num">Profit %</th>
						<th class="num">Creators</th>
						<th>Top Brands</th>
					</tr>
				</thead>
				<tbody>
					{#each data.entities as row, i (row.entity)}
						<tr
							class="cursor-pointer hover:bg-emerald-50"
							onclick={() => toggleExpand(row.entity)}
						>
							<td class="text-center text-neutral-400 w-6 select-none">
								{expandedEntity === row.entity ? '▾' : '▸'}
							</td>
							<td class="font-medium">{row.entity}</td>
							<td class="num">{row.deal_count}</td>
							<td class="num">{inr(row.total_billing)}</td>
							<td class="num text-emerald-700 font-semibold">{inr(row.total_profit)}</td>
							<td class="num">{profitPct(row)}</td>
							<td class="num">{row.creator_count}</td>
							<td class="text-[13px]">{row.top_brands.join(', ')}</td>
						</tr>
						{#if expandedEntity === row.entity}
							<tr class="bg-emerald-50/60">
								<td></td>
								<td colspan="7" class="py-2 px-3">
									<div class="text-[12px] uppercase tracking-wide text-neutral-500 mb-1">Creators billed under this entity</div>
									<div class="flex flex-wrap gap-1">
										{#each row.creators as c (c)}
											<span class="border border-emerald-300 bg-emerald-100 text-emerald-900 text-[13px] px-2 py-0.5 rounded-sm">{c}</span>
										{/each}
										{#if row.creators.length === 0}
											<span class="text-neutral-500 text-[13px]">No linked creators</span>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
					{#if data.entities.length === 0}
						<tr><td colspan="8" class="text-center text-neutral-700">No entity data for this FY{entityFilter ? ` matching "${entityFilter}"` : ''}.</td></tr>
					{:else}
						<tr class="row-total">
							<td></td>
							<td>Grand Total</td>
							<td class="num">{data.entities.reduce((a, r) => a + r.deal_count, 0)}</td>
							<td class="num">{inr(data.grand_total_billing)}</td>
							<td class="num text-emerald-700">{inr(data.grand_total_profit)}</td>
							<td class="num">
								{#if Number(data.grand_total_billing)}
									{((Number(data.grand_total_profit) / Number(data.grand_total_billing)) * 100).toFixed(1)}%
								{:else}—{/if}
							</td>
							<td colspan="2"></td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
		<p class="text-[12px] text-neutral-500">Click a row to expand creators linked to that billing entity.</p>
	{/if}
</section>
