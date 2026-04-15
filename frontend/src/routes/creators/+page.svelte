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
	let form = $state({
		name: '',
		category: '',
		source: '',
		stage: '',
		relationship: 'Friend',
		doj: '',
		doj_note: '',
		profile_url: '',
		location: '',
		ops_manager: '',
		notes: ''
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
		form = {
			name: '', category: '', source: '', stage: '', relationship: 'Friend',
			doj: '', doj_note: '', profile_url: '', location: '', ops_manager: '', notes: ''
		};
		addOpen = true;
	}

	function startEdit(r: Creator) {
		editing = r;
		form = {
			name: r.name,
			category: r.category,
			source: r.source,
			stage: r.stage,
			relationship: r.relationship,
			doj: r.doj ?? '',
			doj_note: r.doj_note,
			profile_url: r.profile_url,
			location: r.location,
			ops_manager: r.ops_manager,
			notes: r.notes
		};
		addOpen = true;
	}

	async function submit() {
		const payload = {
			...form,
			doj: form.doj || null
		};
		try {
			if (editing) {
				await api.patch(`/creators/${editing.id}/`, payload);
			} else {
				await api.post('/creators/', payload);
			}
			addOpen = false;
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(r: Creator) {
		if (!confirm(`Delete creator "${r.name}"?`)) return;
		try {
			await api.del(`/creators/${r.id}/`);
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	onMount(load);
</script>

<section class="space-y-3">
	<div class="flex items-end justify-between flex-wrap gap-2">
		<div>
			<h1 class="text-[18px] font-semibold uppercase tracking-wide">Creator Pipeline</h1>
			<p class="text-[12px] text-neutral-700">Master list of all creators TCH works with.</p>
		</div>
		<Button variant="primary" onclick={startAdd}>+ Add Creator</Button>
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
						<th class="w-8 num">#</th>
						<th>Creator Name</th>
						<th>Category / Niche</th>
						<th>Source</th>
						<th>Stage</th>
						<th>Relationship</th>
						<th class="whitespace-nowrap">Location</th>
						<th class="whitespace-nowrap">Ops Mgr</th>
						<th class="whitespace-nowrap">DOJ</th>
						<th>Profile</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r, i (r.id)}
						<tr>
							<td class="num">{i + 1}</td>
							<td>{r.name}</td>
							<td>{r.category}</td>
							<td>{r.source}</td>
							<td>{r.stage}</td>
							<td>{r.relationship}</td>
							<td>{r.location}</td>
							<td>{r.ops_manager}</td>
							<td class="whitespace-nowrap">{r.doj ?? r.doj_note}</td>
							<td>
								{#if r.profile_url}
									<a class="inline-link" href={r.profile_url} target="_blank" rel="noopener">link</a>
								{/if}
							</td>
							<td>
								<Button variant="ghost" onclick={() => startEdit(r)}>Edit</Button>
								<Button variant="ghost" onclick={() => remove(r)}>Del</Button>
							</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr><td colspan="11" class="text-center text-neutral-700">No creators yet.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<Dialog bind:open={addOpen} title={editing ? 'Edit Creator' : 'Add Creator'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2">
			<Label>Name</Label>
			<Input bind:value={form.name} placeholder="Saili Satwe" />
		</div>
		<div>
			<Label>Category / Niche</Label>
			<Input bind:value={form.category} placeholder="Lifestyle / Fashion" />
		</div>
		<div>
			<Label>Source</Label>
			<Select bind:value={form.source} options={SOURCE} placeholder="—" />
		</div>
		<div>
			<Label>Stage</Label>
			<Select bind:value={form.stage} options={STAGE} placeholder="—" />
		</div>
		<div>
			<Label>Relationship</Label>
			<Select bind:value={form.relationship} options={REL} />
		</div>
		<div>
			<Label>DOJ</Label>
			<Input type="date" bind:value={form.doj} />
		</div>
		<div>
			<Label>DOJ Note (if unparseable)</Label>
			<Input bind:value={form.doj_note} placeholder="e.g. MOU Date" />
		</div>
		<div>
			<Label>Location</Label>
			<Input bind:value={form.location} placeholder="Mumbai" />
		</div>
		<div>
			<Label>Operations Manager</Label>
			<Input bind:value={form.ops_manager} placeholder="Arzoo / Akshita" />
		</div>
		<div class="col-span-2">
			<Label>Profile URL</Label>
			<Input type="url" bind:value={form.profile_url} placeholder="https://www.instagram.com/…" />
		</div>
		<div class="col-span-2">
			<Label>Notes</Label>
			<Input bind:value={form.notes} />
		</div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (addOpen = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
