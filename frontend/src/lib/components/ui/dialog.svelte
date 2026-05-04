<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import Icon from './icon.svelte';
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
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
		<DialogPrimitive.Content
			class={cn(
				'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
				'w-full max-w-2xl rounded-lg p-5',
				'max-h-[90vh] overflow-y-auto',
				klass
			)}
			style="background: var(--n-bg); border: 1px solid var(--n-border); box-shadow: 0 14px 36px rgba(15, 15, 15, 0.16), 0 2px 6px rgba(15, 15, 15, 0.06);"
		>
			<div
				class="flex items-start justify-between pb-3 mb-4"
				style="border-bottom: 1px solid var(--n-border);"
			>
				<div>
					<DialogPrimitive.Title
						class="page-title text-[20px] font-semibold"
						style="color: var(--n-fg);"
					>
						{title}
					</DialogPrimitive.Title>
					{#if description}
						<DialogPrimitive.Description
							class="text-[13.5px] mt-1"
							style="color: var(--n-fg-muted);"
						>
							{description}
						</DialogPrimitive.Description>
					{/if}
				</div>
				<DialogPrimitive.Close
					class="h-7 w-7 rounded inline-flex items-center justify-center transition-colors hover:[background:var(--n-bg-hover)]"
					style="color: var(--n-fg-muted);"
					aria-label="Close"
				>
					<Icon name="x" size={16} />
				</DialogPrimitive.Close>
			</div>
			{@render children?.()}
			{#if footer}
				<div
					class="mt-5 flex justify-end gap-2 pt-4"
					style="border-top: 1px solid var(--n-border);"
				>
					{@render footer()}
				</div>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
