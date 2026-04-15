<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLTextareaAttributes {
		class?: string;
		value?: string | null;
	}

	let { class: klass = '', value = $bindable(''), ...rest }: Props = $props();
</script>

<textarea
	class={cn(
		'min-h-[60px] w-full border border-black bg-white px-2 py-1 text-[13px]',
		'focus:outline focus:outline-2 focus:outline-black',
		klass
	)}
	bind:value
	{...rest}
></textarea>
