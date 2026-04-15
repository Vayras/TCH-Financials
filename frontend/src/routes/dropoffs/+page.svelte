<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type DropOff, type Creator } from '$lib/api';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Textarea from '$lib/components/ui/textarea.svelte';
	import Label from '$lib/components/ui/label.svelte';

	let rows = $state<DropOff[]>([]);
	let creators = $state<Creator[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let open = $state(false);
	let editing = $state<DropOff | null>(null);
	let form = $state({ creator: '', creator_name_raw: '', drop_off_date: '', drop_off_date_note: '', reason: '', learning: '', duration: '' });

	async function load() {
		loading = true;
		try {
			const [d, c] = await Promise.all([api.get<DropOff[]>('/dropoffs/'), api.get<Creator[]>('/creators/')]);
			rows = d; creators = c;
		} catch (e) { error = (e as Error).message; } finally { loading = false; }
	}

	function startAdd() {
		editing = null;
		form = { creator: '', creator_name_raw: '', drop_off_date: '', drop_off_date_note: '', reason: '', learning: '', duration: '' };
		open = true;
	}

	function startEdit(r: DropOff) {
		editing = r;
		form = { creator: r.creator ? String(r.creator) : '', creator_name_raw: r.creator_name_raw, drop_off_date: r.drop_off_date ?? '', drop_off_date_note: r.drop_off_date_note, reason: r.reason, learning: r.learning, duration: r.duration };
		open = true;
	}

	async function submit() {
		const payload = { ...form, creator: form.creator ? Number(form.creator) : null, drop_off_date: form.drop_off_date || null };
		try {
			if (editing) { await api.patch(`/dropoffs/${editing.id}/`, payload); }
			else { await api.post('/dropoffs/', payload); }
			open = false; await load();
		} catch (e) { alert((e as Error).message); }
	}

	async function remove(r: DropOff) {
		if (!confirm(`Delete drop-off entry for "${r.creator_name}"?`)) return;
		await api.del(`/dropoffs/${r.id}/`); await load();
	}

	onMount(load);
</script>

<section class="space-y-4">
	<div class="border-b-2 border-rose-600 -mx-4 px-4 pb-3">
		<div class="flex items-end justify-between flex-wrap gap-2">
			<div>
				<h1 class="text-[20px] font-semibold uppercase tracking-wide text-slate-900">
					<span class="text-rose-600">Drop-offs</span>
				</h1>
				<p class="text-[14px] text-slate-500">Log of creators who left TCH, with reason and learning.</p>
			</div>
			<Button variant="primary" onclick={startAdd}>+ Add Drop-off</Button>
		</div>
	</div>

	<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
		<div class="border border-rose-200 bg-rose-50/50 px-3 py-2">
			<div class="text-[12px] uppercase tracking-wide text-rose-700">Total Drop-offs</div>
			<div class="text-[18px] font-semibold text-slate-900">{rows.length}</div>
		</div>
		<div class="border border-slate-200 bg-white px-3 py-2">
			<div class="text-[12px] uppercase tracking-wide text-slate-500">With Date</div>
			<div class="text-[18px] font-semibold text-slate-900">{rows.filter(r => r.drop_off_date).length}</div>
		</div>
		<div class="border border-amber-200 bg-amber-50/40 px-3 py-2">
			<div class="text-[12px] uppercase tracking-wide text-amber-700">Linked to Creator</div>
			<div class="text-[18px] font-semibold text-slate-900">{rows.filter(r => r.creator).length}</div>
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
						<th class="whitespace-nowrap w-[130px]">Drop-off Date</th>
						<th>Reason</th>
						<th>Learning / Action</th>
						<th class="whitespace-nowrap">Duration</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r, i (r.id)}
						<tr>
							<td class="num text-slate-400">{i + 1}</td>
							<td class="font-medium text-slate-900">{r.creator_name}</td>
							<td class="whitespace-nowrap">
								{#if r.drop_off_date}
									<span class="text-rose-700 font-medium">{r.drop_off_date}</span>
								{:else}
									<span class="text-slate-400 text-[13px]">{r.drop_off_date_note || '—'}</span>
								{/if}
							</td>
							<td class="text-slate-700">{r.reason}</td>
							<td class="text-slate-600 text-[14px]">{r.learning}</td>
							<td class="text-slate-500 whitespace-nowrap">
								<span class="px-1.5 py-0.5 rounded bg-slate-100 text-[13px]">{r.duration}</span>
							</td>
							<td>
								<div class="flex gap-1">
									<button type="button" onclick={() => startEdit(r)} class="h-7 px-2 text-[13px] uppercase tracking-wide border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-sm">Edit</button>
									<button type="button" onclick={() => remove(r)} class="h-7 px-2 text-[13px] uppercase tracking-wide border border-slate-300 bg-white text-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-sm">Del</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr><td colspan="7" class="text-center text-slate-400 py-6">No drop-offs recorded.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Drop-off' : 'Add Drop-off'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2"><Label>Creator (pick from master)</Label><Select bind:value={form.creator} options={creators.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="— pick or use raw name below —" /></div>
		<div class="col-span-2"><Label>Creator Name (raw, if not in master)</Label><Input bind:value={form.creator_name_raw} /></div>
		<div><Label>Drop-off Date</Label><Input type="date" bind:value={form.drop_off_date} /></div>
		<div><Label>Date Note</Label><Input bind:value={form.drop_off_date_note} placeholder="e.g. when contract expires" /></div>
		<div><Label>Duration of Association</Label><Input bind:value={form.duration} placeholder="e.g. 1 year" /></div>
		<div></div>
		<div class="col-span-2"><Label>Reason for Drop-off</Label><Textarea bind:value={form.reason} /></div>
		<div class="col-span-2"><Label>Learning / Action</Label><Textarea bind:value={form.learning} /></div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
