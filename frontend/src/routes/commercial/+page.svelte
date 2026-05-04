<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Deal, type Creator } from '$lib/api';
	import { inr } from '$lib/utils';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Textarea from '$lib/components/ui/textarea.svelte';
	import Label from '$lib/components/ui/label.svelte';
	import Tag from '$lib/components/ui/tag.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

	const DIRECTION = [
		{ value: 'Inbound', label: 'Inbound' },
		{ value: 'Outbound', label: 'Outbound' },
		{ value: 'MarkUp', label: 'Mark Up' }
	];
	const YN = [
		{ value: 'Y', label: 'Y' },
		{ value: 'N', label: 'N' }
	];

	let rows = $state<Deal[]>([]);
	let creators = $state<Creator[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let open = $state(false);
	let editing = $state<Deal | null>(null);
	let q = $state('');
	let dirFilter = $state<'All' | 'Inbound' | 'Outbound' | 'MarkUp'>('All');

	let form = $state({
		confirmation_date: '',
		e_invoice_date: '',
		creator: '',
		creator_name_raw: '',
		agency_commission_agreed: '',
		direction: 'Outbound',
		total_fee: '',
		agency_fee_pct: '',
		agency_fee_inr: '',
		creator_fee: '',
		billing_entity: '',
		brand: '',
		campaign: '',
		deliverables: '',
		ro_number: '',
		campaign_over: '',
		invoice_received: '',
		payment_cleared: '',
		e_invoice_number: '',
		payment_received: '',
		comments: ''
	});

	async function load() {
		loading = true;
		try {
			const [d, c] = await Promise.all([
				api.get<Deal[]>('/deals/'),
				api.get<Creator[]>('/creators/')
			]);
			rows = d;
			creators = c;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	function startAdd() {
		editing = null;
		form = {
			confirmation_date: new Date().toISOString().slice(0, 10),
			e_invoice_date: '',
			creator: '',
			creator_name_raw: '',
			agency_commission_agreed: '',
			direction: 'Outbound',
			total_fee: '',
			agency_fee_pct: '',
			agency_fee_inr: '',
			creator_fee: '',
			billing_entity: '',
			brand: '',
			campaign: '',
			deliverables: '',
			ro_number: '',
			campaign_over: '',
			invoice_received: '',
			payment_cleared: '',
			e_invoice_number: '',
			payment_received: '',
			comments: ''
		};
		open = true;
	}

	function startEdit(d: Deal) {
		editing = d;
		form = {
			confirmation_date: d.confirmation_date ?? '',
			e_invoice_date: d.e_invoice_date ?? '',
			creator: d.creator ? String(d.creator) : '',
			creator_name_raw: d.creator_name_raw,
			agency_commission_agreed: d.agency_commission_agreed,
			direction: d.direction,
			total_fee: d.total_fee,
			agency_fee_pct: d.agency_fee_pct,
			agency_fee_inr: d.agency_fee_inr,
			creator_fee: d.creator_fee,
			billing_entity: d.billing_entity,
			brand: d.brand,
			campaign: d.campaign,
			deliverables: d.deliverables,
			ro_number: d.ro_number,
			campaign_over: d.campaign_over,
			invoice_received: d.invoice_received,
			payment_cleared: d.payment_cleared,
			e_invoice_number: d.e_invoice_number,
			payment_received: d.payment_received,
			comments: d.comments
		};
		open = true;
	}

	async function submit() {
		const payload = {
			...form,
			creator: form.creator ? Number(form.creator) : null,
			confirmation_date: form.confirmation_date || null,
			e_invoice_date: form.e_invoice_date || null,
			total_fee: form.total_fee || '0',
			agency_fee_pct: form.agency_fee_pct || '0',
			agency_fee_inr: form.agency_fee_inr || '0',
			creator_fee: form.creator_fee || '0'
		};
		try {
			if (editing) {
				await api.patch(`/deals/${editing.id}/`, payload);
			} else {
				await api.post('/deals/', payload);
			}
			open = false;
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(d: Deal) {
		if (!confirm(`Delete deal for "${d.creator_name}" / brand "${d.brand}"?`)) return;
		await api.del(`/deals/${d.id}/`);
		await load();
	}

	$effect(() => {
		const total = Number(form.total_fee);
		const p = Number(form.agency_fee_pct);
		if (Number.isFinite(total) && Number.isFinite(p) && total > 0 && p > 0) {
			const pct = p <= 1 ? p : p / 100;
			form.agency_fee_inr = (total * pct).toFixed(2);
			form.creator_fee = (total - total * pct).toFixed(2);
		}
	});

	let filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const list = rows.filter((r) => {
			if (dirFilter !== 'All' && r.direction !== dirFilter) return false;
			if (!needle) return true;
			return (
				r.creator_name?.toLowerCase().includes(needle) ||
				r.brand?.toLowerCase().includes(needle) ||
				r.campaign?.toLowerCase().includes(needle) ||
				r.billing_entity?.toLowerCase().includes(needle) ||
				r.ro_number?.toLowerCase().includes(needle)
			);
		});
		return list.slice().sort((a, b) => {
			const ad = a.confirmation_date;
			const bd = b.confirmation_date;
			if (!ad && !bd) return 0;
			if (!ad) return 1;
			if (!bd) return -1;
			return bd.localeCompare(ad);
		});
	});

	let totals = $derived.by(() => {
		let total = 0;
		let profit = 0;
		for (const r of filtered) {
			total += Number(r.total_fee || 0);
			profit += Number(r.agency_fee_inr || 0);
		}
		return { total, profit, count: filtered.length };
	});

	function relTone(rel?: string) {
		if (rel === 'Exclusive') return 'exclusive' as const;
		if (rel === 'Dropping') return 'dropping' as const;
		if (rel === 'NonTCH') return 'nontch' as const;
		return 'friend' as const;
	}
	function dirTone(dir: string) {
		if (dir === 'Inbound') return 'inbound' as const;
		if (dir === 'Outbound') return 'outbound' as const;
		return 'markup' as const;
	}
	function isEmw(billing: string) {
		const b = (billing || '').toUpperCase();
		return b.includes('EMW') || b.includes('ELEMENTS MEDIAWORK');
	}
	function pctText(p: string): string {
		const n = Number(p);
		if (!Number.isFinite(n) || n <= 0) return '';
		return `${(n * 100).toFixed(0)}%`;
	}
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Commercial
		</div>
		<div class="flex items-end justify-between flex-wrap gap-3">
			<div>
				<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
					Commercial Tracking
				</h1>
				<p class="text-[15px] max-w-[640px] mt-2" style="color: var(--n-fg-muted);">
					Single source of truth for billing. Add a deal here — Current Overview and Quarterly
					Exclusives recompute automatically.
				</p>
			</div>
			<Button variant="primary" onclick={startAdd}>
				<Icon name="plus" size={14} /> Add Deal
			</Button>
		</div>
	</header>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		<div
			class="rounded p-3"
			style="border: 1px solid var(--n-border); background: var(--n-bg);"
		>
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Deals shown
			</div>
			<div
				class="text-[22px] font-semibold tabular-nums mt-1"
				style="color: var(--n-fg);"
			>
				{totals.count}
			</div>
		</div>
		<div
			class="rounded p-3"
			style="border: 1px solid var(--n-border); background: var(--n-bg);"
		>
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Total Billing
			</div>
			<div
				class="text-[22px] font-semibold tabular-nums mt-1"
				style="color: var(--n-fg);"
			>
				₹ {inr(totals.total)}
			</div>
		</div>
		<div
			class="rounded p-3"
			style="border: 1px solid var(--n-border); background: var(--n-bg);"
		>
			<div
				class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]"></span>
				TCH Profit
			</div>
			<div
				class="text-[22px] font-semibold tabular-nums mt-1"
				style="color: var(--n-fg);"
			>
				₹ {inr(totals.profit)}
			</div>
		</div>
		<div
			class="rounded p-3"
			style="border: 1px solid var(--n-border); background: var(--n-bg);"
		>
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Profit Ratio
			</div>
			<div
				class="text-[22px] font-semibold tabular-nums mt-1"
				style="color: var(--n-fg);"
			>
				{totals.total > 0 ? `${((totals.profit / totals.total) * 100).toFixed(1)}%` : '—'}
			</div>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<div class="relative flex-1 min-w-[260px]">
			<span
				class="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
				style="color: var(--n-fg-subtle);"
			>
				<Icon name="search" size={14} />
			</span>
			<input
				type="text"
				placeholder="Search creator, brand, campaign, RO#, billing entity…"
				class="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
				bind:value={q}
			/>
		</div>
		<div class="seg-toggle">
			{#each ['All', 'Inbound', 'Outbound', 'MarkUp'] as d (d)}
				<button
					type="button"
					class:active={dirFilter === d}
					onclick={() => (dirFilter = d as typeof dirFilter)}
				>
					{d === 'MarkUp' ? 'Mark Up' : d}
				</button>
			{/each}
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
		<div class="ct-wrap">
			<table class="ct-table">
				<thead>
					<tr>
						<th class="ct-sticky-l1 ct-head w-[100px]">Conf Date</th>
						<th class="ct-sticky-l2 ct-head w-[200px]">Creator</th>
						<th class="ct-head w-[110px]">Direction</th>
						<th class="ct-head w-[120px] num">Total Fee</th>
						<th class="ct-head w-[60px] num">%</th>
						<th class="ct-head w-[120px] num">Agency Fee</th>
						<th class="ct-head w-[120px] num">Creator Fee</th>
						<th class="ct-head w-[200px]">Billing Entity</th>
						<th class="ct-head w-[160px]">Brand</th>
						<th class="ct-head w-[200px]">Campaign</th>
						<th class="ct-head w-[160px]">Deliverables</th>
						<th class="ct-head w-[140px]">RO #</th>
						<th class="ct-head w-[60px]" title="Campaign Over">Over</th>
						<th class="ct-head w-[70px]" title="Invoice Received">Inv</th>
						<th class="ct-head w-[70px]" title="Payment Cleared by TCH">Pay Clr</th>
						<th class="ct-head w-[140px]">E-Invoice #</th>
						<th class="ct-head w-[80px]" title="Payment Received by TCH">Pay Recv</th>
						<th class="ct-sticky-r ct-head w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as r (r.id)}
						<tr class="ct-row">
							<td class="ct-sticky-l1 ct-cell whitespace-nowrap">
								{#if r.confirmation_date}
									<span class="tabular-nums" style="color: var(--n-fg);">{r.confirmation_date}</span>
								{:else}
									<Tag tone="markup">no date</Tag>
								{/if}
							</td>
							<td class="ct-sticky-l2 ct-cell">
								<div class="font-medium" style="color: var(--n-fg);">{r.creator_name || '—'}</div>
								{#if r.creator_relationship}
									<Tag tone={relTone(r.creator_relationship)} class="mt-0.5">
										{r.creator_relationship === 'NonTCH'
											? 'Non TCH'
											: r.creator_relationship}
									</Tag>
								{/if}
							</td>
							<td class="ct-cell">
								<Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
							</td>
							<td class="ct-cell num font-semibold tabular-nums" style="color: var(--n-fg);">
								{inr(r.total_fee)}
							</td>
							<td class="ct-cell num" style="color: var(--n-fg-muted);">
								{pctText(r.agency_fee_pct)}
							</td>
							<td class="ct-cell num tabular-nums" style="color: #1f6f43;">
								{inr(r.agency_fee_inr)}
							</td>
							<td class="ct-cell num tabular-nums" style="color: var(--n-fg-muted);">
								{inr(r.creator_fee)}
							</td>
							<td class="ct-cell">
								<span style="color: var(--n-fg);">{r.billing_entity}</span>
								{#if r.billing_entity && isEmw(r.billing_entity)}
									<Tag tone="emw" class="ml-1">EMW</Tag>
								{/if}
							</td>
							<td class="ct-cell" style="color: var(--n-fg);">{r.brand}</td>
							<td class="ct-cell" style="color: var(--n-fg-muted);">{r.campaign}</td>
							<td class="ct-cell" style="color: var(--n-fg-muted);">{r.deliverables}</td>
							<td
								class="ct-cell tabular-nums whitespace-nowrap"
								style="color: var(--n-fg-muted);"
							>
								{r.ro_number}
							</td>
							<td class="ct-cell text-center">
								{#if r.campaign_over === 'Y'}<Tag tone="yes">Y</Tag>
								{:else if r.campaign_over === 'N'}<Tag tone="no">N</Tag>{/if}
							</td>
							<td class="ct-cell text-center">
								{#if r.invoice_received === 'Y'}<Tag tone="yes">Y</Tag>
								{:else if r.invoice_received === 'N'}<Tag tone="no">N</Tag>{/if}
							</td>
							<td class="ct-cell text-center">
								{#if r.payment_cleared === 'Y'}<Tag tone="yes">Y</Tag>
								{:else if r.payment_cleared === 'N'}<Tag tone="no">N</Tag>{/if}
							</td>
							<td
								class="ct-cell tabular-nums whitespace-nowrap"
								style="color: var(--n-fg-muted);"
							>
								{r.e_invoice_number}
							</td>
							<td class="ct-cell text-center">
								{#if r.payment_received === 'Y'}<Tag tone="yes">Y</Tag>
								{:else if r.payment_received === 'N'}<Tag tone="no">N</Tag>{/if}
							</td>
							<td class="ct-sticky-r ct-cell">
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
								class="ct-cell text-center py-6"
								style="color: var(--n-fg-subtle);"
								colspan="18"
							>
								No deals match the current filters.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
		<div class="tbl-caption">
			<span>
				Tip · Conf Date and Creator stay pinned on the left, Actions on the right. Scroll
				horizontally to see more columns.
			</span>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Deal' : 'Add Deal'} class="max-w-4xl">
	<div class="grid grid-cols-3 gap-3">
		<div>
			<Label>Confirmation Date</Label>
			<Input type="date" bind:value={form.confirmation_date} />
		</div>
		<div>
			<Label>E-Invoice Date</Label>
			<Input type="date" bind:value={form.e_invoice_date} />
		</div>
		<div>
			<Label>Direction</Label>
			<Select bind:value={form.direction} options={DIRECTION} />
		</div>

		<div class="col-span-2">
			<Label>Creator (pick from master)</Label>
			<Select
				bind:value={form.creator}
				options={creators.map((c) => ({
					value: String(c.id),
					label: `${c.name} · ${c.relationship}`
				}))}
				placeholder="— none —"
			/>
		</div>
		<div>
			<Label>Creator Name (raw, if not in master)</Label>
			<Input bind:value={form.creator_name_raw} />
		</div>

		<div>
			<Label>Total Fee (INR)</Label>
			<Input type="number" step="0.01" bind:value={form.total_fee} />
		</div>
		<div>
			<Label>Agency Fee %</Label>
			<Input
				type="number"
				step="0.0001"
				placeholder="0.20 = 20%"
				bind:value={form.agency_fee_pct}
			/>
		</div>
		<div>
			<Label>Agency Fee (INR) — auto</Label>
			<Input type="number" step="0.01" bind:value={form.agency_fee_inr} />
		</div>
		<div class="col-span-2">
			<Label>Creator Fee (INR) — auto</Label>
			<Input type="number" step="0.01" bind:value={form.creator_fee} />
		</div>
		<div>
			<Label>Agency Commission Agreed</Label>
			<Input bind:value={form.agency_commission_agreed} />
		</div>

		<div>
			<Label>Billing Entity</Label>
			<Input bind:value={form.billing_entity} placeholder="EMW / MSL Group / …" />
		</div>
		<div>
			<Label>Brand</Label>
			<Input bind:value={form.brand} />
		</div>
		<div>
			<Label>Campaign</Label>
			<Input bind:value={form.campaign} />
		</div>

		<div class="col-span-2">
			<Label>Deliverables</Label>
			<Input bind:value={form.deliverables} />
		</div>
		<div>
			<Label>RO Number</Label>
			<Input bind:value={form.ro_number} />
		</div>

		<div>
			<Label>Campaign Over</Label>
			<Select bind:value={form.campaign_over} options={YN} placeholder="—" />
		</div>
		<div>
			<Label>Invoice Received</Label>
			<Select bind:value={form.invoice_received} options={YN} placeholder="—" />
		</div>
		<div>
			<Label>Payment Cleared by TCH</Label>
			<Select bind:value={form.payment_cleared} options={YN} placeholder="—" />
		</div>
		<div>
			<Label>E-Invoice # (TCH to Client)</Label>
			<Input bind:value={form.e_invoice_number} />
		</div>
		<div>
			<Label>Payment Received by TCH</Label>
			<Select bind:value={form.payment_received} options={YN} placeholder="—" />
		</div>
		<div></div>

		<div class="col-span-3">
			<Label>Comments</Label>
			<Textarea bind:value={form.comments} />
		</div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
