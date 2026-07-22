'use client';

import * as React from 'react';
import type { Deal } from '@/lib/api';
import type { CampaignGroup, CreatorGroup } from '@/types/deal';
import { relTone } from '@/lib/deals';
import { inr } from '@/lib/utils';
import Tag from '@/components/ui/Tag';
import Icon from '@/components/ui/Icon';

export function CampaignGroupCard({ group, onView }: { group: CampaignGroup; onView: (d: Deal) => void }) {
	const handleCardClick = () => {
		if (group.deals.length > 0) {
			onView(group.deals[0]);
		}
	};

	return (
		<div
			onClick={handleCardClick}
			className="rounded-xl p-4 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-[var(--n-accent)] group"
			style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div
						className="font-semibold text-[15px] truncate transition-colors group-hover:text-[var(--n-accent)]"
						title={group.name}
						style={{ color: 'var(--n-fg)' }}
					>
						{group.name}
					</div>
					{group.brand && group.brand !== group.name && (
						<div className="text-[13px] mt-0.5 truncate" style={{ color: 'var(--n-fg-muted)' }}>
							{group.brand}
						</div>
					)}
				</div>
				<div className="flex flex-col items-end gap-1 shrink-0">
					{group.status && <Tag tone={group.status === 'Over' ? 'neutral' : 'yes'}>{group.status}</Tag>}
				</div>
			</div>

			<div className="grid grid-cols-3 gap-3 pt-2 border-t" style={{ borderColor: 'var(--n-border)' }}>
				<div>
					<div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>
						Creators
					</div>
					<div className="text-[14px] font-semibold mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--n-fg)' }}>
						<Icon name="users" size={14} className="text-[var(--n-fg-subtle)]" />
						{group.creatorNames.length}
					</div>
				</div>
				<div>
					<div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>
						Direction
					</div>
					<div className="mt-0.5">
						{group.deals[0]?.direction ? (
							<Tag tone={group.deals[0].direction === 'Outbound' ? 'outbound' : 'inbound'}>
								{group.deals[0].direction}
							</Tag>
						) : (
							<span className="text-[13px] font-medium" style={{ color: 'var(--n-fg-muted)' }}>—</span>
						)}
					</div>
				</div>
				<div>
					<div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>
						Total Fee
					</div>
					<div className="text-[14px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--n-fg)' }}>
						₹{inr(group.total)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function CreatorGroupCard({ group, onView }: { group: CreatorGroup; onView: (d: Deal) => void }) {
	const handleCardClick = () => {
		if (group.deals.length > 0) {
			onView(group.deals[0]);
		}
	};

	return (
		<div
			onClick={handleCardClick}
			className="rounded-xl p-4 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-150 hover:shadow-md hover:border-[var(--n-accent)] group"
			style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div
						className="font-semibold text-[15px] truncate transition-colors group-hover:text-[var(--n-accent)]"
						style={{ color: 'var(--n-fg)' }}
					>
						{group.name}
					</div>
					<div className="text-[13px] mt-0.5" style={{ color: 'var(--n-fg-muted)' }}>
						{group.dealCount ?? group.deals.length} deal{(group.dealCount ?? group.deals.length) === 1 ? '' : 's'}
					</div>
				</div>
				{group.relationship && (
					<Tag tone={relTone(group.relationship)}>
						{group.relationship === 'NonTCH' ? 'Non TCH' : group.relationship}
					</Tag>
				)}
			</div>

			<div className="pt-2 border-t" style={{ borderColor: 'var(--n-border)' }}>
				<div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>
					Total Fee
				</div>
				<div className="text-[14px] font-bold tabular-nums mt-0.5" style={{ color: 'var(--n-fg)' }}>
					₹{inr(group.total)}
				</div>
			</div>
		</div>
	);
}
