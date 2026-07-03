'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import type { Deal } from '@/lib/api';
import type { CampaignGroup, CreatorGroup } from '@/types/deal';
import { billingPeriodOf, creatorLabel, creatorNamesOf, dirTone, monthYearLabel, relTone } from '@/lib/deals';
import { inr } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';

const cardSx = {
	bgcolor: 'var(--n-bg)',
	borderColor: 'var(--n-border)',
	borderRadius: 2,
	transition: 'border-color 150ms',
	'&:hover': { borderColor: 'var(--n-accent)' }
};

function ExpandButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
	return (
		<button
			type="button"
			aria-label={expanded ? 'Collapse deals' : 'Expand deals'}
			onClick={onClick}
			className="h-5 w-5 inline-flex items-center justify-center rounded-[3px] border border-[var(--n-border)] text-[var(--n-fg-muted)] hover:bg-[var(--n-accent)] hover:border-[var(--n-accent)] hover:text-white transition-colors"
		>
			<Icon name="chevron-right" size={13} className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'} />
		</button>
	);
}

function TotalFee({ total }: { total: number }) {
	return (
		<div className="text-[13px]">
			<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>Total Fee</div>
			<div className="font-semibold tabular-nums" style={{ color: 'var(--n-fg)' }}>{inr(total)}</div>
		</div>
	);
}

function DealRow({ r, headline, onView }: { r: Deal; headline: string; onView: (d: Deal) => void }) {
	return (
		<div className="flex items-center gap-2 text-[13px]">
			<div className="min-w-0 flex-1">
				<div className="font-medium truncate" style={{ color: 'var(--n-fg)' }}>{headline}</div>
				<div className="tabular-nums" style={{ color: 'var(--n-fg-muted)' }}>
					{inr(r.total_fee)} · {monthYearLabel(billingPeriodOf(r))}
				</div>
			</div>
			<Tag tone={dirTone(r.direction)}>{r.direction}</Tag>
			<Button variant="primary" onClick={() => onView(r)}>View</Button>
		</div>
	);
}

export function CampaignGroupCard({ group, onView }: { group: CampaignGroup; onView: (d: Deal) => void }) {
	const [expanded, setExpanded] = React.useState(false);
	return (
		<Card variant="outlined" sx={cardSx}>
			<CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="font-semibold text-[15px] truncate" title={group.name} style={{ color: 'var(--n-fg)' }}>{group.name}</div>
						{group.brand && group.brand !== group.name && (
							<div className="text-[13px] mt-0.5 truncate" style={{ color: 'var(--n-fg-muted)' }}>{group.brand}</div>
						)}
					</div>
					{group.status && <Tag tone={group.status === 'Over' ? 'neutral' : 'yes'}>{group.status}</Tag>}
				</div>
				<div>
					<div className="text-[11px] uppercase" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}>
						Creator{group.creatorNames.length === 1 ? '' : 's'}{group.creatorNames.length > 0 ? ` · ${group.creatorNames.length}` : ''}
					</div>
					<div className="text-[13px] mt-0.5" style={{ color: 'var(--n-fg)' }}>
						{group.creatorNames.length > 0 ? group.creatorNames.join(', ') : '—'}
					</div>
				</div>
				<TotalFee total={group.total} />
				<div className="flex items-center justify-between gap-2 pt-1">
					<div className="text-[12px]" style={{ color: 'var(--n-fg-muted)' }}>
						{group.deals.length} deal{group.deals.length === 1 ? '' : 's'}
					</div>
					<ExpandButton expanded={expanded} onClick={() => setExpanded((e) => !e)} />
				</div>
				<Collapse in={expanded} timeout="auto" unmountOnExit>
					<div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--n-border)' }}>
						{group.deals.map((r) => (
							<DealRow key={r.id} r={r} headline={creatorLabel(creatorNamesOf(r))} onView={onView} />
						))}
					</div>
				</Collapse>
			</CardContent>
		</Card>
	);
}

export function CreatorGroupCard({ group, onView }: { group: CreatorGroup; onView: (d: Deal) => void }) {
	const [expanded, setExpanded] = React.useState(false);
	return (
		<Card variant="outlined" sx={cardSx}>
			<CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
				<div className="flex items-start justify-between gap-2">
					<div>
						<div className="font-semibold text-[15px]" style={{ color: 'var(--n-fg)' }}>{group.name}</div>
						<div className="text-[13px] mt-0.5" style={{ color: 'var(--n-fg-muted)' }}>
							{group.deals.length} deal{group.deals.length === 1 ? '' : 's'}
						</div>
					</div>
					<div className="flex items-center gap-2">
						{group.relationship && (
							<Tag tone={relTone(group.relationship)}>
								{group.relationship === 'NonTCH' ? 'Non TCH' : group.relationship}
							</Tag>
						)}
						<ExpandButton expanded={expanded} onClick={() => setExpanded((e) => !e)} />
					</div>
				</div>
				<TotalFee total={group.total} />
				<Collapse in={expanded} timeout="auto" unmountOnExit>
					<div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--n-border)' }}>
						{group.deals.map((r) => (
							<DealRow
								key={r.id}
								r={r}
								headline={`${r.brand || '—'}${r.campaign ? ` · ${r.campaign}` : ''}`}
								onView={onView}
							/>
						))}
					</div>
				</Collapse>
			</CardContent>
		</Card>
	);
}
