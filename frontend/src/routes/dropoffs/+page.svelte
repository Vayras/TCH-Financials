<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type DropOff, type Creator } from '$lib/api';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Textarea from '$lib/components/ui/textarea.svelte';
	import Label from '$lib/components/ui/label.svelte';
	import Tag from '$lib/components/ui/tag.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

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
		form = {
			creator: '',
			creator_name_raw: '',
			drop_off_date: '',
			drop_off_date_note: '',
			reason: '',
			learning: '',
			duration: ''
		};
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

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Drop-offs
		</div>
		<div class="flex items-end justify-between flex-wrap gap-3">
			<div>
				<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
					Drop-offs
				</h1>
				<p class="text-[15px] max-w-[640px] mt-2" style="color: var(--n-fg-muted);">
					Log of creators who left TCH, with reason and learning.
				</p>
			</div>
			<Button variant="primary" onclick={startAdd}>
				<Icon name="plus" size={14} /> Add Drop-off
			</Button>
		</div>
	</header>

	<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Total Drop-offs
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{rows.length}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				With Date
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{rows.filter((r) => r.drop_off_date).length}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Linked to Creator
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{rows.filter((r) => r.creator).length}
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
								<td class="num" style="color: var(--n-fg-subtle);">{i + 1}</td>
								<td class="font-medium" style="color: var(--n-fg);">{r.creator_name}</td>
								<td class="whitespace-nowrap">
									{#if r.drop_off_date}
										<span class="font-medium" style="color: var(--n-fg);">
											{r.drop_off_date}
										</span>
									{:else}
										<span class="text-[13px]" style="color: var(--n-fg-subtle);">
											{r.drop_off_date_note || '—'}
										</span>
									{/if}
								</td>
								<td style="color: var(--n-fg);">{r.reason}</td>
								<td class="text-[13.5px]" style="color: var(--n-fg-muted);">
									{r.learning}
								</td>
								<td class="whitespace-nowrap">
									<Tag tone="neutral">{r.duration}</Tag>
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
									colspan="7"
									class="text-center py-8"
									style="color: var(--n-fg-subtle);"
								>
									No drop-offs recorded.
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</section>

<Dialog bind:open title={editing ? 'Edit Drop-off' : 'Add Drop-off'}>
	<div class="grid grid-cols-2 gap-3">
		<div class="col-span-2">
			<Label>Creator (pick from master)</Label>
			<Select
				bind:value={form.creator}
				options={creators.map((c) => ({ value: String(c.id), label: c.name }))}
				placeholder="— pick or use raw name below —"
			/>
		</div>
		<div class="col-span-2">
			<Label>Creator Name (raw, if not in master)</Label>
			<Input bind:value={form.creator_name_raw} />
		</div>
		<div>
			<Label>Drop-off Date</Label>
			<Input type="date" bind:value={form.drop_off_date} />
		</div>
		<div>
			<Label>Date Note</Label>
			<Input bind:value={form.drop_off_date_note} placeholder="e.g. when contract expires" />
		</div>
		<div>
			<Label>Duration of Association</Label>
			<Input bind:value={form.duration} placeholder="e.g. 1 year" />
		</div>
		<div></div>
		<div class="col-span-2">
			<Label>Reason for Drop-off</Label>
			<Textarea bind:value={form.reason} />
		</div>
		<div class="col-span-2">
			<Label>Learning / Action</Label>
			<Textarea bind:value={form.learning} />
		</div>
	</div>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
		<Button variant="primary" onclick={submit}>{editing ? 'Save' : 'Create'}</Button>
	{/snippet}
</Dialog>
