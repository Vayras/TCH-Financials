<script lang="ts">
	import { onMount } from 'svelte';
	import { api, type Creator } from '$lib/api';
	import Button from '$lib/components/ui/button.svelte';
	import Dialog from '$lib/components/ui/dialog.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Label from '$lib/components/ui/label.svelte';
	import Tag from '$lib/components/ui/tag.svelte';
	import Icon from '$lib/components/ui/icon.svelte';

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
		try {
			const payload = { ...form, doj: form.doj || null };
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

	const REL_FILTERS = ['All', 'Exclusive', 'Friend', 'Dropping', 'NonTCH'];

	let filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return rows.filter((r) => {
			if (relFilter !== 'All' && r.relationship !== relFilter) return false;
			if (!needle) return true;
			return (
				r.name?.toLowerCase().includes(needle) ||
				r.category?.toLowerCase().includes(needle) ||
				r.ops_manager?.toLowerCase().includes(needle)
			);
		});
	});

	let counts = $derived.by(() => ({
		exclusive: rows.filter((r) => r.relationship === 'Exclusive').length,
		friend: rows.filter((r) => r.relationship === 'Friend').length,
		dropping: rows.filter((r) => r.relationship === 'Dropping').length
	}));

	function relTone(rel: string) {
		if (rel === 'Exclusive') return 'exclusive' as const;
		if (rel === 'Dropping') return 'dropping' as const;
		if (rel === 'NonTCH') return 'nontch' as const;
		return 'friend' as const;
	}
	function stageTone(stage: string) {
		if (stage === 'Closed') return 'yes' as const;
		if (stage === 'Dropped') return 'no' as const;
		if (stage === 'Discussing') return 'accent' as const;
		return 'neutral' as const;
	}
</script>

<section class="space-y-6">
	<header class="space-y-2">
		<div
			class="text-[12px] font-medium uppercase"
			style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
		>
			Workspace · Creators
		</div>
		<div class="flex items-end justify-between flex-wrap gap-3">
			<div>
				<h1 class="page-title text-[40px] leading-[1.15] font-bold" style="color: var(--n-fg);">
					Creator Pipeline
				</h1>
				<p class="text-[15px] max-w-[640px] mt-2" style="color: var(--n-fg-muted);">
					Master list of all creators TCH works with — relationship status, source, and ops owner.
				</p>
			</div>
			<Button variant="primary" onclick={startAdd}>
				<Icon name="plus" size={14} /> Add Creator
			</Button>
		</div>
	</header>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				Total Creators
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
				<span class="h-1.5 w-1.5 rounded-full bg-[#a371d3]"></span>
				Exclusives
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{counts.exclusive}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-[#0f7b6c]"></span>
				Friends
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{counts.friend}
			</div>
		</div>
		<div class="rounded p-3" style="border: 1px solid var(--n-border); background: var(--n-bg);">
			<div
				class="text-[11.5px] font-medium uppercase flex items-center gap-1.5"
				style="color: var(--n-fg-subtle); letter-spacing: 0.04em;"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-[#d9730d]"></span>
				Dropping
			</div>
			<div class="text-[22px] font-semibold tabular-nums mt-1" style="color: var(--n-fg);">
				{counts.dropping}
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
				placeholder="Search name, category, ops manager…"
				class="h-8 w-full rounded pl-8 pr-2 text-[14px] bg-[var(--n-bg-soft)] text-[var(--n-fg)] border border-[var(--n-border)] hover:border-[var(--n-border-strong)] focus:outline-none focus:border-[var(--n-accent)] transition-colors placeholder:text-[var(--n-fg-subtle)]"
				bind:value={q}
			/>
		</div>
		<div class="seg-toggle">
			{#each REL_FILTERS as f (f)}
				<button type="button" class:active={relFilter === f} onclick={() => (relFilter = f)}>
					{f === 'NonTCH' ? 'Non TCH' : f}
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
		<div class="tbl-card">
			<div class="scroll-x">
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
								<td class="num" style="color: var(--n-fg-subtle);">{i + 1}</td>
								<td class="font-medium" style="color: var(--n-fg);">{r.name}</td>
								<td style="color: var(--n-fg-muted);">{r.category}</td>
								<td>
									{#if r.source}
										<Tag tone={r.source === 'EMW' ? 'emw' : 'neutral'}>{r.source}</Tag>
									{/if}
								</td>
								<td>
									{#if r.stage}
										<Tag tone={stageTone(r.stage)}>{r.stage}</Tag>
									{/if}
								</td>
								<td>
									{#if r.relationship}
										<Tag tone={relTone(r.relationship)}>
											{r.relationship === 'NonTCH' ? 'Non TCH' : r.relationship}
										</Tag>
									{/if}
								</td>
								<td style="color: var(--n-fg-muted);">{r.location}</td>
								<td style="color: var(--n-fg);">{r.ops_manager}</td>
								<td class="whitespace-nowrap" style="color: var(--n-fg-muted);">
									{r.doj ?? r.doj_note}
								</td>
								<td>
									{#if r.profile_url}
										<a
											class="inline-link text-[13px]"
											href={r.profile_url}
											target="_blank"
											rel="noopener">link ↗</a
										>
									{/if}
								</td>
								<td>
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
									colspan="11"
									class="text-center py-8"
									style="color: var(--n-fg-subtle);"
								>
									No creators match.
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
			<div class="tbl-caption">
				<span>Tip · scroll horizontally on narrow screens to see all columns.</span>
			</div>
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
			<Label>DOJ Note</Label>
			<Input bind:value={form.doj_note} placeholder="e.g. MOU Date" />
		</div>
		<div>
			<Label>Location</Label>
			<Input bind:value={form.location} placeholder="Mumbai" />
		</div>
		<div>
			<Label>Ops Manager</Label>
			<Input bind:value={form.ops_manager} placeholder="Arzoo / Akshita" />
		</div>
		<div class="col-span-2">
			<Label>Profile URL</Label>
			<Input
				type="url"
				bind:value={form.profile_url}
				placeholder="https://www.instagram.com/…"
			/>
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
