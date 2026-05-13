<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type AlertsPayload, type AlertItem, type AlertSeverity } from '$lib/api';
	import Button from '$lib/components/ui/button.svelte';
	import Icon from '$lib/components/ui/icon.svelte';
	import Tag from '$lib/components/ui/tag.svelte';

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'ok'; data: AlertsPayload };
	type SectionKey = 'urgent' | 'bd' | 'health' | 'seasonal';
	type FilterKey = 'all' | SectionKey;

	let pageState = $state<State>({ kind: 'loading' });
	let activeSection = $state<FilterKey>('all');

	let alerts = $derived(pageState.kind === 'ok' ? pageState.data : null);

	async function load() {
		pageState = { kind: 'loading' };
		try {
			const fresh = await api.get<AlertsPayload>('/alerts/');
			pageState = { kind: 'ok', data: fresh };
		} catch (e) {
			pageState = { kind: 'error', message: (e as Error).message };
		}
	}
	onMount(load);

	function sevTone(s: AlertSeverity): 'no' | 'markup' | 'neutral' {
		if (s === 'high') return 'no';
		if (s === 'med') return 'markup';
		return 'neutral';
	}

	function sevLabel(s: AlertSeverity): string {
		return s === 'high' ? 'High' : s === 'med' ? 'Med' : 'Low';
	}

	const SECTION_META: Record<
		SectionKey,
		{ title: string; subtitle: string; icon: string; accent: string; accentBg: string }
	> = {
		urgent: {
			title: 'Urgent — Action Today',
			subtitle: 'Inactive creators, overdue invoices/payments, renewals due',
			icon: 'alert-triangle',
			accent: '#c0432e',
			accentBg: '#fbe9e4'
		},
		bd: {
			title: 'BD Opportunities',
			subtitle: 'Dormant brands worth re-engaging, hot brands worth pitching more',
			icon: 'target',
			accent: '#19567c',
			accentBg: '#dde8f6'
		},
		health: {
			title: 'Creator Health Warnings',
			subtitle: 'Exclusive creators whose billing dropped quarter-over-quarter',
			icon: 'activity',
			accent: '#8a6a18',
			accentBg: '#fcf2cf'
		},
		seasonal: {
			title: 'Upcoming Seasonal Moments',
			subtitle: 'Cultural / retail moments to plan campaigns around',
			icon: 'calendar-clock',
			accent: '#52298f',
			accentBg: '#e6dbf6'
		}
	};

	const ORDER: SectionKey[] = ['urgent', 'bd', 'health', 'seasonal'];
	const FILTERS: FilterKey[] = ['all', 'urgent', 'bd', 'health', 'seasonal'];

	function listFor(key: SectionKey): AlertItem[] {
		if (!alerts) return [];
		return alerts[key] ?? [];
	}

	function shouldShow(key: SectionKey): boolean {
		if (activeSection === 'all') return true;
		return activeSection === key;
	}
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Alerts
		</div>
		<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
			Intelligence Alerts
		</h1>
		<p class="text-[15px] max-w-[720px]" style="color: var(--n-fg-muted);">
			Formula-derived signals from Commercial Tracking, Creators, and Contracting. No AI — just thresholds applied
			to the live database, recomputed on every load.
		</p>
	</header>

	<div
		class="flex flex-wrap items-center gap-2 pb-3"
		style="border-bottom: 1px solid var(--n-border);"
	>
		<div class="seg-toggle">
			{#each FILTERS as f (f)}
				<button
					type="button"
					class:active={activeSection === f}
					onclick={() => (activeSection = f)}
				>
					{f === 'all'
						? 'All'
						: f === 'bd'
							? 'BD'
							: f === 'urgent'
								? 'Urgent'
								: f === 'health'
									? 'Health'
									: 'Seasonal'}
					{#if alerts}
						<span class="ml-1 text-[11px]" style="color: var(--n-fg-subtle);">
							{f === 'all'
								? alerts.counts.urgent +
									alerts.counts.bd +
									alerts.counts.health +
									alerts.counts.seasonal
								: alerts.counts[f]}
						</span>
					{/if}
				</button>
			{/each}
		</div>
		<div class="ml-auto flex items-center gap-2">
			{#if alerts}
				<span class="text-[12px]" style="color: var(--n-fg-subtle);">
					Generated {alerts.generated_at}
				</span>
			{/if}
			<Button variant="ghost" onclick={load}>
				<Icon name="refresh" size={14} /> Refresh
			</Button>
		</div>
	</div>

	{#if pageState.kind === 'loading'}
		<div class="text-[14px] py-8 text-center" style="color: var(--n-fg-subtle);">Loading…</div>
	{:else if pageState.kind === 'error'}
		<div
			class="text-[14px] rounded p-3"
			style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;"
		>
			Error: {pageState.message}
		</div>
	{:else if pageState.kind === 'ok'}
		{@const payload = pageState.data}
		{@const totalCount =
			payload.counts.urgent + payload.counts.bd + payload.counts.health + payload.counts.seasonal}

		<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
			{#each ORDER as key (key)}
				{@const meta = SECTION_META[key]}
				<button
					type="button"
					class="rounded p-3 text-left transition-colors"
					style="border: 1px solid var(--n-border); background: var(--n-bg);"
					onclick={() => (activeSection = key)}
					onmouseenter={(e) => (e.currentTarget.style.borderColor = meta.accent)}
					onmouseleave={(e) => (e.currentTarget.style.borderColor = 'var(--n-border)')}
				>
					<div
						class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
						style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
					>
						<span
							class="inline-flex items-center justify-center rounded-sm h-4 w-4"
							style="background: {meta.accentBg}; color: {meta.accent};"
						>
							<Icon name={meta.icon} size={11} />
						</span>
						{meta.title.split('—')[0].trim()}
					</div>
					<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
						{payload.counts[key]}
					</div>
				</button>
			{/each}
		</div>

		{#if totalCount === 0}
			<div
				class="rounded p-8 text-center text-[14px]"
				style="border: 1px dashed var(--n-border); color: var(--n-fg-subtle);"
			>
				No alerts — every threshold is clean.
			</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				{#each ORDER as key (key)}
					{@const meta = SECTION_META[key]}
					{@const items = listFor(key)}
					{#if shouldShow(key)}
						<article
							class="rounded-md border bg-[var(--n-bg)] shadow-[0_1px_2px_rgba(15,15,15,0.04)] overflow-hidden"
							style="border-color: var(--n-border);"
						>
							<header
								class="flex items-center justify-between gap-3 px-4 py-3"
								style="border-bottom: 1px solid var(--n-border); background: {meta.accentBg};"
							>
								<div class="flex items-center gap-2 min-w-0">
									<span
										class="inline-flex items-center justify-center h-6 w-6 rounded"
										style="background: rgba(255,255,255,0.6); color: {meta.accent};"
									>
										<Icon name={meta.icon} size={14} />
									</span>
									<div class="min-w-0">
										<div
											class="text-[14px] font-semibold leading-tight"
											style="color: {meta.accent};"
										>
											{meta.title}
										</div>
										<div class="text-[11.5px] mt-0.5" style="color: var(--n-fg-muted);">
											{meta.subtitle}
										</div>
									</div>
								</div>
								<div
									class="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded"
									style="background: rgba(255,255,255,0.7); color: {meta.accent};"
								>
									{items.length} {items.length === 1 ? 'alert' : 'alerts'}
								</div>
							</header>

							{#if items.length === 0}
								<div
									class="px-4 py-6 text-center text-[13px]"
									style="color: var(--n-fg-subtle);"
								>
									None.
								</div>
							{:else}
								<ul class="divide-y" style="border-color: var(--n-border);">
									{#each items as it (it.kind + '|' + it.title)}
										<li class="px-4 py-3 hover:bg-[var(--n-bg-soft)] transition-colors">
											<div class="flex items-start gap-2.5">
												<span
													class="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0"
													style="background: {it.severity === 'high'
														? '#c0432e'
														: it.severity === 'med'
															? '#b8801b'
															: '#7a7468'};"
												></span>
												<div class="min-w-0 flex-1">
													<div class="flex items-start gap-2 flex-wrap">
														<div
															class="text-[13.5px] font-medium leading-snug"
															style="color: var(--n-fg);"
														>
															{it.title}
														</div>
														{#if key !== 'seasonal'}
															<Tag tone={sevTone(it.severity)}>{sevLabel(it.severity)}</Tag>
														{/if}
													</div>
													<div
														class="text-[12.5px] mt-1 leading-snug"
														style="color: var(--n-fg-muted);"
													>
														{it.detail}
													</div>
													<div
														class="text-[12px] mt-1.5 font-medium inline-flex items-center gap-1"
														style="color: {meta.accent};"
													>
														<Icon name="arrow-right" size={11} />
														{it.action}
													</div>
												</div>
											</div>
										</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/if}
				{/each}
			</div>
		{/if}

		<footer
			class="text-[11.5px] pt-4 leading-relaxed"
			style="color: var(--n-fg-subtle); border-top: 1px solid var(--n-border);"
		>
			<strong style="color: var(--n-fg-muted); font-weight: 500;">Thresholds:</strong>
			Inactive creator ≥ {payload.thresholds.inactive_creator_days}d ·
			Invoice overdue ≥ {payload.thresholds.invoice_overdue_days}d ·
			Payment overdue ≥ {payload.thresholds.payment_overdue_days}d ·
			Brand dormant ≥ {payload.thresholds.brand_dormant_days}d ·
			Brand hot ≥ 3 deals/{payload.thresholds.brand_hot_window_days}d ·
			Renewal ≤ {payload.thresholds.renewal_due_days}d ·
			QoQ drop ≥ {Math.round(payload.thresholds.qoq_drop_pct * 100)}%.
		</footer>
	{/if}
</section>
