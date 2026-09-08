'use client';

import * as React from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Icon from '@/components/ui/Icon';
import { CreatorPageHeader, FieldLabel, PortalCard, PortalEmptyState } from '../components';
import { compactNumber, type CreatorSocial, useCreatorWorkspace } from '../workspace';

const EMPTY_SOCIAL: Omit<CreatorSocial, 'id' | 'lastUpdated'> = { platform: 'Instagram', handle: '', profileUrl: '', followers: 0, engagementRate: 0, averageViews: 0 };

export default function CreatorSocialsPage() {
	const { workspace, updateWorkspace } = useCreatorWorkspace();
	const [open, setOpen] = React.useState(false);
	const [draft, setDraft] = React.useState(EMPTY_SOCIAL);

	function save() {
		if (!draft.handle.trim()) return;
		const social: CreatorSocial = { ...draft, id: crypto.randomUUID(), handle: draft.handle.startsWith('@') ? draft.handle : `@${draft.handle}`, lastUpdated: new Date().toISOString().slice(0, 10) };
		updateWorkspace((current) => ({ ...current, socials: [...current.socials, social] }));
		setDraft(EMPTY_SOCIAL);
		setOpen(false);
		toast.success('Social account added');
	}

	return (
		<div className="space-y-6">
			<CreatorPageHeader title="Social Accounts" description="Maintain the public statistics shown to brands on your media kit." actions={<Button variant="primary" onClick={() => setOpen(true)}><Icon name="plus" size={13} />Add account</Button>} />
			<div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-[10px] leading-5 text-blue-800"><strong className="font-semibold">Frontend preview:</strong> statistics are editable for now. Automated public-data collection and TCH verification will be introduced in the backend phase.</div>
			{workspace.socials.length === 0 ? <PortalCard><PortalEmptyState icon="at-sign" title="No social accounts" description="Add a public creator handle to start building your cross-platform profile." action={<Button variant="primary" onClick={() => setOpen(true)}>Add account</Button>} /></PortalCard> : (
				<div className="space-y-3">{workspace.socials.map((social) => <PortalCard key={social.id} className="grid grid-cols-[36px_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[36px_minmax(160px,1.4fr)_minmax(90px,.7fr)_minmax(90px,.7fr)_auto] sm:items-center">
					<div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--n-accent-soft)] text-[var(--n-accent)]"><Icon name={social.platform === 'Instagram' ? 'instagram' : social.platform === 'YouTube' ? 'youtube' : 'at-sign'} size={17} /></div>
					<div className="min-w-0"><p className="text-[11px] font-semibold">{social.handle}</p><p className="mt-0.5 truncate text-[9px] text-[var(--n-fg-subtle)]">{social.platform} · Updated {social.lastUpdated}</p></div>
					<div className="col-start-2 sm:col-start-auto"><p className="text-[11px] font-semibold tabular-nums">{compactNumber(social.followers)}</p><p className="text-[9px] text-[var(--n-fg-subtle)]">Followers</p></div>
					<div className="col-start-2 sm:col-start-auto"><p className="text-[11px] font-semibold tabular-nums">{social.engagementRate.toFixed(2)}%</p><p className="text-[9px] text-[var(--n-fg-subtle)]">Engagement</p></div>
					<Button variant="ghost" className="col-start-2 justify-self-start text-[var(--color-danger)] sm:col-start-auto" onClick={() => updateWorkspace((current) => ({ ...current, socials: current.socials.filter((item) => item.id !== social.id) }))}><Icon name="trash" size={13} />Remove</Button>
				</PortalCard>)}</div>
			)}
			<Dialog open={open} onOpenChange={setOpen} title="Add social account" description="Enter the public account details you want to display." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={save} disabled={!draft.handle.trim()}>Add account</Button></>}>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label><FieldLabel>Platform</FieldLabel><select value={draft.platform} onChange={(event) => setDraft({ ...draft, platform: event.target.value as CreatorSocial['platform'] })} className="h-8 w-full rounded border border-[var(--n-border)] bg-[var(--n-bg-soft)] px-2 text-[12px]"><option>Instagram</option><option>YouTube</option><option>TikTok</option><option>Other</option></select></label>
					<label><FieldLabel>Handle</FieldLabel><Input value={draft.handle} onChange={(event) => setDraft({ ...draft, handle: event.target.value })} placeholder="@creator" /></label>
					<label className="sm:col-span-2"><FieldLabel>Profile URL</FieldLabel><Input value={draft.profileUrl} onChange={(event) => setDraft({ ...draft, profileUrl: event.target.value })} placeholder="https://…" /></label>
					<label><FieldLabel>Followers</FieldLabel><Input type="number" min="0" value={draft.followers} onChange={(event) => setDraft({ ...draft, followers: Number(event.target.value) })} /></label>
					<label><FieldLabel>Engagement rate (%)</FieldLabel><Input type="number" min="0" step="0.01" value={draft.engagementRate} onChange={(event) => setDraft({ ...draft, engagementRate: Number(event.target.value) })} /></label>
					<label><FieldLabel>Average views</FieldLabel><Input type="number" min="0" value={draft.averageViews} onChange={(event) => setDraft({ ...draft, averageViews: Number(event.target.value) })} /></label>
				</div>
			</Dialog>
		</div>
	);
}
