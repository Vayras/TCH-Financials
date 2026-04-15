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
	let form = $state({
		creator: '',
		final_meeting: '',
		agreement_sent: '',
		agreement_signed: '',
		bank_verified: '',
		time_to_sign: '',
		renewal_date: '',
		renewal_note: ''
	});

	async function load() {
		loading = true;
		try {
			const [r, c] = await Promise.all([
				api.get<Contracting[]>('/contracting/'),
				api.get<Creator[]>('/creators/')
			]);
			rows = r;
			creators = c;
		} catch (e) {
			error = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	function startAdd() {
		editing = null;
		form = { creator: '', final_meeting: '', agreement_sent: '', agreement_signed: '', bank_verified: '', time_to_sign: '', renewal_date: '', renewal_note: '' };
		open = true;
	}

	function startEdit(row: Contracting) {
		editing = row;
		form = {
			creator: String(row.creator),
			final_meeting: row.final_meeting,
			agreement_sent: row.agreement_sent,
			agreement_signed: row.agreement_signed,
			bank_verified: row.bank_verified,
			time_to_sign: row.time_to_sign,
			renewal_date: row.renewal_date ?? '',
			renewal_note: row.renewal_note
		};
		open = true;
	}

	async function submit() {
		const payload = {
			creator: Number(form.creator),
			final_meeting: form.final_meeting,
			agreement_sent: form.agreement_sent,
			agreement_signed: form.agreement_signed,
			bank_verified: form.bank_verified,
			time_to_sign: form.time_to_sign,
			renewal_date: form.renewal_date || null,
			renewal_note: form.renewal_note
		};
		try {
			if (editing) {
				await api.patch(`/contracting/${editing.id}/`, payload);
			} else {
				await api.post('/contracting/', payload);
			}
			open = false;
			await load();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	async function remove(r: Contracting) {
		if (!confirm(`Delete contracting for "${r.creator_name}"?`)) return;
		await api.del(`/contracting/${r.id}/`);
		await load();
	}

	onMount(load);
</script>

<section class="space-y-3">
	<div class="flex items-end justify-between flex-wrap gap-2">
		<div>
			<h1 class="text-[18px] font-semibold uppercase tracking-wide">Contracting &amp; Compliance</h1>
			<p class="text-[12px] text-neutral-700">Agreement and KYC status per creator.</p>
		</div>
		<Button variant="primary" onclick={startAdd}>+ Add Entry</Button>
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
						<th>Final Meeting</th>
						<th>Agreement Sent</th>
						<th>Agreement Signed</th>
						<th>Bank / PAN Verified</th>
						<th>Time to Sign</th>
						<th>Renewal Date</th>
						<th class="w-[110px]">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r, i (r.id)}
						<tr>
							<td class="num">{i + 1}</td>
							<td>{r.creator_name}</td>
							<td>{r.final_meeting}</td>
							<td>{r.agreement_sent}</td>
							<td>{r.agreement_signed}</td>
							<td>{r.bank_verified}</td>
							<td>{r.time_to_sign}</td>
							<td>{r.renewal_date ?? r.renewal_note}</td>
							<td>
								<Button variant="ghost" onclick={() => startEdit(r)}>Edit</Button>
								<Button variant="ghost" onclick={() => remove(r)}>Del</Button>
							</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr><td colspan="9" class="text-center text-neutral-700">No entries yet.</td></tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Contracting' : 'Add Contracting'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2">
			<Label>Creator</Label>
			<Select bind:value={form.creator} options={creators.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="—" />
		</div>
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
