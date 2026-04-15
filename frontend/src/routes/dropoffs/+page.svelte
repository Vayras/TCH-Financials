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
	let form = $state({
		creator: '',
		creator_name_raw: '',
		drop_off_date: '',
		drop_off_date_note: '',
		reason: '',
		learning: '',
		duration: ''
	});

	async function load() {
		loading = true;
		try {
			const [d, c] = await Promise.all([
				api.get<DropOff[]>('/dropoffs/'),
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

	function startAdd() {
		editing = null;
		form = { creator: '', creator_name_raw: '', drop_off_date: '', drop_off_date_note: '', reason: '', learning: '', duration: '' };
		open = true;
	}

	function startEdit(r: DropOff) {
		editing = r;
		form = {
			creator: r.creator ? String(r.creator) : '',
			creator_name_raw: r.creator_name_raw,
			drop_off_date: r.drop_off_date ?? '',
			drop_off_date_note: r.drop_off_date_note,
			reason: r.reason,
			learning: r.learning,
			duration: r.duration
		};
		open = true;
	}

	async function submit() {
		const payload = {
			...form,
			creator: form.creator ? Number(form.creator) : null,
			drop_off_date: form.drop_off_date || null
		};
		try {
			if (editing) {
				await api.patch(`/dropoffs/${editing.id}/`, payload);
			} else {
				await api.post('/dropoffs/', payload);
			}
			open = false;
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(r: DropOff) {
		if (!confirm(`Delete drop-off entry for "${r.creator_name}"?`)) return;
		await api.del(`/dropoffs/${r.id}/`);
		await load();
	}

	onMount(load);
</script>

<section class="space-y-3">
	<div class="flex items-end justify-between flex-wrap gap-2">
		<div>
			<h1 class="text-[18px] font-semibold uppercase tracking-wide">Drop-offs</h1>
			<p class="text-[12px] text-neutral-700">Log of creators who left TCH, with reason and learning.</p>
		</div>
		<Button variant="primary" onclick={startAdd}>+ Add Drop-off</Button>
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
						<th>Creator</th>
						<th class="w-[120px] whitespace-nowrap">Drop-off Date</th>
						<th>Reason</th>
						<th>Learning / Action</th>
						<th class="whitespace-nowrap">Duration</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r, i (r.id)}
						<tr>
							<td class="num">{i + 1}</td>
							<td>{r.creator_name}</td>
							<td class="whitespace-nowrap">{r.drop_off_date ?? r.drop_off_date_note}</td>
							<td>{r.reason}</td>
							<td>{r.learning}</td>
							<td>{r.duration}</td>
							<td>
								<Button variant="ghost" onclick={() => startEdit(r)}>Edit</Button>
								<Button variant="ghost" onclick={() => remove(r)}>Del</Button>
							</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr><td colspan="7" class="text-center text-neutral-700">No drop-offs.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Drop-off' : 'Add Drop-off'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2">
			<Label>Creator (pick from master)</Label>
			<Select bind:value={form.creator} options={creators.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="— pick or use raw name below —" />
		</div>
		<div class="col-span-2">
			<Label>Creator Name (raw, if not in master)</Label>
			<Input bind:value={form.creator_name_raw} />
		</div>
		<div><Label>Drop-off Date</Label><Input type="date" bind:value={form.drop_off_date} /></div>
		<div><Label>Date Note (free text)</Label><Input bind:value={form.drop_off_date_note} placeholder="e.g. when contract expires" /></div>
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
