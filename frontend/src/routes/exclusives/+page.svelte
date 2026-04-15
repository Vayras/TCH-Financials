<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type QuarterlyExclusive } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';

	let fyStart = $state(2025);
	let rows = $state<QuarterlyExclusive[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		try {
			const d = await api.get<{ rows: QuarterlyExclusive[] }>(`/exclusives/quarterly/?fy=${fyStart}`);
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

	// Group rows by creator so the table renders like the spreadsheet:
	// creator row spans 4 quarter rows.
	let grouped = $derived.by(() => {
		const m = new Map<string, QuarterlyExclusive[]>();
		for (const r of rows) {
			if (!m.has(r.creator_name)) m.set(r.creator_name, []);
			m.get(r.creator_name)!.push(r);
		}
		return Array.from(m.entries());
	});

	function rowFor(creatorRows: QuarterlyExclusive[], q: string): QuarterlyExclusive | null {
		return creatorRows.find((r) => r.quarter === q) ?? null;
	}

	function totalFor(creatorRows: QuarterlyExclusive[], field: 'inbound_amount' | 'outbound_amount' | 'inbound_creator_fee' | 'outbound_creator_fee'): string {
		const sum = creatorRows.reduce((a, r) => a + Number(r[field] || 0), 0);
		return String(sum);
	}

	const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
	const QLABEL: Record<string, string> = {
		Q1: 'Q1 (Apr-Jun)',
		Q2: 'Q2 (Jul-Sep)',
		Q3: 'Q3 (Oct-Dec)',
		Q4: 'Q4 (Jan-Mar)'
	};
</script>

<section class="space-y-3">
	<div class="flex items-end justify-between flex-wrap gap-2">
		<div>
			<h1 class="text-[18px] font-semibold uppercase tracking-wide">Exclusives — Quarterly Summary</h1>
			<p class="text-[12px] text-neutral-700">Derived from Commercial Tracking. Each exclusive creator, per quarter.</p>
		</div>
		<div class="flex items-center gap-2">
			<label class="text-[11px] uppercase tracking-wide" for="fy-select-excl">Fiscal Year</label>
			<select
				id="fy-select-excl"
				class="h-8 border border-black bg-white px-2 text-[13px]"
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

	{#if loading}
		<div class="text-[13px] text-neutral-700">Loading…</div>
	{:else if error}
		<div class="text-[13px] border border-black p-2">Error: {error}</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="grid-table">
				<thead>
					<tr>
						<th>Creator</th>
						<th class="w-[110px] whitespace-nowrap">Quarter</th>
						<th class="num">Inbound Deals</th>
						<th class="num">Inbound Invoiced</th>
						<th class="num">Inbound Creator Fee</th>
						<th class="num">Outbound Deals</th>
						<th class="num">Outbound Invoiced</th>
						<th class="num">Outbound Creator Fee</th>
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
									<td rowspan="5" class="align-top font-medium">{name}</td>
								{/if}
								<td class="whitespace-nowrap">{QLABEL[q]}</td>
								<td class="num">{r?.inbound_count ?? 0}</td>
								<td class="num">{inr(r?.inbound_amount)}</td>
								<td class="num">{inr(r?.inbound_creator_fee)}</td>
								<td class="num">{r?.outbound_count ?? 0}</td>
								<td class="num">{inr(r?.outbound_amount)}</td>
								<td class="num">{inr(r?.outbound_creator_fee)}</td>
								<td>{r?.common_deliverable ?? ''}</td>
								<td>{r?.top_brands?.join(', ') ?? ''}</td>
								<td>{r?.repeat_brands?.join(', ') ?? ''}</td>
							</tr>
						{/each}
						<tr class="row-total">
							<td>Total</td>
							<td class="num">{creatorRows.reduce((a, r) => a + r.inbound_count, 0)}</td>
							<td class="num">{inr(totalFor(creatorRows, 'inbound_amount'))}</td>
							<td class="num">{inr(totalFor(creatorRows, 'inbound_creator_fee'))}</td>
							<td class="num">{creatorRows.reduce((a, r) => a + r.outbound_count, 0)}</td>
							<td class="num">{inr(totalFor(creatorRows, 'outbound_amount'))}</td>
							<td class="num">{inr(totalFor(creatorRows, 'outbound_creator_fee'))}</td>
							<td colspan="3"></td>
						</tr>
					{/each}
					{#if grouped.length === 0}
						<tr><td colspan="11" class="text-center text-neutral-700">No exclusive creator deals in this FY.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>
