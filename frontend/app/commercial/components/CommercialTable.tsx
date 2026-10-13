import Link from 'next/link';
import React from 'react';
import { type Deal } from '@/lib/api';
import { inr } from '@/lib/utils';
import { creatorNamesOf, getStatusDisplay } from '@/lib/deals';
import Icon from '@/components/ui/Icon';
import styles from '../commercial.module.css';

export function CommercialTable({ deals, onEdit }: { deals: Deal[]; onEdit: (deal: Deal) => void }) {
	return <div className={styles.tableWrap}><table role="table" aria-label="Campaign deals">
		<thead><tr>{['Campaign / brand', 'Talent', 'Deliverables', 'Bookings', 'Client invoiced', 'Confirmed', 'Status', ''].map((title, index) => <th scope="col" key={index}>{title || <span className="sr-only">Open campaign</span>}</th>)}</tr></thead>
		<tbody>{deals.map(deal => {
			const names = creatorNamesOf(deal);
			const status = getStatusDisplay(deal.campaign_status, deal.completed_at !== null).label;
			const date = deal.confirmation_date;
			return <tr key={deal.id}>
				<td className={styles.campaignCell}><button type="button" onClick={() => onEdit(deal)}>{deal.campaign || 'Untitled campaign'}</button><small>{deal.brand || 'No brand assigned'} · {deal.direction}</small></td>
				<td className={styles.talentCell}><div className={styles.talent}><span className={styles.avatar} aria-hidden="true">{names[0]?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '—'}</span><span title={names.join(', ')}>{names[0] || 'Unassigned'}{names.length > 1 && <small>+{names.length - 1} more creators</small>}</span></div></td>
				<td data-label="Deliverables" className={styles.deliverables}>{deal.deliverables || 'Not specified'}</td>
				<td data-label="Bookings" className={styles.amount}>₹{inr(deal.total_fee) || '0'}</td>
				<td data-label="Client invoiced" className={styles.amount}>{deal.client_invoice_number && deal.client_invoice_amount !== '' ? `₹${inr(deal.client_invoice_amount) || '0'}` : '—'}</td>
				<td data-label="Confirmed" className={styles.date}>{date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
				<td className={styles.statusCell}><span className={styles.status} data-status={status}>{status}</span></td>
				<td className={styles.openCell}><div className={styles.rowActions}>{deal.campaign_id!=null&&<Link className={styles.briefLink} href={`/campaigns/${deal.campaign_id}/brief?deal=${deal.id}`} aria-label={`Open brief for ${deal.campaign}`}>Open brief</Link>}<button type="button" onClick={() => onEdit(deal)} aria-label={`View details for ${deal.campaign || 'campaign'}`}><span>Details</span><Icon name="arrow-right" size={14} /></button></div></td>
			</tr>;
		})}</tbody>
	</table></div>;
}
