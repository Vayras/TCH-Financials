<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Current Overview' },
		{ href: '/commercial', label: 'Commercial Tracking' },
		{ href: '/creators', label: 'Creator Pipeline' },
		{ href: '/contracting', label: 'Contracting & Compliance' },
		{ href: '/exclusives', label: 'Exclusives (Quarterly)' },
		{ href: '/employees', label: 'Employee-Talent' },
		{ href: '/dropoffs', label: 'Drop-offs' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>TCH Financials</title>
</svelte:head>

<div class="min-h-screen bg-white text-black">
	<header class="border-b border-black">
		<div class="mx-auto max-w-[1400px] px-4 py-3 flex items-baseline gap-6">
			<a href="/" class="text-[15px] font-semibold uppercase tracking-wider">TCH Financials</a>
			<span class="text-[11px] uppercase tracking-wide text-neutral-700">FY 26-27 MIS</span>
		</div>
		<nav class="mx-auto max-w-[1400px] px-4 flex flex-wrap gap-0 border-t border-black">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class={cn(
						'px-3 py-2 text-[12px] uppercase tracking-wide border-r border-black',
						'hover:bg-black hover:text-white',
						isActive(item.href) && 'bg-black text-white'
					)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<main class="mx-auto max-w-[1400px] px-4 py-4">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-[1400px] px-4 py-4 border-t border-black mt-6 text-[11px] text-neutral-700 uppercase tracking-wide">
		Current Overview &amp; Quarterly Exclusives are derived live from Commercial Tracking.
	</footer>
</div>
