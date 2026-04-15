<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLInputAttributes {
		class?: string;
		value?: string | number | null;
	}

	let { class: klass = '', value = $bindable(''), ...rest }: Props = $props();
</script>

<input
	class={cn(
		'h-8 w-full border border-black bg-white px-2 text-[15px] tabular-nums',
		'focus:outline focus:outline-2 focus:outline-black',
		klass
	)}
	bind:value
	{...rest}
/>
