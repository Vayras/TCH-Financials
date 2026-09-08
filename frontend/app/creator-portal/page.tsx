'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { CreatorPageHeader, PortalCard, PortalStat } from './components';
import { useCreatorWorkspace } from './workspace';
import { useCreatorPortalDealsQuery } from './queries';

export default function CreatorOverviewPage() {
	const { workspace } = useCreatorWorkspace();
	const { data: deals = [] } = useCreatorPortalDealsQuery();
	const completed = [workspace.profile.headline, workspace.profile.bio, workspace.profile.category, workspace.profile.location, workspace.profile.languages, workspace.socials.length > 0, workspace.portfolio.length > 0].filter(Boolean).length;
	const completion = Math.round((completed / 7) * 100);
	const nextSteps = [
		!workspace.profile.bio && { label: 'Write your creator biography', href: '/creator-portal/profile', section: 'Profile' },
		workspace.socials.length === 0 && { label: 'Add your first social account', href: '/creator-portal/socials', section: 'Socials' },
		workspace.portfolio.length === 0 && { label: 'Feature your best brand work', href: '/creator-portal/portfolio', section: 'Portfolio' },
		workspace.mediaKit.status === 'Draft' && { label: 'Preview and publish your media kit', href: '/creator-portal/media-kit', section: 'Media Kit' },
	].filter(Boolean) as { label: string; href: string; section: string }[];

	return (
		<div className="space-y-6">
			<CreatorPageHeader title="Overview" description="Your creator profile, business and financial activity at a glance." actions={<Button variant="primary" onClick={() => window.location.assign('/creator-portal/profile')}>Complete profile</Button>} />
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<PortalStat label="Profile completion" value={`${completion}%`} detail={completion === 100 ? 'Your profile is complete' : 'Complete your public profile'} icon="user" />
				<PortalStat label="Media kit" value={workspace.mediaKit.status} detail={workspace.mediaKit.status === 'Published' ? `/k/${workspace.mediaKit.slug}` : 'Not visible to brands yet'} icon="layout" />
				<PortalStat label="Brand enquiries" value={workspace.enquiries.length} detail="Received through your media kit" icon="inbox" />
				<PortalStat label="Active deals" value={deals.filter((deal) => deal.campaign_status !== 'Over').length} detail="Campaigns assigned by TCH" icon="briefcase" />
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
				<PortalCard className="overflow-hidden">
					<div className="flex items-center justify-between border-b border-[var(--n-border)] px-4 py-3"><div><h2 className="text-[12px] font-semibold">Next steps</h2><p className="mt-0.5 text-[10px] text-[var(--n-fg-subtle)]">Finish these to make your profile brand-ready.</p></div><span className="text-[10px] text-[var(--n-fg-subtle)]">{nextSteps.length} remaining</span></div>
					<div className="divide-y divide-[var(--n-border)]">{nextSteps.length === 0 ? <div className="px-4 py-8 text-center text-[11px] text-[var(--n-fg-muted)]">Everything is ready. Your profile looks great.</div> : nextSteps.map((step) => <Link key={step.href} href={step.href} className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-[var(--n-bg-soft)]"><div className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full border border-[var(--n-border-strong)] text-[var(--n-fg-subtle)]"><Icon name="check" size={12} /></span><span className="text-[11px] font-medium">{step.label}</span></div><div className="flex items-center gap-2 text-[10px] text-[var(--n-fg-subtle)]"><span>{step.section}</span><Icon name="chevron-right" size={13} /></div></Link>)}</div>
				</PortalCard>
				<PortalCard className="p-4">
					<div className="flex items-start justify-between"><div><h2 className="text-[12px] font-semibold">Public media kit</h2><p className="mt-1 text-[10px] text-[var(--n-fg-subtle)]">Control the profile brands can view.</p></div><span className="rounded-full bg-[var(--n-accent-soft)] px-2 py-1 text-[9px] font-semibold text-[var(--n-accent)]">{workspace.mediaKit.status}</span></div>
					<div className="mt-5 rounded-lg bg-[var(--n-bg-soft)] p-3"><p className="text-[9px] uppercase tracking-[0.08em] text-[var(--n-fg-subtle)]">Public URL</p><p className="mt-1 truncate text-[11px] font-medium">tch.co/k/{workspace.mediaKit.slug}</p></div>
					<Link href="/creator-portal/media-kit" className="mt-4 flex items-center justify-between text-[10px] font-medium text-[var(--n-accent)]">Open media-kit builder <Icon name="arrow-right" size={13} /></Link>
				</PortalCard>
			</div>
		</div>
	);
}
