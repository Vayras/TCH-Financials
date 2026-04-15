<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
	type Size = 'sm' | 'md';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		class?: string;
	}

	let {
		variant = 'outline',
		size = 'sm',
		class: klass = '',
		children,
		...rest
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center font-medium border transition-colors select-none disabled:opacity-50 disabled:pointer-events-none';

	const variants: Record<Variant, string> = {
		primary: 'bg-black text-white border-black hover:bg-neutral-800',
		outline: 'bg-white text-black border-black hover:bg-neutral-100',
		ghost: 'bg-transparent text-black border-transparent hover:bg-neutral-100',
		danger: 'bg-white text-black border-black hover:bg-black hover:text-white'
	};

	const sizes: Record<Size, string> = {
		sm: 'h-7 px-2.5 text-[12px]',
		md: 'h-9 px-3 text-[13px]'
	};
</script>

<button class={cn(base, variants[variant], sizes[size], klass)} {...rest}>
	{@render children?.()}
</button>
