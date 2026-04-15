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
</script>

<select
	class={cn(
		'h-8 w-full border border-black bg-white px-2 text-[15px]',
		'focus:outline focus:outline-2 focus:outline-black',
		klass
	)}
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
