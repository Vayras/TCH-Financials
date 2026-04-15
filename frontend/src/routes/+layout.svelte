<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Overview', color: 'hover:text-white', border: 'border-b-2 border-slate-300' },
		{ href: '/commercial', label: 'Commercial', color: 'hover:text-indigo-300', border: 'border-b-2 border-indigo-400' },
		{ href: '/creators', label: 'Creators', color: 'hover:text-violet-300', border: 'border-b-2 border-violet-400' },
		{ href: '/contracting', label: 'Contracting', color: 'hover:text-teal-300', border: 'border-b-2 border-teal-400' },
		{ href: '/exclusives', label: 'Exclusives', color: 'hover:text-amber-300', border: 'border-b-2 border-amber-400' },
		{ href: '/employees', label: 'Employees', color: 'hover:text-blue-300', border: 'border-b-2 border-blue-400' },
		{ href: '/dropoffs', label: 'Drop-offs', color: 'hover:text-rose-300', border: 'border-b-2 border-rose-400' }
	];

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<title>TCH Financials — MIS</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="bg-[#0f1623] shadow-lg">
		<div class="mx-auto max-w-[1400px] px-4 flex items-stretch">
			<nav class="flex items-stretch gap-0 flex-1 flex-wrap">
				{#each nav as item (item.href)}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						class={cn(
							'relative flex items-center px-4 py-3.5 text-[14px] uppercase tracking-widest font-semibold transition-all duration-150',
							active
								? `text-white ${item.border}`
								: `text-slate-400 border-b-2 border-transparent ${item.color}`
						)}
					>
						{item.label}
					</a>
				{/each}
			</nav>
			<div class="flex items-center pl-6 border-l border-slate-700/50 ml-2">
				<span class="text-[12px] font-bold tracking-[0.2em] uppercase text-slate-500">MIS</span>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-[1400px] px-4 py-5">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-[1400px] px-4 py-4 border-t border-slate-200 mt-6 text-[13px] text-slate-400 uppercase tracking-wide">
		Current Overview &amp; Quarterly Exclusives are derived live from Commercial Tracking.
	</footer>
</div>
