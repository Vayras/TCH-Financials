<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Current Overview', color: 'hover:bg-slate-700' },
		{ href: '/commercial', label: 'Commercial Tracking', color: 'hover:bg-indigo-700' },
		{ href: '/creators', label: 'Creator Pipeline', color: 'hover:bg-violet-700' },
		{ href: '/contracting', label: 'Contracting & Compliance', color: 'hover:bg-teal-700' },
		{ href: '/exclusives', label: 'Exclusives (Quarterly)', color: 'hover:bg-amber-700' },
		{ href: '/employees', label: 'Employee-Talent', color: 'hover:bg-blue-700' },
		{ href: '/dropoffs', label: 'Drop-offs', color: 'hover:bg-rose-700' }
	];

	const activeColors: Record<string, string> = {
		'/': 'bg-slate-700 text-white',
		'/commercial': 'bg-indigo-600 text-white',
		'/creators': 'bg-violet-600 text-white',
		'/contracting': 'bg-teal-600 text-white',
		'/exclusives': 'bg-amber-600 text-white',
		'/employees': 'bg-blue-600 text-white',
		'/dropoffs': 'bg-rose-600 text-white'
	};

	function isActive(href: string) {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}

	function activeColor(href: string) {
		return activeColors[href] ?? 'bg-slate-800 text-white';
	}
</script>

<svelte:head>
	<title>TCH Financials</title>
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="bg-slate-900 text-white shadow-md">
		<div class="mx-auto max-w-[1400px] px-4 py-3 flex items-baseline gap-3">
			<a href="/" class="text-[16px] font-bold uppercase tracking-wider text-white">TCH Financials</a>
			<span class="text-[10px] uppercase tracking-widest text-slate-400 font-medium">MIS</span>
		</div>
		<nav class="mx-auto max-w-[1400px] px-4 flex flex-wrap gap-0">
			{#each nav as item (item.href)}
				<a
					href={item.href}
					class={cn(
						'px-3 py-2 text-[11px] uppercase tracking-wide font-medium transition-colors',
						isActive(item.href)
							? activeColor(item.href)
							: `text-slate-300 ${item.color} hover:text-white`
					)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</header>

	<main class="mx-auto max-w-[1400px] px-4 py-5">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-[1400px] px-4 py-4 border-t border-slate-200 mt-6 text-[11px] text-slate-400 uppercase tracking-wide">
		Current Overview &amp; Quarterly Exclusives are derived live from Commercial Tracking.
	</footer>
</div>
