<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type EntitySummary, type EntityRow } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';
	import Tag from '$lib/components/ui/tag.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

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

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Entity Summary · {fyLabelFor(fyStart)}
		</div>
		<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
			Billing Entity Summary
		</h1>
		<p class="text-[15px] max-w-[640px]" style="color: var(--n-fg-muted);">
			Total billing and TCH profit grouped by billing entity. Source: Commercial Tracking.
		</p>
	</header>

	<div
		class="flex flex-wrap items-center gap-2 pb-3"
		style="border-bottom: 1px solid var(--n-border);"
	>
		<div class="relative flex-1 min-w-[260px]">
			<span
				class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
				style="color: var(--n-fg-subtle);"
			>
				<Icon name="search" size={14} />
			</span>
			<input
				type="text"
				placeholder="Filter by entity name…"
				bind:value={searchInput}
				class="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
				onkeydown={(e) => e.key === 'Enter' && applyFilter()}
			/>
		</div>
		<Button variant="outline" onclick={applyFilter}>Filter</Button>
		{#if entityFilter}
			<Button variant="ghost" onclick={clearFilter}>Clear</Button>
		{/if}

		<div class="ml-auto flex items-center gap-2">
			<select
				id="fy-select-ent"
				class="h-7 rounded px-2 pr-7 text-[13px] appearance-none bg-no-repeat bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
				style="background-image: url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>&quot;); background-position: right 6px center; background-size: 12px 12px;"
				bind:value={fyStart}
				onchange={load}
			>
				<option value={2025}>{fyLabelFor(2025)}</option>
				<option value={2026}>{fyLabelFor(2026)}</option>
				<option value={2027}>{fyLabelFor(2027)}</option>
			</select>
			<Button variant="ghost" onclick={load}>
				<Icon name="refresh" size={14} /> Refresh
			</Button>
		</div>
	</div>

	{#if !loading && !error && data}
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
			<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
				<div
					class="text-[11.5px] font-medium uppercase"
					style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
				>
					{entityFilter ? `"${entityFilter}" Billing` : 'Total Billing'}
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					{inr(data.grand_total_billing)}
				</div>
			</div>
			<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
				<div
					class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
					style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]"></span>
					TCH Profit
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					{inr(data.grand_total_profit)}
				</div>
			</div>
			<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
				<div
					class="text-[11.5px] font-medium uppercase"
					style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
				>
					Entities
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					{data.entities.length}
				</div>
			</div>
			{#if entityFilter}
				<div
					class="rounded p-3"
					style="border: 1px solid var(--n-accent); background: var(--n-accent-soft);"
				>
					<div
						class="text-[11.5px] font-medium uppercase"
						style="color: var(--n-accent); letter-spacing: 0.04em;"
					>
						Filter Active
					</div>
					<div class="text-[15px] font-semibold mt-1" style="color: var(--n-fg);">
						{entityFilter}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if loading}
		<div class="text-[14px] py-8 text-center" style="color: var(--n-fg-subtle);">Loading…</div>
	{:else if error}
		<div
			class="text-[14px] rounded p-3"
			style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;"
		>
			Error: {error}
		</div>
	{:else if data}
		<div class="tbl-card">
			<div class="scroll-x">
				<table class="grid-table">
					<thead>
						<tr>
							<th class="w-6"></th>
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
						{#each data.entities as row (row.entity)}
							<tr
								class="cursor-pointer"
								onclick={() => toggleExpand(row.entity)}
							>
								<td class="text-center select-none" style="color: var(--n-fg-subtle);">
									{expandedEntity === row.entity ? '▾' : '▸'}
								</td>
								<td class="font-medium" style="color: var(--n-fg);">{row.entity}</td>
								<td class="num" style="color: var(--n-fg-muted);">{row.deal_count}</td>
								<td class="num tabular-nums" style="color: var(--n-fg);">
									{inr(row.total_billing)}
								</td>
								<td class="num font-semibold tabular-nums" style="color: #1f6f43;">
									{inr(row.total_profit)}
								</td>
								<td class="num" style="color: var(--n-fg-muted);">{profitPct(row)}</td>
								<td class="num" style="color: var(--n-fg-muted);">{row.creator_count}</td>
								<td class="text-[13px]" style="color: var(--n-fg-muted);">
									{row.top_brands.join(', ')}
								</td>
							</tr>
							{#if expandedEntity === row.entity}
								<tr style="background: var(--n-bg-soft);">
									<td></td>
									<td colspan="7" class="py-3 px-4">
										<div
											class="text-[11.5px] font-medium uppercase mb-2"
											style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
										>
											Creators billed under this entity
										</div>
										<div class="flex flex-wrap gap-1.5">
											{#each row.creators as c (c)}
												<Tag tone="accent">{c}</Tag>
											{/each}
											{#if row.creators.length === 0}
												<span
													class="text-[13px]"
													style="color: var(--n-fg-subtle);"
												>
													No linked creators
												</span>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
						{#if data.entities.length === 0}
							<tr>
								<td
									colspan="8"
									class="text-center py-8"
									style="color: var(--n-fg-subtle);"
								>
									No entity data for this FY{entityFilter ? ` matching "${entityFilter}"` : ''}.
								</td>
							</tr>
						{:else}
							<tr class="row-total">
								<td></td>
								<td>Grand Total</td>
								<td class="num">{data.entities.reduce((a, r) => a + r.deal_count, 0)}</td>
								<td class="num">{inr(data.grand_total_billing)}</td>
								<td class="num" style="color: #1f6f43;">{inr(data.grand_total_profit)}</td>
								<td class="num">
									{#if Number(data.grand_total_billing)}
										{(
											(Number(data.grand_total_profit) /
												Number(data.grand_total_billing)) *
											100
										).toFixed(1)}%
									{:else}—{/if}
								</td>
								<td colspan="2"></td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
			<div class="tbl-caption">
				<span>Tip · click a row to expand creators linked to that billing entity.</span>
			</div>
		</div>
	{/if}
</section>
