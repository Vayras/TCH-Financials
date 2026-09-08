'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthGuard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Icon from '@/components/ui/Icon';
import { CreatorPageHeader, FieldLabel, PortalCard } from '../components';
import { compactNumber, useCreatorWorkspace } from '../workspace';

const SECTIONS = [
	['showAbout', 'About'],
	['showSocials', 'Social statistics'],
	['showPortfolio', 'Portfolio'],
	['showRates', 'Services and rates'],
	['showContact', 'Brand contact form'],
] as const;

export default function CreatorMediaKitPage() {
	const { displayName } = useAuth();
	const { workspace, updateWorkspace } = useCreatorWorkspace();
	const kit = workspace.mediaKit;
	const social = workspace.socials[0];

	function updateKit(patch: Partial<typeof kit>) {
		updateWorkspace((current) => ({ ...current, mediaKit: { ...current.mediaKit, ...patch } }));
	}

	function publish() {
		updateKit({ status: kit.status === 'Published' ? 'Draft' : 'Published' });
		toast.success(kit.status === 'Published' ? 'Media kit unpublished' : 'Media kit published', { description: kit.status === 'Published' ? 'The public link is no longer visible.' : `Your public slug is /k/${kit.slug}` });
	}

	return <div className="space-y-6">
		<CreatorPageHeader title="Media Kit" description="Choose what brands see and preview your public creator profile." actions={<><Button variant="outline" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/k/${kit.slug}`); toast.success('Public link copied'); }}><Icon name="copy" size={13} />Copy link</Button><Button variant="primary" onClick={publish}><Icon name={kit.status === 'Published' ? 'eye-off' : 'external-link'} size={13} />{kit.status === 'Published' ? 'Unpublish' : 'Publish kit'}</Button></>} />
		<div className="grid grid-cols-1 gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
			<div className="space-y-4">
				<PortalCard className="p-4"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold">Publication</p><p className="mt-1 text-[9px] text-[var(--n-fg-subtle)]">Who can view your kit</p></div><span className="rounded-full bg-[var(--n-accent-soft)] px-2 py-1 text-[9px] font-semibold text-[var(--n-accent)]">{kit.status}</span></div><label className="mt-4 block"><FieldLabel>Public URL slug</FieldLabel><div className="flex items-center rounded border border-[var(--n-border)] bg-[var(--n-bg-soft)] pl-2 text-[10px] text-[var(--n-fg-subtle)]"><span>/k/</span><Input value={kit.slug} onChange={(event) => updateKit({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="border-0 bg-transparent focus:border-0" /></div></label></PortalCard>
				<PortalCard className="p-4"><p className="text-[11px] font-semibold">Appearance</p><label className="mt-4 block"><FieldLabel>Accent colour</FieldLabel><div className="flex items-center gap-2"><input type="color" value={kit.accent} onChange={(event) => updateKit({ accent: event.target.value })} className="h-8 w-10 cursor-pointer rounded border border-[var(--n-border)] bg-white p-1" /><Input value={kit.accent} onChange={(event) => updateKit({ accent: event.target.value })} className="font-mono text-[10px]" /></div></label></PortalCard>
				<PortalCard className="overflow-hidden"><div className="border-b border-[var(--n-border)] px-4 py-3"><p className="text-[11px] font-semibold">Visible sections</p><p className="mt-1 text-[9px] text-[var(--n-fg-subtle)]">Keep your public profile focused.</p></div><div className="divide-y divide-[var(--n-border)]">{SECTIONS.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center justify-between px-4 py-3"><span className="text-[10px] text-[var(--n-fg-muted)]">{label}</span><input type="checkbox" checked={kit[key]} onChange={(event) => updateKit({ [key]: event.target.checked })} /></label>)}</div></PortalCard>
			</div>

			<div>
				<div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.08em] text-[var(--n-fg-subtle)]"><span>Live preview</span><span>Desktop</span></div>
				<div className="overflow-hidden rounded-xl border border-[var(--n-border)] bg-white shadow-[0_10px_35px_rgba(15,15,15,0.06)]">
					<div className="h-28" style={{ background: `linear-gradient(120deg, ${kit.accent}, ${kit.accent}80)` }} />
					<div className="px-6 pb-7">
						<div className="-mt-8 grid h-16 w-16 place-items-center rounded-full border-4 border-white text-[16px] font-semibold" style={{ background: `${kit.accent}18`, color: kit.accent }}>{(displayName || 'Creator').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
						<div className="mt-3"><h2 className="text-[18px] font-semibold tracking-[-0.02em]">{displayName || 'Creator'}</h2><p className="mt-1 text-[10px] text-[var(--n-fg-muted)]">{workspace.profile.headline}</p><p className="mt-1 flex items-center gap-1 text-[9px] text-[var(--n-fg-subtle)]"><Icon name="map-pin" size={11} />{workspace.profile.location}</p></div>
						{kit.showSocials && <div className="mt-5 grid grid-cols-3 gap-2">{social ? <><div className="rounded-lg bg-[var(--n-bg-soft)] p-3"><strong className="block text-[12px] font-semibold">{compactNumber(social.followers)}</strong><span className="text-[8px] text-[var(--n-fg-subtle)]">Followers</span></div><div className="rounded-lg bg-[var(--n-bg-soft)] p-3"><strong className="block text-[12px] font-semibold">{social.engagementRate.toFixed(2)}%</strong><span className="text-[8px] text-[var(--n-fg-subtle)]">Engagement</span></div><div className="rounded-lg bg-[var(--n-bg-soft)] p-3"><strong className="block text-[12px] font-semibold">{compactNumber(social.averageViews)}</strong><span className="text-[8px] text-[var(--n-fg-subtle)]">Average views</span></div></> : <p className="col-span-3 text-[10px] text-[var(--n-fg-subtle)]">No social statistics added.</p>}</div>}
						{kit.showAbout && <section className="mt-6 border-t border-[var(--n-border)] pt-5"><h3 className="text-[11px] font-semibold">About me</h3><p className="mt-2 max-w-2xl text-[10px] leading-5 text-[var(--n-fg-muted)]">{workspace.profile.bio || 'Add your biography from My Profile to introduce yourself to brands.'}</p></section>}
						{kit.showPortfolio && <section className="mt-6 border-t border-[var(--n-border)] pt-5"><div className="flex items-center justify-between"><h3 className="text-[11px] font-semibold">Featured partnerships</h3><span className="text-[9px] text-[var(--n-fg-subtle)]">{workspace.portfolio.filter((item) => item.featured).length} selected</span></div>{workspace.portfolio.length === 0 ? <div className="mt-3 rounded-lg bg-[var(--n-bg-soft)] px-4 py-6 text-center text-[9px] text-[var(--n-fg-subtle)]">Your featured portfolio will appear here.</div> : <div className="mt-3 grid grid-cols-2 gap-2">{workspace.portfolio.filter((item) => item.featured).slice(0, 4).map((item) => <div key={item.id} className="rounded-lg border border-[var(--n-border)] p-3"><p className="text-[8px] uppercase tracking-wide" style={{ color: kit.accent }}>{item.brand}</p><p className="mt-1 text-[10px] font-semibold">{item.title}</p><p className="mt-2 text-[8px] text-[var(--n-fg-subtle)]">{item.format} · {item.metric}</p></div>)}</div>}</section>}
						{kit.showContact && <div className="mt-6 rounded-lg px-4 py-4 text-center" style={{ background: `${kit.accent}10` }}><p className="text-[11px] font-semibold">Interested in working together?</p><button type="button" className="mt-3 rounded px-4 py-2 text-[9px] font-semibold text-white" style={{ background: kit.accent }}>Send brand enquiry</button></div>}
					</div>
				</div>
			</div>
		</div>
	</div>;
}
