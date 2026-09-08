'use client';

import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import { CreatorPageHeader, PortalCard, PortalEmptyState } from '../components';
import { useCreatorWorkspace } from '../workspace';

export default function CreatorEnquiriesPage() {
	const { workspace } = useCreatorWorkspace();
	return <div className="space-y-6"><CreatorPageHeader title="Brand Enquiries" description="Requests sent through the contact form on your public media kit." actions={<Button variant="outline" disabled><Icon name="filter" size={13} />Filter</Button>} />
		{workspace.enquiries.length === 0 ? <PortalCard><PortalEmptyState icon="inbox" title="No brand enquiries yet" description="Once your media kit is published, brand requests will appear here with their brief, budget and contact details." /></PortalCard> : <PortalCard className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-[10px]"><thead className="border-b border-[var(--n-border)] bg-[var(--n-bg-soft)] text-[var(--n-fg-subtle)]"><tr><th className="px-4 py-3 font-medium">Brand</th><th className="px-4 py-3 font-medium">Contact</th><th className="px-4 py-3 font-medium">Budget</th><th className="px-4 py-3 font-medium">Received</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody>{workspace.enquiries.map((item) => <tr key={item.id} className="border-b border-[var(--n-border)] last:border-0"><td className="px-4 py-3 font-medium">{item.brand}</td><td className="px-4 py-3 text-[var(--n-fg-muted)]">{item.contactName}</td><td className="px-4 py-3">{item.budget}</td><td className="px-4 py-3 text-[var(--n-fg-subtle)]">{item.receivedAt}</td><td className="px-4 py-3"><Tag tone="neutral">{item.status}</Tag></td></tr>)}</tbody></table></div></PortalCard>}
	</div>;
}
