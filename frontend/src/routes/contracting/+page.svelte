<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Contracting, type Creator } from '$lib/api';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Label from '$lib/components/ui/label.svelte';

	const YN = [
		{ value: 'Y', label: 'Y' },
		{ value: 'N', label: 'N' }
	];

	let rows = $state<Contracting[]>([]);
	let creators = $state<Creator[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let open = $state(false);
	let editing = $state<Contracting | null>(null);
	let form = $state({ creator: '', final_meeting: '', agreement_sent: '', agreement_signed: '', bank_verified: '', time_to_sign: '', renewal_date: '', renewal_note: '' });

	async function load() {
		loading = true;
		try {
			const [r, c] = await Promise.all([api.get<Contracting[]>('/contracting/'), api.get<Creator[]>('/creators/')]);
			rows = r; creators = c;
		} catch (e) { error = (e as Error).message; } finally { loading = false; }
	}

	function startAdd() {
		editing = null;
		form = { creator: '', final_meeting: '', agreement_sent: '', agreement_signed: '', bank_verified: '', time_to_sign: '', renewal_date: '', renewal_note: '' };
		open = true;
	}

	function startEdit(row: Contracting) {
		editing = row;
		form = { creator: String(row.creator), final_meeting: row.final_meeting, agreement_sent: row.agreement_sent, agreement_signed: row.agreement_signed, bank_verified: row.bank_verified, time_to_sign: row.time_to_sign, renewal_date: row.renewal_date ?? '', renewal_note: row.renewal_note };
		open = true;
	}

	async function submit() {
		const payload = { creator: Number(form.creator), final_meeting: form.final_meeting, agreement_sent: form.agreement_sent, agreement_signed: form.agreement_signed, bank_verified: form.bank_verified, time_to_sign: form.time_to_sign, renewal_date: form.renewal_date || null, renewal_note: form.renewal_note };
		try {
			if (editing) { await api.patch(`/contracting/${editing.id}/`, payload); }
			else { await api.post('/contracting/', payload); }
			open = false; await load();
		} catch (e) { alert((e as Error).message); }
	}

	async function remove(r: Contracting) {
		if (!confirm(`Delete contracting for "${r.creator_name}"?`)) return;
		await api.del(`/contracting/${r.id}/`); await load();
	}

	onMount(load);

	let fullyDone = $derived(rows.filter(r => r.final_meeting === 'Y' && r.agreement_signed === 'Y' && r.bank_verified === 'Y').length);
	let pendingSig = $derived(rows.filter(r => r.agreement_sent === 'Y' && r.agreement_signed !== 'Y').length);

	function yn(val: string) {
		if (val === 'Y') return 'bg-emerald-100 text-emerald-700 border border-emerald-300';
		if (val === 'N') return 'bg-rose-100 text-rose-700 border border-rose-300';
		return 'bg-slate-100 text-slate-400 border border-slate-200';
	}
</script>

<section class="space-y-4">
	<div class="border-b-2 border-teal-600 -mx-4 px-4 pb-3">
		<div class="flex items-end justify-between flex-wrap gap-2">
			<div>
				<h1 class="text-[20px] font-semibold uppercase tracking-wide text-slate-900">
					<span class="text-teal-600">Contracting</span> &amp; Compliance
				</h1>
				<p class="text-[14px] text-slate-500">Agreement and KYC status per creator.</p>
			</div>
			<Button variant="primary" onclick={startAdd}>+ Add Entry</Button>
		</div>
	</div>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		<div class="border border-teal-200 bg-teal-50/50 px-3 py-2">
			<div class="text-[12px] uppercase tracking-wide text-teal-700">Total Entries</div>
			<div class="text-[18px] font-semibold text-slate-900">{rows.length}</div>
		</div>
		<div class="border border-emerald-200 bg-emerald-50/40 px-3 py-2">
			<div class="text-[12px] uppercase tracking-wide text-emerald-700">Fully Complete</div>
			<div class="text-[18px] font-semibold text-slate-900">{fullyDone}</div>
		</div>
		<div class="border border-amber-200 bg-amber-50/40 px-3 py-2">
			<div class="text-[12px] uppercase tracking-wide text-amber-700">Pending Signature</div>
			<div class="text-[18px] font-semibold text-slate-900">{pendingSig}</div>
		</div>
		<div class="border border-slate-200 bg-white px-3 py-2">
			<div class="text-[12px] uppercase tracking-wide text-slate-500">Completion Rate</div>
			<div class="text-[18px] font-semibold text-slate-900">{rows.length > 0 ? `${Math.round((fullyDone / rows.length) * 100)}%` : '—'}</div>
		</div>
	</div>

	{#if loading}
		<div class="text-[15px] text-slate-500">Loading…</div>
	{:else if error}
		<div class="text-[15px] border border-rose-300 bg-rose-50 text-rose-800 p-2 rounded-sm">Error: {error}</div>
	{:else}
		<div class="overflow-x-auto rounded-sm border border-slate-200">
			<table class="grid-table">
				<thead>
					<tr>
						<th class="w-8 num">#</th>
						<th>Creator</th>
						<th class="text-center">Final Mtg</th>
						<th class="text-center">Agr Sent</th>
						<th class="text-center">Agr Signed</th>
						<th class="text-center">Bank / PAN</th>
						<th>Time to Sign</th>
						<th>Renewal Date</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r, i (r.id)}
						<tr>
							<td class="num text-slate-400">{i + 1}</td>
							<td class="font-medium text-slate-900">{r.creator_name}</td>
							<td class="text-center"><span class="px-2 py-0.5 rounded text-[13px] font-medium {yn(r.final_meeting)}">{r.final_meeting || '—'}</span></td>
							<td class="text-center"><span class="px-2 py-0.5 rounded text-[13px] font-medium {yn(r.agreement_sent)}">{r.agreement_sent || '—'}</span></td>
							<td class="text-center"><span class="px-2 py-0.5 rounded text-[13px] font-medium {yn(r.agreement_signed)}">{r.agreement_signed || '—'}</span></td>
							<td class="text-center"><span class="px-2 py-0.5 rounded text-[13px] font-medium {yn(r.bank_verified)}">{r.bank_verified || '—'}</span></td>
							<td class="text-slate-600">{r.time_to_sign}</td>
							<td class="whitespace-nowrap text-slate-600">{r.renewal_date ?? r.renewal_note}</td>
							<td>
								<div class="flex gap-1">
									<button type="button" onclick={() => startEdit(r)} class="h-7 px-2 text-[13px] uppercase tracking-wide border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-600 hover:text-white hover:border-teal-600 rounded-sm">Edit</button>
									<button type="button" onclick={() => remove(r)} class="h-7 px-2 text-[13px] uppercase tracking-wide border border-slate-300 bg-white text-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-sm">Del</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr><td colspan="9" class="text-center text-slate-400 py-6">No entries yet.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Contracting' : 'Add Contracting'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2"><Label>Creator</Label><Select bind:value={form.creator} options={creators.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="—" /></div>
		<div><Label>Final Meeting</Label><Select bind:value={form.final_meeting} options={YN} placeholder="—" /></div>
		<div><Label>Agreement Sent</Label><Select bind:value={form.agreement_sent} options={YN} placeholder="—" /></div>
		<div><Label>Agreement Signed</Label><Select bind:value={form.agreement_signed} options={YN} placeholder="—" /></div>
		<div><Label>Bank / PAN Verified</Label><Select bind:value={form.bank_verified} options={YN} placeholder="—" /></div>
		<div><Label>Time to Sign</Label><Input bind:value={form.time_to_sign} placeholder="e.g. 2 weeks" /></div>
		<div><Label>Renewal Date</Label><Input type="date" bind:value={form.renewal_date} /></div>
		<div class="col-span-2"><Label>Renewal Note</Label><Input bind:value={form.renewal_note} placeholder="Free-text" /></div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
