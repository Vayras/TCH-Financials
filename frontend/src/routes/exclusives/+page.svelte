<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type QuarterlyExclusive } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

	let fyStart = $state(2025);
	let rows = $state<QuarterlyExclusive[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let creatorFilter = $state('');

	async function load() {
		loading = true;
		try {
			const d = await api.get<{ rows: QuarterlyExclusive[] }>(
				`/exclusives/quarterly/?fy=${fyStart}`
			);
			rows = d.rows;
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

	let allCreators = $derived.by(() => {
		const names = [...new Set(rows.map((r) => r.creator_name))].sort();
		return names;
	});

	let filteredRows = $derived.by(() => {
		if (!creatorFilter) return rows;
		return rows.filter((r) => r.creator_name === creatorFilter);
	});

	let grouped = $derived.by(() => {
		const m = new Map<string, QuarterlyExclusive[]>();
		for (const r of filteredRows) {
			if (!m.has(r.creator_name)) m.set(r.creator_name, []);
			m.get(r.creator_name)!.push(r);
		}
		return Array.from(m.entries());
	});

	function rowFor(creatorRows: QuarterlyExclusive[], q: string): QuarterlyExclusive | null {
		return creatorRows.find((r) => r.quarter === q) ?? null;
	}

	function sumField(creatorRows: QuarterlyExclusive[], field: keyof QuarterlyExclusive): number {
		return creatorRows.reduce((a, r) => a + Number(r[field] || 0), 0);
	}

	let grandTotalBilling = $derived(
		filteredRows.reduce(
			(a, r) => a + Number(r.inbound_amount || 0) + Number(r.outbound_amount || 0),
			0
		)
	);
	let grandTotalProfit = $derived(
		filteredRows.reduce(
			(a, r) => a + Number(r.inbound_tch_profit || 0) + Number(r.outbound_tch_profit || 0),
			0
		)
	);

	const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
	const QLABEL: Record<string, string> = {
		Q1: 'Q1 (Apr-Jun)',
		Q2: 'Q2 (Jul-Sep)',
		Q3: 'Q3 (Oct-Dec)',
		Q4: 'Q4 (Jan-Mar)'
	};
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Exclusives · {fyLabelFor(fyStart)}
		</div>
		<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
			Exclusives — Quarterly Summary
		</h1>
		<p class="text-[15px] max-w-[640px]" style="color: var(--n-fg-muted);">
			Derived from Commercial Tracking. One row per exclusive creator, broken out by FY quarter.
		</p>
	</header>

	<div class="flex flex-wrap items-center gap-2 pb-3" style="border-bottom: 1px solid var(--n-border);">
		<select
			id="creator-filter"
			class="h-7 rounded px-2 pr-7 text-[13px] appearance-none bg-no-repeat bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors"
			style="background-image: url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>&quot;); background-position: right 6px center; background-size: 12px 12px;"
			bind:value={creatorFilter}
		>
			<option value="">All creators</option>
			{#each allCreators as name (name)}
				<option value={name}>{name}</option>
			{/each}
		</select>

		<div class="ml-auto flex items-center gap-2">
			<select
				id="fy-select-excl"
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

	{#if !loading && !error && rows.length > 0}
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
			<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
				<div
					class="text-[11.5px] font-medium uppercase"
					style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
				>
					Total Billing
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					{inr(String(grandTotalBilling))}
				</div>
			</div>
			<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
				<div
					class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
					style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-[#a371d3]"></span>
					TCH Profit
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					{inr(String(grandTotalProfit))}
				</div>
			</div>
			{#if creatorFilter}
				<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
					<div
						class="text-[11.5px] font-medium uppercase"
						style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
					>
						Filtered to
					</div>
					<div class="text-[16px] font-semibold mt-1" style="color: var(--n-fg);">
						{creatorFilter}
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
	{:else}
		<div class="tbl-card">
			<div class="scroll-x">
				<table class="grid-table">
					<thead>
						<tr>
							<th>Creator</th>
							<th class="w-[110px] whitespace-nowrap">Quarter</th>
							<th class="num">In Deals</th>
							<th class="num">Inbound Invoiced</th>
							<th class="num">In Creator Fee</th>
							<th class="num">In TCH Profit</th>
							<th class="num">Out Deals</th>
							<th class="num">Outbound Invoiced</th>
							<th class="num">Out Creator Fee</th>
							<th class="num">Out TCH Profit</th>
							<th>Common Deliverable</th>
							<th>Top Brands</th>
							<th>Repeat Brands</th>
						</tr>
					</thead>
					<tbody>
						{#each grouped as [name, creatorRows] (name)}
							{#each QUARTERS as q, qi (q)}
								{@const r = rowFor(creatorRows, q)}
								<tr>
									{#if qi === 0}
										<td rowspan="5" class="align-top font-medium" style="color: var(--n-fg);">
											{name}
										</td>
									{/if}
									<td class="whitespace-nowrap" style="color: var(--n-fg-muted);">
										{QLABEL[q]}
									</td>
									<td class="num" style="color: var(--n-fg-muted);">{r?.inbound_count ?? 0}</td>
									<td class="num" style="color: var(--n-fg-muted);">{inr(r?.inbound_amount)}</td>
									<td class="num" style="color: var(--n-fg-muted);">
										{inr(r?.inbound_creator_fee)}
									</td>
									<td class="num" style="color: #52298f;">{inr(r?.inbound_tch_profit)}</td>
									<td class="num" style="color: var(--n-fg-muted);">{r?.outbound_count ?? 0}</td>
									<td class="num" style="color: var(--n-fg-muted);">{inr(r?.outbound_amount)}</td>
									<td class="num" style="color: var(--n-fg-muted);">
										{inr(r?.outbound_creator_fee)}
									</td>
									<td class="num" style="color: #52298f;">{inr(r?.outbound_tch_profit)}</td>
									<td style="color: var(--n-fg-muted);">{r?.common_deliverable ?? ''}</td>
									<td style="color: var(--n-fg-muted);">
										{r?.top_brands?.join(', ') ?? ''}
									</td>
									<td style="color: var(--n-fg-muted);">
										{r?.repeat_brands?.join(', ') ?? ''}
									</td>
								</tr>
							{/each}
							<tr class="row-total">
								<td>Total</td>
								<td class="num">{sumField(creatorRows, 'inbound_count')}</td>
								<td class="num">{inr(String(sumField(creatorRows, 'inbound_amount')))}</td>
								<td class="num">{inr(String(sumField(creatorRows, 'inbound_creator_fee')))}</td>
								<td class="num" style="color: #52298f;">
									{inr(String(sumField(creatorRows, 'inbound_tch_profit')))}
								</td>
								<td class="num">{sumField(creatorRows, 'outbound_count')}</td>
								<td class="num">{inr(String(sumField(creatorRows, 'outbound_amount')))}</td>
								<td class="num">
									{inr(String(sumField(creatorRows, 'outbound_creator_fee')))}
								</td>
								<td class="num" style="color: #52298f;">
									{inr(String(sumField(creatorRows, 'outbound_tch_profit')))}
								</td>
								<td colspan="3"></td>
							</tr>
						{/each}
						{#if grouped.length === 0}
							<tr>
								<td colspan="13" class="text-center py-8" style="color: var(--n-fg-subtle);">
									No exclusive creator deals in this FY.
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
			<div class="tbl-caption">
				<span>Tip · scroll horizontally to see Out-Deal columns and brand lists.</span>
			</div>
		</div>
	{/if}
</section>
