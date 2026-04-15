<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title: string;
		description?: string;
		children?: Snippet;
		footer?: Snippet;
		trigger?: Snippet;
		class?: string;
	}

	let {
		open = $bindable(false),
		title,
		description,
		children,
		footer,
		trigger,
		class: klass = ''
	}: Props = $props();
</script>

<DialogPrimitive.Root bind:open>
	{#if trigger}
		<DialogPrimitive.Trigger>
			{@render trigger()}
		</DialogPrimitive.Trigger>
	{/if}
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<DialogPrimitive.Content
			class={cn(
				'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
				'w-full max-w-2xl bg-white border border-black p-4 shadow-none',
				'max-h-[90vh] overflow-y-auto',
				klass
			)}
		>
			<div class="flex items-start justify-between border-b border-black pb-2 mb-3">
				<div>
					<DialogPrimitive.Title class="text-[15px] font-semibold uppercase tracking-wide">
						{title}
					</DialogPrimitive.Title>
					{#if description}
						<DialogPrimitive.Description class="text-[12px] text-neutral-700 mt-0.5">
							{description}
						</DialogPrimitive.Description>
					{/if}
				</div>
				<DialogPrimitive.Close
					class="h-7 w-7 border border-black inline-flex items-center justify-center hover:bg-black hover:text-white"
					aria-label="Close"
				>
					×
				</DialogPrimitive.Close>
			</div>
			{@render children?.()}
			{#if footer}
				<div class="mt-4 flex justify-end gap-2 border-t border-black pt-3">
					{@render footer()}
				</div>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
