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
		'inline-flex items-center justify-center font-medium rounded transition-[background-color,color,border-color,box-shadow] duration-100 select-none disabled:opacity-50 disabled:pointer-events-none';

	const variants: Record<Variant, string> = {
		primary:
			'border border-transparent bg-[var(--n-fg)] text-white hover:bg-[#2f2c27] shadow-[0_1px_2px_rgba(15,15,15,0.1)]',
		outline:
			'border border-[var(--n-border-strong)] bg-transparent text-[var(--n-fg)] hover:bg-[var(--n-bg-hover)]',
		ghost:
			'border border-transparent bg-transparent text-[var(--n-fg-muted)] hover:bg-[var(--n-bg-hover)] hover:text-[var(--n-fg)]',
		danger:
			'border border-[#fecaca] bg-transparent text-[#b91c1c] hover:bg-[#fef2f2] hover:border-[#fca5a5]'
	};

	const sizes: Record<Size, string> = {
		sm: 'h-7 px-2.5 text-[13px] gap-1.5',
		md: 'h-8 px-3 text-[14px] gap-2'
	};
</script>

<button class={cn(base, variants[variant], sizes[size], klass)} {...rest}>
	{@render children?.()}
</button>
