<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLSelectAttributes {
		class?: string;
		value?: string | null;
		options: { value: string; label: string }[];
		placeholder?: string;
	}

	let {
		class: klass = '',
		value = $bindable(''),
		options,
		placeholder,
		...rest
	}: Props = $props();

	const chevron =
		"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2337352f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")";
</script>

<select
	class={cn(
		'h-8 w-full rounded px-2 pr-7 text-[14px]',
		'bg-[var(--n-bg-soft)] text-[var(--n-fg)]',
		'border border-[var(--n-border)] hover:border-[var(--n-border-strong)]',
		'focus:outline-none focus:border-[var(--n-accent)]',
		'appearance-none transition-colors',
		'bg-no-repeat',
		klass
	)}
	style="background-image: {chevron}; background-position: right 8px center; background-size: 12px 12px;"
	bind:value
	{...rest}
>
	{#if placeholder !== undefined}
		<option value="">{placeholder}</option>
	{/if}
	{#each options as opt (opt.value)}
		<option value={opt.value}>{opt.label}</option>
	{/each}
</select>
