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
		'h-8 w-full rounded px-2 text-[14px] tabular-nums',
		'bg-[var(--n-bg-soft)] text-[var(--n-fg)]',
		'border border-[var(--n-border)] hover:border-[var(--n-border-strong)]',
		'focus:outline-none focus:border-[var(--n-accent)]',
		'transition-colors',
		'placeholder:text-[var(--n-fg-subtle)]',
		klass
	)}
	bind:value
	{...rest}
/>
