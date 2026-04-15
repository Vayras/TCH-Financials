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

        // Live preview of agency_fee_inr and creator_fee as user types
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
                return rows.filter((r) => {
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

<section class="space-y-3">
        <!-- Tab accent header -->
        <div class="border-b-2 border-indigo-600 -mx-4 px-4 pb-3">
                <div class="flex items-end justify-between flex-wrap gap-2">
                        <div>
                                <h1 class="text-[20px] font-semibold uppercase tracking-wide text-slate-900">
                                        <span class="text-indigo-600">Commercial</span> Tracking
                                </h1>
                                <p class="text-[14px] text-slate-600">
                                        Single source of truth for billing. Add a deal here — Current Overview and Quarterly
                                        Exclusives recompute automatically.
                                </p>
                        </div>
                        <Button variant="primary" onclick={startAdd}>+ Add Deal</Button>
                </div>
        </div>

        <!-- Summary strip -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div class="border border-indigo-200 bg-indigo-50/50 px-3 py-2">
                        <div class="text-[12px] uppercase tracking-wide text-indigo-700">Deals shown</div>
                        <div class="text-[18px] font-semibold tabular-nums text-slate-900">{totals.count}</div>
                </div>
                <div class="border border-slate-300 bg-white px-3 py-2">
                        <div class="text-[12px] uppercase tracking-wide text-slate-600">Total Billing</div>
                        <div class="text-[18px] font-semibold tabular-nums text-slate-900">₹ {inr(totals.total)}</div>
                </div>
                <div class="border border-emerald-200 bg-emerald-50/40 px-3 py-2">
                        <div class="text-[12px] uppercase tracking-wide text-emerald-800">TCH Profit</div>
                        <div class="text-[18px] font-semibold tabular-nums text-emerald-900">₹ {inr(totals.profit)}</div>
                </div>
                <div class="border border-slate-300 bg-white px-3 py-2">
                        <div class="text-[12px] uppercase tracking-wide text-slate-600">Profit Ratio</div>
                        <div class="text-[18px] font-semibold tabular-nums text-slate-900">
                                {totals.total > 0 ? `${((totals.profit / totals.total) * 100).toFixed(1)}%` : '—'}
                        </div>
                </div>
        </div>

        <!-- Filter bar -->
        <div class="flex flex-wrap items-center gap-2">
                <input
                        type="text"
                        placeholder="Search creator, brand, campaign, RO#, billing entity…"
                        class="h-8 flex-1 min-w-[260px] border border-slate-400 px-2 text-[15px] focus:outline focus:outline-2 focus:outline-indigo-500"
                        bind:value={q}
                />
                {#each ['All', 'Inbound', 'Outbound', 'MarkUp'] as d (d)}
                        <button
                                type="button"
                                onclick={() => (dirFilter = d as typeof dirFilter)}
                                class="h-8 px-3 text-[14px] uppercase tracking-wide border transition-colors {dirFilter === d
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}"
                        >
                                {d}
                        </button>
                {/each}
        </div>

        {#if loading}
                <div class="text-[15px] text-slate-600">Loading…</div>
        {:else if error}
                <div class="text-[15px] border border-rose-300 bg-rose-50 text-rose-800 p-2">Error: {error}</div>
        {:else}
                <div class="ct-wrap border border-slate-300">
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
                                                                        <span class="tabular-nums text-slate-900">{r.confirmation_date}</span>
                                                                {:else}
                                                                        <span class="text-[12px] uppercase text-amber-700 bg-amber-50 border border-amber-300 px-1">no date</span>
                                                                {/if}
                                                        </td>
                                                        <td class="ct-sticky-l2 ct-cell">
                                                                <div class="font-medium text-slate-900">{r.creator_name || '—'}</div>
                                                                {#if r.creator_relationship}
                                                                        <Tag tone={relTone(r.creator_relationship)} class="mt-0.5">
                                                                                {r.creator_relationship === 'NonTCH' ? 'Non TCH' : r.creator_relationship}
                                                                        </Tag>
                                                                {/if}
                                                        </td>
                                                        <td class="ct-cell">
                                                                <Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
                                                        </td>
                                                        <td class="ct-cell num font-semibold tabular-nums text-slate-900">{inr(r.total_fee)}</td>
                                                        <td class="ct-cell num text-slate-700">{pctText(r.agency_fee_pct)}</td>
                                                        <td class="ct-cell num tabular-nums text-emerald-800">{inr(r.agency_fee_inr)}</td>
                                                        <td class="ct-cell num tabular-nums text-slate-700">{inr(r.creator_fee)}</td>
                                                        <td class="ct-cell">
                                                                <span class="text-slate-800">{r.billing_entity}</span>
                                                                {#if r.billing_entity && isEmw(r.billing_entity)}
                                                                        <Tag tone="emw" class="ml-1">EMW</Tag>
                                                                {/if}
                                                        </td>
                                                        <td class="ct-cell text-slate-800">{r.brand}</td>
                                                        <td class="ct-cell text-slate-700">{r.campaign}</td>
                                                        <td class="ct-cell text-slate-700">{r.deliverables}</td>
                                                        <td class="ct-cell text-slate-700 tabular-nums whitespace-nowrap">{r.ro_number}</td>
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
                                                        <td class="ct-cell text-slate-700 tabular-nums whitespace-nowrap">{r.e_invoice_number}</td>
                                                        <td class="ct-cell text-center">
                                                                {#if r.payment_received === 'Y'}<Tag tone="yes">Y</Tag>
                                                                {:else if r.payment_received === 'N'}<Tag tone="no">N</Tag>{/if}
                                                        </td>
                                                        <td class="ct-sticky-r ct-cell">
                                                                <div class="flex gap-1">
                                                                        <button
                                                                                type="button"
                                                                                onclick={() => startEdit(r)}
                                                                                class="h-7 px-2 text-[13px] uppercase tracking-wide border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-600"
                                                                        >
                                                                                Edit
                                                                        </button>
                                                                        <button
                                                                                type="button"
                                                                                onclick={() => remove(r)}
                                                                                class="h-7 px-2 text-[13px] uppercase tracking-wide border border-slate-300 bg-white text-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-600"
                                                                        >
                                                                                Del
                                                                        </button>
                                                                </div>
                                                        </td>
                                                </tr>
                                        {/each}
                                        {#if filtered.length === 0}
                                                <tr>
                                                        <td class="ct-cell text-center text-slate-500 py-4" colspan="18">
                                                                No deals match the current filters.
                                                        </td>
                                                </tr>
                                        {/if}
                                </tbody>
                        </table>
                </div>
        {/if}
</section>

<Dialog bind:open title={editing ? 'Edit Deal' : 'Add Deal'} class="max-w-4xl">
        <div class="grid grid-cols-3 gap-3">
                <div><Label>Confirmation Date</Label><Input type="date" bind:value={form.confirmation_date} /></div>
                <div><Label>E-Invoice Date</Label><Input type="date" bind:value={form.e_invoice_date} /></div>
                <div><Label>Direction</Label><Select bind:value={form.direction} options={DIRECTION} /></div>

                <div class="col-span-2">
                        <Label>Creator (pick from master)</Label>
                        <Select bind:value={form.creator} options={creators.map((c) => ({ value: String(c.id), label: `${c.name} · ${c.relationship}` }))} placeholder="— none —" />
                </div>
                <div><Label>Creator Name (raw, if not in master)</Label><Input bind:value={form.creator_name_raw} /></div>

                <div><Label>Total Fee (INR)</Label><Input type="number" step="0.01" bind:value={form.total_fee} /></div>
                <div><Label>Agency Fee %</Label><Input type="number" step="0.0001" placeholder="0.20 = 20%" bind:value={form.agency_fee_pct} /></div>
                <div><Label>Agency Fee (INR) — auto</Label><Input type="number" step="0.01" bind:value={form.agency_fee_inr} /></div>
                <div class="col-span-2"><Label>Creator Fee (INR) — auto</Label><Input type="number" step="0.01" bind:value={form.creator_fee} /></div>
                <div><Label>Agency Commission Agreed</Label><Input bind:value={form.agency_commission_agreed} /></div>

                <div><Label>Billing Entity</Label><Input bind:value={form.billing_entity} placeholder="EMW / MSL Group / …" /></div>
                <div><Label>Brand</Label><Input bind:value={form.brand} /></div>
                <div><Label>Campaign</Label><Input bind:value={form.campaign} /></div>

                <div class="col-span-2"><Label>Deliverables</Label><Input bind:value={form.deliverables} /></div>
                <div><Label>RO Number</Label><Input bind:value={form.ro_number} /></div>

                <div><Label>Campaign Over</Label><Select bind:value={form.campaign_over} options={YN} placeholder="—" /></div>
                <div><Label>Invoice Received</Label><Select bind:value={form.invoice_received} options={YN} placeholder="—" /></div>
                <div><Label>Payment Cleared by TCH</Label><Select bind:value={form.payment_cleared} options={YN} placeholder="—" /></div>
                <div><Label>E-Invoice # (TCH to Client)</Label><Input bind:value={form.e_invoice_number} /></div>
                <div><Label>Payment Received by TCH</Label><Select bind:value={form.payment_received} options={YN} placeholder="—" /></div>
                <div></div>

                <div class="col-span-3"><Label>Comments</Label><Textarea bind:value={form.comments} /></div>
        </div>
        {#snippet footer()}
                <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
                <Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
        {/snippet}
</Dialog>

<style>
        /* Sticky-column table tuned for Commercial Tracking.
           Wrapper scrolls on both axes; header sticks to top, two leftmost columns stick
           to the left, Actions column sticks to the right. */
        .ct-wrap {
                max-height: calc(100vh - 280px);
                min-height: 360px;
                overflow: auto;
                background: #fff;
        }
        .ct-table {
                border-collapse: separate;
                border-spacing: 0;
                font-size: 12.5px;
                width: max-content;
                min-width: 100%;
        }
        .ct-head {
                position: sticky;
                top: 0;
                z-index: 3;
                background: #f1f5f9; /* slate-100 */
                color: #0f172a;       /* slate-900 */
                text-align: left;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                font-size: 10.5px;
                padding: 6px 8px;
                border-right: 1px solid #cbd5e1; /* slate-300 */
                border-bottom: 1px solid #94a3b8; /* slate-400 */
        }
        .ct-head.num {
                text-align: right;
        }
        .ct-cell {
                padding: 6px 8px;
                border-right: 1px solid #e2e8f0;  /* slate-200 */
                border-bottom: 1px solid #e2e8f0;
                background: #fff;
                vertical-align: middle;
        }
        .ct-cell.num {
                text-align: right;
        }
        .ct-row:hover .ct-cell {
                background: #f8fafc; /* slate-50 */
        }

        /* Sticky left column 1: Conf Date */
        .ct-sticky-l1 {
                position: sticky;
                left: 0;
                z-index: 2;
                box-shadow: 1px 0 0 #e2e8f0;
        }
        thead .ct-sticky-l1 {
                z-index: 5;
        }

        /* Sticky left column 2: Creator (sits right of column 1) */
        .ct-sticky-l2 {
                position: sticky;
                left: 100px; /* match width of l1 */
                z-index: 2;
                box-shadow: 2px 0 4px -2px rgba(15, 23, 42, 0.15);
        }
        thead .ct-sticky-l2 {
                z-index: 5;
        }

        /* Sticky right column: Actions */
        .ct-sticky-r {
                position: sticky;
                right: 0;
                z-index: 2;
                box-shadow: -2px 0 4px -2px rgba(15, 23, 42, 0.15);
        }
        thead .ct-sticky-r {
                z-index: 5;
        }

        /* Re-apply hover background to sticky cells (they have explicit bg) */
        .ct-row:hover .ct-sticky-l1,
        .ct-row:hover .ct-sticky-l2,
        .ct-row:hover .ct-sticky-r {
                background: #f8fafc;
        }
</style>
