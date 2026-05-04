<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type CreatorInsights, type CreatorInsight } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';
	import Tag from '$lib/components/ui/tag.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

	let fyStart = $state(2025);
	let data = $state<CreatorInsights | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let q = $state('');
	let relFilter = $state<'All' | 'Exclusive' | 'Friend' | 'Dropping' | 'NonTCH'>('All');

	async function load() {
		loading = true;
		error = null;
		try {
			data = await api.get<CreatorInsights>(`/creator-insights/?fy=${fyStart}`);
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

	function relTone(rel: string) {
		if (rel === 'Exclusive') return 'exclusive' as const;
		if (rel === 'Dropping') return 'dropping' as const;
		if (rel === 'NonTCH') return 'nontch' as const;
		return 'friend' as const;
	}

	function pct(s: string): string {
		const n = Number(s);
		if (!Number.isFinite(n) || n === 0) return '0%';
		return `${(n * 100).toFixed(1)}%`;
	}

	function formatDate(s: string | null): string {
		if (!s) return '—';
		const d = new Date(s);
		return d.toLocaleDateString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: '2-digit'
		});
	}

	function spanDays(first: string | null, last: string | null): string {
		if (!first || !last) return '—';
		const f = new Date(first).getTime();
		const l = new Date(last).getTime();
		const days = Math.max(0, Math.round((l - f) / (1000 * 60 * 60 * 24)));
		if (days === 0) return 'same day';
		if (days < 30) return `${days} days`;
		if (days < 365) return `${Math.round(days / 30)} mo`;
		return `${(days / 365).toFixed(1)} yr`;
	}

	let filtered = $derived.by(() => {
		if (!data) return [];
		const needle = q.trim().toLowerCase();
		return data.creators.filter((c) => {
			if (relFilter !== 'All' && c.relationship !== relFilter) return false;
			if (!needle) return true;
			return (
				c.creator_name.toLowerCase().includes(needle) ||
				c.category.toLowerCase().includes(needle) ||
				c.top_brands.some((b) => b.toLowerCase().includes(needle))
			);
		});
	});

	function maxMonthly(c: CreatorInsight): number {
		let m = 0;
		for (const v of Object.values(c.by_month)) {
			const n = Number(v);
			if (n > m) m = n;
		}
		return m;
	}
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Creator Insights · {fyLabelFor(fyStart)}
		</div>
		<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
			Per-Creator Campaign Insights
		</h1>
		<p class="text-[15px] max-w-[680px]" style="color: var(--n-fg-muted);">
			Lifetime-in-FY view per creator: deal mix, billing & profit, brand and deliverable patterns,
			activity timeline. Derived from Commercial Tracking. Sorted by billing.
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
				placeholder="Search creator, category, brand…"
				class="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
				bind:value={q}
			/>
		</div>
		<div class="seg-toggle">
			{#each ['All', 'Exclusive', 'Friend', 'Dropping', 'NonTCH'] as f (f)}
				<button
					type="button"
					class:active={relFilter === f}
					onclick={() => (relFilter = f as typeof relFilter)}
				>
					{f === 'NonTCH' ? 'Non TCH' : f}
				</button>
			{/each}
		</div>
		<div class="ml-auto flex items-center gap-2">
			<select
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
					Creators
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					{filtered.length}<span class="text-[14px]" style="color: var(--n-fg-subtle);"
						>&nbsp;/ {data.creator_count}</span
					>
				</div>
			</div>
			<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
				<div
					class="text-[11.5px] font-medium uppercase"
					style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
				>
					Deals (FY)
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					{data.grand_total_deals}
				</div>
			</div>
			<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
				<div
					class="text-[11.5px] font-medium uppercase"
					style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
				>
					Total Billing
				</div>
				<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
					₹ {inr(data.grand_total_billing)}
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
					₹ {inr(data.grand_total_profit)}
				</div>
			</div>
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
		{#if filtered.length === 0}
			<div
				class="rounded p-8 text-center text-[14px]"
				style="border: 1px dashed var(--n-border); color: var(--n-fg-subtle);"
			>
				No creators match the current filters.
			</div>
		{:else}
			<div class="space-y-3">
				{#each filtered as c (c.creator_id ?? c.creator_name)}
					{@const max = maxMonthly(c)}
					<article
						class="rounded-md p-5 border border-[var(--n-border)] bg-[var(--n-bg)] shadow-[0_1px_2px_rgba(15,15,15,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[#a96b50] hover:shadow-[0_4px_18px_rgba(169,107,80,0.12)]"
					>
						<div class="flex items-start justify-between gap-3 flex-wrap">
							<div class="space-y-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<h2
										class="page-title text-[22px] font-semibold leading-tight"
										style="color: var(--n-fg);"
									>
										{c.creator_name}
									</h2>
									<Tag tone={relTone(c.relationship)}>
										{c.relationship === 'NonTCH' ? 'Non TCH' : c.relationship}
									</Tag>
								</div>
								<div class="text-[13px] flex flex-wrap gap-x-3 gap-y-1" style="color: var(--n-fg-subtle);">
									{#if c.category}<span>{c.category}</span>{/if}
									{#if c.ops_manager}<span>·</span><span>Ops: {c.ops_manager}</span>{/if}
									{#if c.top_billing_entity}
										<span>·</span><span>Bills mostly via <strong style="color: var(--n-fg-muted); font-weight: 500;">{c.top_billing_entity}</strong></span>
									{/if}
								</div>
							</div>
						</div>

						<div class="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-3">
							<div>
								<div
									class="text-[11px] font-medium uppercase"
									style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
								>
									Deals
								</div>
								<div
									class="text-[18px] font-semibold tabular-nums mt-0.5"
									style="color: var(--n-fg);"
								>
									{c.total_count}
								</div>
								<div class="text-[12px] mt-0.5" style="color: var(--n-fg-subtle);">
									{c.inbound_count} in · {c.outbound_count} out{#if c.markup_count}
										· {c.markup_count} mu{/if}
								</div>
							</div>

							<div>
								<div
									class="text-[11px] font-medium uppercase"
									style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
								>
									Billing
								</div>
								<div
									class="text-[18px] font-semibold tabular-nums mt-0.5"
									style="color: var(--n-fg);"
								>
									₹ {inr(c.total_billing)}
								</div>
								<div class="text-[12px] mt-0.5" style="color: var(--n-fg-subtle);">
									avg ₹ {inr(c.avg_deal_size)}
								</div>
							</div>

							<div>
								<div
									class="text-[11px] font-medium uppercase flex items-center gap-1"
									style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
								>
									<span class="h-1 w-1 rounded-full bg-[#0f7b6c]"></span>
									TCH Profit
								</div>
								<div
									class="text-[18px] font-semibold tabular-nums mt-0.5"
									style="color: #1f6f43;"
								>
									₹ {inr(c.total_profit)}
								</div>
								<div class="text-[12px] mt-0.5" style="color: var(--n-fg-subtle);">
									{pct(c.profit_margin)} margin
								</div>
							</div>

							<div>
								<div
									class="text-[11px] font-medium uppercase"
									style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
								>
									Activity
								</div>
								<div
									class="text-[14px] font-medium tabular-nums mt-0.5"
									style="color: var(--n-fg);"
								>
									{formatDate(c.first_date)} → {formatDate(c.last_date)}
								</div>
								<div class="text-[12px] mt-0.5" style="color: var(--n-fg-subtle);">
									{spanDays(c.first_date, c.last_date)} · {c.months_active} active mo
								</div>
							</div>

							<div>
								<div
									class="text-[11px] font-medium uppercase"
									style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
								>
									Brands
								</div>
								<div
									class="text-[18px] font-semibold tabular-nums mt-0.5"
									style="color: var(--n-fg);"
								>
									{c.brand_count}
								</div>
								<div class="text-[12px] mt-0.5" style="color: var(--n-fg-subtle);">
									{c.repeat_brands.length} repeat
								</div>
							</div>

							<div>
								<div
									class="text-[11px] font-medium uppercase"
									style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
								>
									Status
								</div>
								<div
									class="text-[14px] font-medium tabular-nums mt-0.5"
									style="color: var(--n-fg);"
								>
									{c.over_count}/{c.total_count} done
								</div>
								<div class="text-[12px] mt-0.5" style="color: var(--n-fg-subtle);">
									{c.paid_count} paid
								</div>
							</div>
						</div>

						{#if data.months.length > 0}
							<div class="mt-5">
								<div
									class="text-[11px] font-medium uppercase mb-2 flex items-center justify-between"
									style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
								>
									<span>Monthly billing</span>
									<span class="font-normal normal-case" style="color: var(--n-fg-subtle);">
										{max > 0 ? `peak ₹ ${inr(String(max))}` : 'no monthly data'}
									</span>
								</div>
								<div class="flex items-end gap-1 h-14">
									{#each data.months as m (m.key)}
										{@const v = Number(c.by_month[m.key] || 0)}
										{@const h = max > 0 ? Math.max(2, Math.round((v / max) * 52) + 2) : 2}
										<div class="relative flex-1 group cursor-default">
											<div
												class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-md text-white bg-[#8a4a32]"
											>
												{m.label}: {v > 0 ? `₹ ${inr(String(v))}` : '—'}
											</div>
											<div
												class="w-full rounded-sm transition-[opacity,background-color] duration-150 {v >
												0
													? 'opacity-70 bg-[var(--n-fg-muted)] group-hover:opacity-100 group-hover:bg-[#a96b50]'
													: 'opacity-50 bg-[var(--n-border)] group-hover:opacity-80 group-hover:bg-[#d9c2b3]'}"
												style="height: {h}px;"
											></div>
										</div>
									{/each}
								</div>
								<div class="flex gap-1 mt-1.5">
									{#each data.months as m (m.key)}
										<div
											class="flex-1 text-center text-[10px] tabular-nums"
											style="color: var(--n-fg-subtle);"
										>
											{m.label[0]}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if c.top_brands.length > 0 || c.repeat_brands.length > 0 || c.common_deliverable}
							<div class="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4" style="border-top: 1px solid var(--n-border);">
								{#if c.top_brands.length > 0}
									<div>
										<div
											class="text-[11px] font-medium uppercase mb-2"
											style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
										>
											Top brands
										</div>
										<div class="flex flex-wrap gap-1.5">
											{#each c.top_brands as b (b)}
												<Tag tone="neutral">{b}</Tag>
											{/each}
										</div>
									</div>
								{/if}

								{#if c.repeat_brands.length > 0}
									<div>
										<div
											class="text-[11px] font-medium uppercase mb-2"
											style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
										>
											Repeat brands
										</div>
										<div class="flex flex-wrap gap-1.5">
											{#each c.repeat_brands as b (b)}
												<Tag tone="accent">{b}</Tag>
											{/each}
										</div>
									</div>
								{/if}

								{#if c.common_deliverable}
									<div>
										<div
											class="text-[11px] font-medium uppercase mb-2"
											style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
										>
											Common deliverable
										</div>
										<div class="text-[13.5px]" style="color: var(--n-fg-muted);">
											{c.common_deliverable}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</section>
