<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Contracting, type Creator } from '$lib/api';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Label from '$lib/components/ui/label.svelte';
	import Tag from '$lib/components/ui/tag.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

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
		form = {
			creator: '',
			final_meeting: '',
			agreement_sent: '',
			agreement_signed: '',
			bank_verified: '',
			time_to_sign: '',
			renewal_date: '',
			renewal_note: ''
		};
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

	let fullyDone = $derived(
		rows.filter(
			(r) =>
				r.final_meeting === 'Y' && r.agreement_signed === 'Y' && r.bank_verified === 'Y'
		).length
	);
	let pendingSig = $derived(
		rows.filter((r) => r.agreement_sent === 'Y' && r.agreement_signed !== 'Y').length
	);
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Contracting
		</div>
		<div class="flex items-end justify-between flex-wrap gap-3">
			<div>
				<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
					Contracting & Compliance
				</h1>
				<p class="text-[15px] max-w-[640px] mt-2" style="color: var(--n-fg-muted);">
					Agreement and KYC status per creator.
				</p>
			</div>
			<Button variant="primary" onclick={startAdd}>
				<Icon name="plus" size={14} /> Add Entry
			</Button>
		</div>
	</header>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Total Entries
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{rows.length}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]"></span>
				Fully Complete
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{fullyDone}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-[#d9730d]"></span>
				Pending Signature
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{pendingSig}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Completion Rate
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{rows.length > 0 ? `${Math.round((fullyDone / rows.length) * 100)}%` : '—'}
			</div>
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
		<div class="tbl-card">
			<div class="scroll-x">
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
								<td class="num" style="color: var(--n-fg-subtle);">{i + 1}</td>
								<td class="font-medium" style="color: var(--n-fg);">{r.creator_name}</td>
								<td class="text-center">
									{#if r.final_meeting === 'Y'}<Tag tone="yes">Y</Tag>
									{:else if r.final_meeting === 'N'}<Tag tone="no">N</Tag>
									{:else}<span style="color: var(--n-fg-subtle);">—</span>{/if}
								</td>
								<td class="text-center">
									{#if r.agreement_sent === 'Y'}<Tag tone="yes">Y</Tag>
									{:else if r.agreement_sent === 'N'}<Tag tone="no">N</Tag>
									{:else}<span style="color: var(--n-fg-subtle);">—</span>{/if}
								</td>
								<td class="text-center">
									{#if r.agreement_signed === 'Y'}<Tag tone="yes">Y</Tag>
									{:else if r.agreement_signed === 'N'}<Tag tone="no">N</Tag>
									{:else}<span style="color: var(--n-fg-subtle);">—</span>{/if}
								</td>
								<td class="text-center">
									{#if r.bank_verified === 'Y'}<Tag tone="yes">Y</Tag>
									{:else if r.bank_verified === 'N'}<Tag tone="no">N</Tag>
									{:else}<span style="color: var(--n-fg-subtle);">—</span>{/if}
								</td>
								<td style="color: var(--n-fg-muted);">{r.time_to_sign}</td>
								<td class="whitespace-nowrap" style="color: var(--n-fg-muted);">
									{r.renewal_date ?? r.renewal_note}
								</td>
								<td>
									<div class="flex gap-1">
										<Button variant="ghost" onclick={() => startEdit(r)}>Edit</Button>
										<Button variant="danger" onclick={() => remove(r)}>Del</Button>
									</div>
								</td>
							</tr>
						{/each}
						{#if rows.length === 0}
							<tr>
								<td
									colspan="9"
									class="text-center py-8"
									style="color: var(--n-fg-subtle);"
								>
									No entries yet.
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Contracting' : 'Add Contracting'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2">
			<Label>Creator</Label>
			<Select
				bind:value={form.creator}
				options={creators.map((c) => ({ value: String(c.id), label: c.name }))}
				placeholder="—"
			/>
		</div>
		<div>
			<Label>Final Meeting</Label>
			<Select bind:value={form.final_meeting} options={YN} placeholder="—" />
		</div>
		<div>
			<Label>Agreement Sent</Label>
			<Select bind:value={form.agreement_sent} options={YN} placeholder="—" />
		</div>
		<div>
			<Label>Agreement Signed</Label>
			<Select bind:value={form.agreement_signed} options={YN} placeholder="—" />
		</div>
		<div>
			<Label>Bank / PAN Verified</Label>
			<Select bind:value={form.bank_verified} options={YN} placeholder="—" />
		</div>
		<div>
			<Label>Time to Sign</Label>
			<Input bind:value={form.time_to_sign} placeholder="e.g. 2 weeks" />
		</div>
		<div>
			<Label>Renewal Date</Label>
			<Input type="date" bind:value={form.renewal_date} />
		</div>
		<div class="col-span-2">
			<Label>Renewal Note</Label>
			<Input bind:value={form.renewal_note} placeholder="Free-text" />
		</div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
