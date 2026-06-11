'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, type Creator, type CreatorDocument, type Deal } from '@/lib/api';
import { inr } from '@/lib/utils';
import { downloadDocument } from '@/lib/files';
import Tag from '@/components/ui/Tag';
import Button from '@/components/ui/Button';
import { useFiscalYear } from '@/lib/fiscal-year';

function fyLabelFor(start: number): string {
	return `FY ${start % 100}-${(start + 1) % 100}`;
}

function relTone(rel: string) {
	if (rel === 'Exclusive') return 'exclusive' as const;
	if (rel === 'Dropping') return 'dropping' as const;
	if (rel === 'NonTCH') return 'nontch' as const;
	return 'friend' as const;
}

export default function CreatorDetailPage() {
	const params = useParams<{ id: string }>();
	const id = Number(params.id);
	const { fyStart } = useFiscalYear();
	const [creator, setCreator] = React.useState<Creator | null>(null);
	const [docs, setDocs] = React.useState<CreatorDocument[]>([]);
	const [deals, setDeals] = React.useState<Deal[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const [c, d, ds] = await Promise.all([
					api.get<Creator>(`/creators/${id}/`),
					api.get<CreatorDocument[]>(`/creator-documents/?creator=${id}`),
					api.get<Deal[]>(`/deals/?fy=${fyStart}`)
				]);
				if (cancelled) return;
				setCreator(c);
				setDocs(d);
				setDeals(
					ds.filter(
						(deal) =>
							deal.creator === id || deal.creator_shares.some((s) => s.creator === id)
					)
				);
			} catch (e) {
				if (!cancelled) setError((e as Error).message);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id, fyStart]);

	// The creator's slice of each deal: their share row when the deal is
	// split, the whole deal otherwise.
	const feeOf = React.useCallback(
		(deal: Deal): number => {
			const share = deal.creator_shares.find((s) => s.creator === id);
			return Number(share ? share.total_fee : deal.total_fee) || 0;
		},
		[id]
	);
	const billing = deals.reduce((n, d) => n + feeOf(d), 0);

	async function downloadDoc(d: CreatorDocument) {
		try {
			await downloadDocument(d);
		} catch (e) {
			alert((e as Error).message);
		}
	}

	if (loading) {
		return (
			<div className="text-[14px] py-8 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
				Loading…
			</div>
		);
	}
	if (error || !creator) {
		return (
			<div
				className="text-[14px] rounded p-3"
				style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
			>
				Error: {error ?? 'Creator not found.'}
			</div>
		);
	}

	const info: [string, React.ReactNode][] = [
		['Category / Niche', creator.category],
		['Source', creator.source],
		['Stage', creator.stage],
		['Location', creator.location],
		['Ops Manager', creator.ops_manager],
		['DOJ', creator.doj ?? creator.doj_note],
		[
			'Profile',
			creator.profile_url ? (
				<a className="inline-link" href={creator.profile_url} target="_blank" rel="noopener">
					link ↗
				</a>
			) : (
				''
			)
		],
		['Notes', creator.notes]
	];

	return (
		<section className="space-y-8">
			<header className="space-y-2">
				<div
					className="text-[12px] font-medium uppercase"
					style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}
				>
					<Link href="/creators" className="inline-link">
						Creators
					</Link>{' '}
					· {fyLabelFor(fyStart)}
				</div>
				<div className="flex items-center gap-3 flex-wrap">
					<h1 className="page-title text-[40px] leading-[1.15] font-bold" style={{ color: 'var(--n-fg)' }}>
						{creator.name}
					</h1>
					<Tag tone={relTone(creator.relationship)}>
						{creator.relationship === 'NonTCH' ? 'Non TCH' : creator.relationship}
					</Tag>
					<Tag tone={(creator.status ?? 'Active') === 'Active' ? 'yes' : 'no'}>
						{creator.status ?? 'Active'}
					</Tag>
				</div>
			</header>

			<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
				{[
					[`Deals · ${fyLabelFor(fyStart)}`, String(deals.length)],
					[`Billing · ${fyLabelFor(fyStart)}`, inr(String(billing)) || '—'],
					['Documents', String(docs.length)]
				].map(([label, value]) => (
					<div
						key={label}
						className="rounded p-3"
						style={{ border: '1px solid var(--n-border)', background: 'var(--n-bg)' }}
					>
						<div
							className="text-[11.5px] font-medium uppercase"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							{label}
						</div>
						<div className="text-[26px] font-bold tabular-nums mt-1" style={{ color: 'var(--n-fg)' }}>
							{value}
						</div>
					</div>
				))}
			</div>

			<div className="tbl-card">
				<div className="scroll-x">
					<table className="grid-table">
						<tbody>
							{info
								.filter(([, v]) => v)
								.map(([label, value]) => (
									<tr key={label}>
										<td className="w-[200px] font-medium" style={{ color: 'var(--n-fg-muted)' }}>
											{label}
										</td>
										<td style={{ color: 'var(--n-fg)' }}>{value}</td>
									</tr>
								))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="space-y-2">
				<h2 className="text-[18px] font-semibold" style={{ color: 'var(--n-fg)' }}>
					Deals · {fyLabelFor(fyStart)}
				</h2>
				<div className="tbl-card">
					<div className="scroll-x">
						<table className="grid-table">
							<thead>
								<tr>
									<th>Campaign</th>
									<th>Brand</th>
									<th>Confirmed</th>
									<th>E-Invoice #</th>
									<th className="num">Fee</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{deals.map((d) => (
									<tr key={d.id}>
										<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
											{d.campaign}
										</td>
										<td style={{ color: 'var(--n-fg-muted)' }}>{d.brand}</td>
										<td className="whitespace-nowrap" style={{ color: 'var(--n-fg-muted)' }}>
											{d.confirmation_date}
										</td>
										<td style={{ color: 'var(--n-fg-muted)' }}>{d.e_invoice_number || '—'}</td>
										<td className="num" style={{ color: 'var(--n-fg)' }}>
											{inr(String(feeOf(d)))}
										</td>
										<td>
											{d.campaign_status && (
												<Tag tone={d.campaign_status === 'Active' ? 'yes' : 'neutral'}>
													{d.campaign_status}
												</Tag>
											)}
										</td>
									</tr>
								))}
								{deals.length === 0 && (
									<tr>
										<td colSpan={6} className="text-center py-8" style={{ color: 'var(--n-fg-subtle)' }}>
											No deals in {fyLabelFor(fyStart)}.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div className="space-y-2">
				<h2 className="text-[18px] font-semibold" style={{ color: 'var(--n-fg)' }}>
					Documents
				</h2>
				<div className="tbl-card">
					<div className="scroll-x">
						<table className="grid-table">
							<thead>
								<tr>
									<th>Type</th>
									<th>Label</th>
									<th>Uploaded</th>
									<th className="w-[120px]">Actions</th>
								</tr>
							</thead>
							<tbody>
								{docs.map((d) => (
									<tr key={d.id}>
										<td className="font-medium" style={{ color: 'var(--n-fg)' }}>
											{d.doc_type}
										</td>
										<td style={{ color: 'var(--n-fg-muted)' }}>{d.label}</td>
										<td className="whitespace-nowrap" style={{ color: 'var(--n-fg-muted)' }}>
											{new Date(d.uploaded_at).toLocaleDateString('en-IN', {
												day: '2-digit',
												month: 'short',
												year: '2-digit'
											})}
										</td>
										<td>
											<Button variant="ghost" onClick={() => downloadDoc(d)}>
												Download
											</Button>
										</td>
									</tr>
								))}
								{docs.length === 0 && (
									<tr>
										<td colSpan={4} className="text-center py-8" style={{ color: 'var(--n-fg-subtle)' }}>
											No documents uploaded.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>
	);
}
