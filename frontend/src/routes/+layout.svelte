<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import Icon from '$lib/components/ui/icon.svelte';

	let { children } = $props();
	let collapsed = $state(false);

	const nav = [
		{ href: '/', label: 'Overview', icon: 'home' },
		{ href: '/commercial', label: 'Commercial', icon: 'briefcase' },
		{ href: '/creators', label: 'Creators', icon: 'users' },
		{ href: '/insights', label: 'Creator Insights', icon: 'sparkle' },
		{ href: '/alerts', label: 'Alerts', icon: 'bell' },
		{ href: '/contracting', label: 'Contracting', icon: 'file-signature' },
		{ href: '/exclusives', label: 'Exclusives', icon: 'star' },
		{ href: '/employees', label: 'Employees', icon: 'user-cog' },
		{ href: '/dropoffs', label: 'Drop-offs', icon: 'log-out' },
		{ href: '/entity-summary', label: 'Entity Summary', icon: 'layers' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	function currentLabel() {
		const m = nav.find((n) => isActive(n.href));
		return m?.label ?? 'TCH';
	}
</script>

<svelte:head>
	<title>TCH Financials — MIS</title>
</svelte:head>

<div class="flex min-h-screen" style="background: var(--n-bg);">
	<aside
		class="sticky top-0 self-start h-screen flex flex-col shrink-0 overflow-hidden transition-[width] duration-150 ease-out z-30"
		style="background: var(--n-bg-sidebar); border-right: 1px solid var(--n-border); width: {collapsed
			? '52px'
			: '240px'};"
	>
		<div
			class="flex items-center justify-between px-3 h-11 shrink-0"
			style="border-bottom: 1px solid var(--n-border);"
		>
			{#if !collapsed}
				<div class="flex items-center gap-2 min-w-0">
					<div
						class="h-6 w-6 rounded flex items-center justify-center text-[12px] font-semibold"
						style="background: var(--n-fg); color: var(--n-bg);"
					>
						T
					</div>
					<span class="text-[13.5px] font-semibold truncate">TCH Financials</span>
				</div>
			{:else}
				<div
					class="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[12px] font-semibold leading-none"
					style="background: var(--n-fg); color: var(--n-bg);"
				>
					T
				</div>
			{/if}
			<button
				class="h-6 w-6 inline-flex items-center justify-center rounded transition-colors"
				style="color: var(--n-fg-subtle);"
				aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				onclick={() => (collapsed = !collapsed)}
				onmouseenter={(e) => (e.currentTarget.style.background = 'var(--n-bg-hover)')}
				onmouseleave={(e) => (e.currentTarget.style.background = 'transparent')}
			>
				<Icon name={collapsed ? 'chevron-right' : 'chevrons-left'} size={14} />
			</button>
		</div>

		<nav class="flex-1 overflow-y-auto py-2">
			<div class="px-2 pb-1">
				{#if !collapsed}
					<div
						class="text-[11px] font-medium uppercase tracking-wider px-2 pb-1.5 pt-1"
						style="color: var(--n-fg-subtle); letter-spacing: 0.06em;"
					>
						Workspace
					</div>
				{/if}
				{#each nav as item (item.href)}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						class={cn('nav-item', active && 'active', collapsed && 'justify-center')}
						title={collapsed ? item.label : undefined}
					>
						<span class="nav-icon"><Icon name={item.icon} /></span>
						{#if !collapsed}<span class="truncate">{item.label}</span>{/if}
					</a>
				{/each}
			</div>
		</nav>

		<div
			class="px-3 py-2 text-[11px]"
			style="color: var(--n-fg-subtle); border-top: 1px solid var(--n-border);"
		>
			{#if !collapsed}
				MIS · derived live
			{:else}
				·
			{/if}
		</div>
	</aside>

	<div class="flex-1 min-w-0 flex flex-col">
		<header
			class="h-11 flex items-center px-5 gap-2 shrink-0 sticky top-0 z-20"
			style="background: var(--n-bg); border-bottom: 1px solid var(--n-border);"
		>
			<span class="inline-flex items-center" style="color: var(--n-fg-subtle);">
				<Icon name="home" size={14} />
			</span>
			<span class="text-[13px]" style="color: var(--n-fg-subtle);">/</span>
			<span class="text-[13px] font-medium" style="color: var(--n-fg);">{currentLabel()}</span>
		</header>

		<main class="flex-1 overflow-x-hidden">
			<div class="mx-auto w-full max-w-[1280px] px-12 py-12">
				{@render children()}
			</div>
		</main>
	</div>
</div>
