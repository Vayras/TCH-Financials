<script lang="ts">
	import type { HTMLLabelAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	interface Props extends HTMLLabelAttributes {
		class?: string;
	}

	let { class: klass = '', children, ...rest }: Props = $props();
</script>

<label
	class={cn('block text-[12px] font-medium mb-1.5 text-[var(--n-fg-muted)]', klass)}
	{...rest}
>
	{@render children?.()}
</label>
