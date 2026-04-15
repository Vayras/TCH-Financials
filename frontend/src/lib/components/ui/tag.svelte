<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	type Tone =
		| 'neutral'
		| 'inbound'
		| 'outbound'
		| 'markup'
		| 'yes'
		| 'no'
		| 'exclusive'
		| 'friend'
		| 'dropping'
		| 'nontch'
		| 'emw'
		| 'accent';

	interface Props {
		tone?: Tone;
		class?: string;
		children?: Snippet;
		title?: string;
	}

	let { tone = 'neutral', class: klass = '', children, title }: Props = $props();

	const TONES: Record<Tone, string> = {
		neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
		inbound: 'bg-emerald-50 text-emerald-800 border-emerald-300',
		outbound: 'bg-sky-50 text-sky-800 border-sky-300',
		markup: 'bg-amber-50 text-amber-800 border-amber-300',
		yes: 'bg-emerald-50 text-emerald-700 border-emerald-300',
		no: 'bg-rose-50 text-rose-700 border-rose-300',
		exclusive: 'bg-indigo-50 text-indigo-800 border-indigo-300',
		friend: 'bg-neutral-100 text-neutral-700 border-neutral-300',
		dropping: 'bg-amber-50 text-amber-800 border-amber-300',
		nontch: 'bg-slate-50 text-slate-700 border-slate-300',
		emw: 'bg-violet-50 text-violet-800 border-violet-300',
		accent: 'bg-indigo-50 text-indigo-800 border-indigo-300'
	};
</script>

<span
	{title}
	class={cn(
		'inline-flex items-center px-1.5 h-5 text-[10.5px] font-medium uppercase tracking-wide border rounded-sm whitespace-nowrap',
		TONES[tone],
		klass
	)}
>
	{@render children?.()}
</span>
