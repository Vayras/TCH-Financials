<script lang="ts">
	import type { HTMLLabelAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLLabelAttributes {
		class?: string;
	}

	let { class: klass = '', children, ...rest }: Props = $props();
</script>

<label
	class={cn('block text-[11px] uppercase tracking-wide font-medium text-black mb-1', klass)}
	{...rest}
>
	{@render children?.()}
</label>
