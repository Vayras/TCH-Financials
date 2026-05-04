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
		'min-h-[72px] w-full rounded px-2 py-1.5 text-[14px]',
		'bg-[var(--n-bg-soft)] text-[var(--n-fg)]',
		'border border-[var(--n-border)] hover:border-[var(--n-border-strong)]',
		'focus:outline-none focus:border-[var(--n-accent)]',
		'transition-colors resize-y',
		'placeholder:text-[var(--n-fg-subtle)]',
		klass
	)}
	bind:value
	{...rest}
></textarea>
