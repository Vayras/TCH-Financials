'use client';

import * as React from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Icon from '@/components/ui/Icon';
import { CreatorPageHeader, FieldLabel, PortalCard, PortalEmptyState } from '../components';
import { type PortfolioItem, useCreatorWorkspace } from '../workspace';

const EMPTY_ITEM: Omit<PortfolioItem, 'id'> = { brand: '', title: '', format: 'Instagram Reel', metric: '', contentUrl: '', featured: true };

export default function CreatorPortfolioPage() {
	const { workspace, updateWorkspace } = useCreatorWorkspace();
	const [open, setOpen] = React.useState(false);
	const [draft, setDraft] = React.useState(EMPTY_ITEM);

	function addItem() {
		if (!draft.brand.trim() || !draft.title.trim()) return;
		updateWorkspace((current) => ({ ...current, portfolio: [...current.portfolio, { ...draft, id: crypto.randomUUID() }] }));
		setDraft(EMPTY_ITEM);
		setOpen(false);
		toast.success('Portfolio item added');
	}

	return <div className="space-y-6">
		<CreatorPageHeader title="Portfolio" description="Showcase your strongest brand collaborations and creator work." actions={<Button variant="primary" onClick={() => setOpen(true)}><Icon name="plus" size={13} />Add work</Button>} />
		{workspace.portfolio.length === 0 ? <PortalCard><PortalEmptyState icon="images" title="Build your creator portfolio" description="Add brand campaigns, featured content and results. Existing TCH campaigns can be connected in the backend phase." action={<Button variant="primary" onClick={() => setOpen(true)}>Add first project</Button>} /></PortalCard> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{workspace.portfolio.map((item) => <article key={item.id} className="group overflow-hidden rounded-xl border border-[var(--n-border)] bg-white">
		<div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-[var(--n-accent-soft)] to-[var(--n-bg-soft)] text-[var(--n-accent)]"><Icon name="play" size={20} /></div>
		<div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--n-accent)]">{item.brand}</p><h2 className="mt-1 truncate text-[12px] font-semibold">{item.title}</h2></div>{item.featured && <span className="rounded-full bg-[var(--n-accent-soft)] px-2 py-1 text-[8px] font-semibold text-[var(--n-accent)]">Featured</span>}</div><div className="mt-3 flex items-center justify-between text-[9px] text-[var(--n-fg-subtle)]"><span>{item.format}</span><span>{item.metric || 'No metric added'}</span></div><div className="mt-3 flex justify-end border-t border-[var(--n-border)] pt-2"><Button variant="ghost" onClick={() => updateWorkspace((current) => ({ ...current, portfolio: current.portfolio.filter((entry) => entry.id !== item.id) }))}><Icon name="trash" size={12} />Remove</Button></div></div>
		</article>)}</div>}
		<Dialog open={open} onOpenChange={setOpen} title="Add portfolio work" description="Add a campaign or piece of content brands should notice." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={addItem} disabled={!draft.brand.trim() || !draft.title.trim()}>Add to portfolio</Button></>}>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><FieldLabel>Brand</FieldLabel><Input value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })} placeholder="Brand name" /></label><label><FieldLabel>Campaign title</FieldLabel><Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Campaign name" /></label><label><FieldLabel>Content format</FieldLabel><Input value={draft.format} onChange={(event) => setDraft({ ...draft, format: event.target.value })} /></label><label><FieldLabel>Result</FieldLabel><Input value={draft.metric} onChange={(event) => setDraft({ ...draft, metric: event.target.value })} placeholder="108K views" /></label><label className="sm:col-span-2"><FieldLabel>Content URL</FieldLabel><Input value={draft.contentUrl} onChange={(event) => setDraft({ ...draft, contentUrl: event.target.value })} placeholder="https://…" /></label><label className="sm:col-span-2 flex items-center gap-2 text-[11px] text-[var(--n-fg-muted)]"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} />Feature this on my media kit</label></div>
		</Dialog>
	</div>;
}
