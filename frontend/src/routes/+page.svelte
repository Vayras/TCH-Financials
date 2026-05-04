<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Overview } from '$lib/api';
	import { inr, pct } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

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

	const BUCKET_DOT: Record<string, string> = {
		Exclusive: 'bg-[#a371d3]',
		Dropping: 'bg-[#d9730d]',
		Friend: 'bg-[#0f7b6c]',
		NonTCH: 'bg-[#9b9a97]'
	};
</script>

<section class="space-y-8">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Dashboard · {fyLabelFor(fyStart)}
		</div>
		<h1
			class="page-title text-[40px] leading-[1.15] font-bold"
			style="color: var(--n-fg);"
		>
			Current Overview
		</h1>
		<p class="text-[15px] max-w-[640px]" style="color: var(--n-fg-muted);">
			Total billing by bucket, derived live from Commercial Tracking. Add a deal there
			and the numbers below recompute on the next load.
		</p>
	</header>

	<div
		class="flex items-center gap-3 flex-wrap pb-3"
		style="border-bottom: 1px solid var(--n-border);"
	>
		<div class="seg-toggle">
			<button class:active={view === 'month'} onclick={() => (view = 'month')}>Month</button>
			<button class:active={view === 'quarter'} onclick={() => (view = 'quarter')}>Quarter</button>
		</div>

		<div class="ml-auto flex items-center gap-2">
			<select
				id="fy-select"
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
		{@const cols = view === 'month' ? data.months : data.quarters}
		{@const src =
			view === 'month'
				? {
						totals: data.totals.by_month,
						emw: data.emw_billing.by_month,
						profits: data.profits.by_month,
						emwPct: data.emw_pct.by_month,
						profitPct: data.profit_pct.by_month
					}
				: {
						totals: data.totals.by_quarter,
						emw: data.emw_billing.by_quarter,
						profits: data.profits.by_quarter,
						emwPct: data.emw_pct.by_quarter,
						profitPct: data.profit_pct.by_quarter
					}}

		<div class="tbl-card">
			<div class="scroll-x">
			<table class="grid-table with-sticky-first">
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
							<td>
								<span class="inline-flex items-center gap-2">
									<span class="h-1.5 w-1.5 rounded-full {BUCKET_DOT[b] ?? ''}"></span>
									<span class="font-medium" style="color: var(--n-fg);">{row.label}</span>
								</span>
							</td>
							{#each cols as c (c.key)}
								<td class="num" style="color: var(--n-fg-muted);">
									{inr(bySel[c.key]) || '—'}
								</td>
							{/each}
							<td class="num font-semibold" style="color: var(--n-fg);">{inr(row.total)}</td>
						</tr>
					{/each}

					<tr class="row-total">
						<td>Total Billing</td>
						{#each cols as c (c.key)}
							<td class="num">{inr(src.totals[c.key]) || '—'}</td>
						{/each}
						<td class="num">{inr(data.totals.total)}</td>
					</tr>
					<tr>
						<td>
							<span class="inline-flex items-center gap-2">
								<span class="h-1.5 w-1.5 rounded-full bg-[#19567c]"></span>
								<span style="color: var(--n-fg);">EMW Billing</span>
							</span>
						</td>
						{#each cols as c (c.key)}
							<td class="num" style="color: var(--n-fg-muted);">
								{inr(src.emw[c.key]) || '—'}
							</td>
						{/each}
						<td class="num font-semibold" style="color: var(--n-fg);">
							{inr(data.emw_billing.total)}
						</td>
					</tr>
					<tr>
						<td style="color: var(--n-fg-muted);">EMW Billing %</td>
						{#each cols as c (c.key)}
							<td class="num" style="color: var(--n-fg-subtle);">
								{pct(src.emwPct[c.key]) || '—'}
							</td>
						{/each}
						<td class="num" style="color: var(--n-fg-muted);">{pct(data.emw_pct.total)}</td>
					</tr>
					<tr>
						<td>
							<span class="inline-flex items-center gap-2">
								<span class="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]"></span>
								<span style="color: var(--n-fg);">Profits (TCH Fee)</span>
							</span>
						</td>
						{#each cols as c (c.key)}
							<td class="num" style="color: var(--n-fg-muted);">
								{inr(src.profits[c.key]) || '—'}
							</td>
						{/each}
						<td class="num font-semibold" style="color: var(--n-fg);">
							{inr(data.profits.total)}
						</td>
					</tr>
					<tr>
						<td style="color: var(--n-fg-muted);">Profit Ratio</td>
						{#each cols as c (c.key)}
							<td class="num" style="color: var(--n-fg-subtle);">
								{pct(src.profitPct[c.key]) || '—'}
							</td>
						{/each}
						<td class="num" style="color: var(--n-fg-muted);">{pct(data.profit_pct.total)}</td>
					</tr>
				</tbody>
			</table>
			</div>
			<div class="tbl-caption">
				<span>Tip · scroll horizontally to see more months when the table overflows.</span>
			</div>
		</div>

		<div class="text-[13px]" style="color: var(--n-fg-subtle);">
			Buckets are derived from each creator's relationship (Exclusive / Friend / Dropping /
			Non-TCH). EMW billing is the subset of deals where the billing entity contains "EMW".
		</div>
	{/if}
</section>
