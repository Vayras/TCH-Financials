import React from 'react';
import { type Deal } from '@/lib/api';
import { inr } from '@/lib/utils';
import { creatorNamesOf, getStatusDisplay } from '@/lib/deals';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import Tag from '@/components/ui/Tag';

interface CommercialTableProps {
	deals: Deal[];
	onEdit: (d: Deal) => void;
}

export function CommercialTable({ deals, onEdit }: CommercialTableProps) {
	return (
		<div className="anim-fade-up rounded-xl border overflow-hidden" style={{ borderColor: 'var(--n-border)', background: 'var(--n-bg)' }}>
			<table className="w-full border-collapse">
				<thead>
					<tr style={{ background: 'var(--n-bg-soft)', borderBottom: '1px solid var(--n-border)' }}>
						<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Campaign / Brand</th>
						<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Creators</th>
						<th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Total Fee</th>
						<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Date</th>
						<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Type</th>
						<th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Status</th>
						<th className="px-4 py-3" />
					</tr>
				</thead>
				<tbody>
					{deals.map((deal, idx) => {
						const cNames = creatorNamesOf(deal).join(', ') || '—';
						const label = Array.from(new Set([deal.brand, deal.campaign].filter(Boolean))).join(' · ') || '—';
						const isOut = deal.direction === 'Outbound';
						return (
							<tr
								key={deal.id}
								className="table-row border-b last:border-b-0 cursor-pointer transition-colors"
								style={{ borderColor: 'var(--n-border)', animationDelay: `${idx * 0.03}s` }}
								onClick={() => onEdit(deal)}
							>
								<td className="px-4 py-3.5 max-w-[280px]">
									<span className="text-[12px] font-semibold leading-tight block truncate" style={{ color: 'var(--n-fg)' }} title={label}>{label}</span>
								</td>
								<td className="px-4 py-3.5">
									<span className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }} title={cNames}>
										{cNames.length > 30 ? cNames.slice(0, 30) + '…' : cNames}
									</span>
								</td>
								<td className="px-4 py-3.5 text-right whitespace-nowrap">
									<span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--n-fg)' }}>₹{inr(deal.total_fee)}</span>
								</td>
								<td className="px-4 py-3.5 whitespace-nowrap">
									<span className="text-[12.5px] tabular-nums" style={{ color: 'var(--n-fg-subtle)' }}>
										{deal.confirmation_date || deal.e_invoice_date || '—'}
									</span>
								</td>
								<td className="px-4 py-3.5">
									<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${isOut ? 'dir-badge-out' : 'dir-badge-in'}`}>
										{deal.direction}
									</span>
								</td>
								<td className="px-4 py-3.5">
									<Tag tone={getStatusDisplay(deal.campaign_status, deal.completed_at !== null).tone}>
										{getStatusDisplay(deal.campaign_status, deal.completed_at !== null).label}
									</Tag>
								</td>
								<td className="px-4 py-3.5">
									<div className="flex items-center justify-end">
										<Button
											variant="outline"
											size="sm"
											onClick={(e) => { e.stopPropagation(); onEdit(deal); }}
											title="Open campaign workspace"
											aria-label="Open campaign workspace"
										>
											<Icon name="arrow-right" size={14} />
										</Button>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
