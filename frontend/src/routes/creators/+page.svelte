<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Creator } from '$lib/api';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Label from '$lib/components/ui/label.svelte';

	const REL = [
		{ value: 'Exclusive', label: 'Exclusive' },
		{ value: 'Friend', label: 'Friend' },
		{ value: 'Dropping', label: 'Dropping out soon' },
		{ value: 'NonTCH', label: 'Non TCH' }
	];
	const STAGE = [
		{ value: 'Lead', label: 'Lead' },
		{ value: 'Discussing', label: 'Discussing' },
		{ value: 'Closed', label: 'Closed' },
		{ value: 'Dropped', label: 'Dropped' }
	];
	const SOURCE = [
		{ value: 'EMW', label: 'EMW' },
		{ value: 'TCH', label: 'TCH' },
		{ value: 'OTHER', label: 'Other' }
	];

	let rows = $state<Creator[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let addOpen = $state(false);
	let editing = $state<Creator | null>(null);
	let q = $state('');
	let relFilter = $state('All');
	let form = $state({
		name: '', category: '', source: '', stage: '', relationship: 'Friend',
		doj: '', doj_note: '', profile_url: '', location: '', ops_manager: '', notes: ''
	});

	async function load() {
		loading = true;
		try {
			rows = await api.get<Creator[]>('/creators/');
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	function startAdd() {
		editing = null;
		form = { name: '', category: '', source: '', stage: '', relationship: 'Friend', doj: '', doj_note: '', profile_url: '', location: '', ops_manager: '', notes: '' };
		addOpen = true;
	}

	function startEdit(r: Creator) {
		editing = r;
		form = { name: r.name, category: r.category, source: r.source, stage: r.stage, relationship: r.relationship, doj: r.doj ?? '', doj_note: r.doj_note, profile_url: r.profile_url, location: r.location, ops_manager: r.ops_manager, notes: r.notes };
		addOpen = true;
	}

	async function submit() {
		try {
			const payload = { ...form, doj: form.doj || null };
			if (editing) { await api.patch(`/creators/${editing.id}/`, payload); }
			else { await api.post('/creators/', payload); }
			addOpen = false;
			await load();
		} catch (e) { alert((e as Error).message); }
	}

	async function remove(r: Creator) {
		if (!confirm(`Delete creator "${r.name}"?`)) return;
		try { await api.del(`/creators/${r.id}/`); await load(); }
		catch (e) { alert((e as Error).message); }
	}

	onMount(load);

	const REL_FILTERS = ['All', 'Exclusive', 'Friend', 'Dropping', 'NonTCH'];

	let filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return rows.filter((r) => {
			if (relFilter !== 'All' && r.relationship !== relFilter) return false;
			if (!needle) return true;
			return r.name?.toLowerCase().includes(needle) || r.category?.toLowerCase().includes(needle) || r.ops_manager?.toLowerCase().includes(needle);
		});
	});

	let counts = $derived.by(() => ({
		exclusive: rows.filter(r => r.relationship === 'Exclusive').length,
		friend: rows.filter(r => r.relationship === 'Friend').length,
		dropping: rows.filter(r => r.relationship === 'Dropping').length,
	}));

	function relBadge(rel: string) {
		if (rel === 'Exclusive') return 'bg-violet-100 text-violet-800 border border-violet-300';
		if (rel === 'Dropping') return 'bg-orange-100 text-orange-800 border border-orange-300';
		if (rel === 'NonTCH') return 'bg-slate-100 text-slate-600 border border-slate-300';
		return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
	}
	function stageBadge(stage: string) {
		if (stage === 'Closed') return 'bg-green-100 text-green-800';
		if (stage === 'Dropped') return 'bg-red-100 text-red-700';
		if (stage === 'Discussing') return 'bg-blue-100 text-blue-700';
		return 'bg-slate-100 text-slate-600';
	}
</script>

<section class="space-y-4">
	<div class="border-b-2 border-violet-600 -mx-4 px-4 pb-3">
		<div class="flex items-end justify-between flex-wrap gap-2">
			<div>
				<h1 class="text-[18px] font-semibold uppercase tracking-wide text-slate-900">
					<span class="text-violet-600">Creator</span> Pipeline
				</h1>
				<p class="text-[12px] text-slate-500">Master list of all creators TCH works with.</p>
			</div>
			<Button variant="primary" onclick={startAdd}>+ Add Creator</Button>
		</div>
	</div>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		<div class="border border-violet-200 bg-violet-50/50 px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-violet-700">Total Creators</div>
			<div class="text-[16px] font-semibold text-slate-900">{rows.length}</div>
		</div>
		<div class="border border-violet-200 bg-violet-50/30 px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-violet-700">Exclusives</div>
			<div class="text-[16px] font-semibold text-slate-900">{counts.exclusive}</div>
		</div>
		<div class="border border-emerald-200 bg-emerald-50/40 px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-emerald-700">Friends</div>
			<div class="text-[16px] font-semibold text-slate-900">{counts.friend}</div>
		</div>
		<div class="border border-orange-200 bg-orange-50/40 px-3 py-2">
			<div class="text-[10px] uppercase tracking-wide text-orange-700">Dropping</div>
			<div class="text-[16px] font-semibold text-slate-900">{counts.dropping}</div>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<input
			type="text"
			placeholder="Search name, category, ops manager…"
			class="h-8 flex-1 min-w-[220px] border border-slate-300 px-2 text-[13px] rounded-sm focus:outline focus:outline-2 focus:outline-violet-500 bg-white"
			bind:value={q}
		/>
		{#each REL_FILTERS as f (f)}
			<button
				type="button"
				onclick={() => (relFilter = f)}
				class="h-8 px-3 text-[11px] uppercase tracking-wide border rounded-sm transition-colors {relFilter === f
					? 'bg-violet-600 text-white border-violet-600'
					: 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}"
			>{f}</button>
		{/each}
	</div>

	{#if loading}
		<div class="text-[13px] text-slate-500">Loading…</div>
	{:else if error}
		<div class="text-[13px] border border-rose-300 bg-rose-50 text-rose-800 p-2 rounded-sm">Error: {error}</div>
	{:else}
		<div class="overflow-x-auto rounded-sm border border-slate-200">
			<table class="grid-table">
				<thead>
					<tr>
						<th class="w-8 num">#</th>
						<th>Creator Name</th>
						<th>Category / Niche</th>
						<th>Source</th>
						<th>Stage</th>
						<th>Relationship</th>
						<th>Location</th>
						<th>Ops Mgr</th>
						<th>DOJ</th>
						<th>Profile</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as r, i (r.id)}
						<tr>
							<td class="num text-slate-400">{i + 1}</td>
							<td class="font-medium text-slate-900">{r.name}</td>
							<td class="text-slate-600">{r.category}</td>
							<td>
								{#if r.source}
									<span class="px-1.5 py-0.5 rounded text-[10px] font-medium {r.source === 'EMW' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}">{r.source}</span>
								{/if}
							</td>
							<td>
								{#if r.stage}
									<span class="px-1.5 py-0.5 rounded text-[10px] font-medium {stageBadge(r.stage)}">{r.stage}</span>
								{/if}
							</td>
							<td>
								{#if r.relationship}
									<span class="px-1.5 py-0.5 rounded text-[10px] font-medium {relBadge(r.relationship)}">{r.relationship === 'NonTCH' ? 'Non TCH' : r.relationship}</span>
								{/if}
							</td>
							<td class="text-slate-600">{r.location}</td>
							<td class="text-slate-700">{r.ops_manager}</td>
							<td class="whitespace-nowrap text-slate-600">{r.doj ?? r.doj_note}</td>
							<td>
								{#if r.profile_url}
									<a class="inline-link text-[12px]" href={r.profile_url} target="_blank" rel="noopener">link ↗</a>
								{/if}
							</td>
							<td>
								<div class="flex gap-1">
									<button type="button" onclick={() => startEdit(r)} class="h-7 px-2 text-[11px] uppercase tracking-wide border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-600 hover:text-white hover:border-violet-600 rounded-sm">Edit</button>
									<button type="button" onclick={() => remove(r)} class="h-7 px-2 text-[11px] uppercase tracking-wide border border-slate-300 bg-white text-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-sm">Del</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if filtered.length === 0}
						<tr><td colspan="11" class="text-center text-slate-400 py-6">No creators match.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<Dialog bind:open={addOpen} title={editing ? 'Edit Creator' : 'Add Creator'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2"><Label>Name</Label><Input bind:value={form.name} placeholder="Saili Satwe" /></div>
		<div><Label>Category / Niche</Label><Input bind:value={form.category} placeholder="Lifestyle / Fashion" /></div>
		<div><Label>Source</Label><Select bind:value={form.source} options={SOURCE} placeholder="—" /></div>
		<div><Label>Stage</Label><Select bind:value={form.stage} options={STAGE} placeholder="—" /></div>
		<div><Label>Relationship</Label><Select bind:value={form.relationship} options={REL} /></div>
		<div><Label>DOJ</Label><Input type="date" bind:value={form.doj} /></div>
		<div><Label>DOJ Note</Label><Input bind:value={form.doj_note} placeholder="e.g. MOU Date" /></div>
		<div><Label>Location</Label><Input bind:value={form.location} placeholder="Mumbai" /></div>
		<div><Label>Ops Manager</Label><Input bind:value={form.ops_manager} placeholder="Arzoo / Akshita" /></div>
		<div class="col-span-2"><Label>Profile URL</Label><Input type="url" bind:value={form.profile_url} placeholder="https://www.instagram.com/…" /></div>
		<div class="col-span-2"><Label>Notes</Label><Input bind:value={form.notes} /></div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (addOpen = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
