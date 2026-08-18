'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type CreatorDashboard, type CreatorDocument, type CreatorInvoice } from '@/lib/api';
import { formatDoj, formatDocDate, inr } from '@/lib/utils';
import { EMPTY_FORM, relTone, statusTone, uploadCreatorDocument, parseCreatorLinks, serializeCreatorLinks } from '@/lib/creators';
import type { CreatorForm } from '@/types/creator';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import QueryErrorState from '@/components/QueryErrorState';
import CreatorFormModal from '@/components/CreatorFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useCreatorQuery, useUpdateCreatorMutation } from '../queries';
import { downloadAuthenticatedFile } from '@/lib/download';
import { useAuth } from '@/components/AuthGuard';
import { useFiscalYear } from '@/lib/fiscal-year';
import MetricCard from '@/components/MetricCard';
import { CreatorBrandChart, CreatorFinancialTrend, CreatorPaymentChart } from '@/components/CreatorDashboardCharts';

export default function CreatorDetailPage() {
	const { role } = useAuth();
	const isAccounts = role === 'accounts';
	const { fyStart } = useFiscalYear();
	const id = Number((useParams()?.id as string) || 0) || null;
	const creatorQuery = useCreatorQuery(id);
	const creator = creatorQuery.data;
	const updateMutation = useUpdateCreatorMutation();
	const [editConfirmOpen, setEditConfirmOpen] = React.useState(false);
	const [editOpen, setEditOpen] = React.useState(false);

	const invoicesQuery = useQuery<CreatorInvoice[]>({ queryKey: ['creator-invoices', { creator: id }], queryFn: () => api.get(`/creator-invoices/?creator=${id}`), enabled: id !== null });
	const documentsQuery = useQuery<CreatorDocument[]>({ queryKey: ['creator-documents', { creator: id }], queryFn: () => api.get(`/creator-documents/?creator=${id}`), enabled: id !== null && !isAccounts });
	const dashboardQuery = useQuery<CreatorDashboard>({ queryKey: ['creator-dashboard', id, fyStart], queryFn: () => api.get(`/creators/${id}/dashboard?fy=${fyStart}`), enabled: id !== null && fyStart !== null });

	const initial = React.useMemo<CreatorForm>(() => creator ? {
		name: creator.name, niche: creator.category, relation: creator.relationship,
		status: creator.status, doj: creator.doj ? new Date(creator.doj) : EMPTY_FORM.doj,
		url: parseCreatorLinks(creator.profile_url), location: creator.location,
		talent_manager: creator.ops_manager, attachments: []
	} : EMPTY_FORM, [creator]);

	async function save(form: CreatorForm) {
		if (!creator) return;
		try {
			await updateMutation.mutateAsync({
				id: creator.id, payload: {
					name: form.name, category: form.niche, relationship: form.relation,
					status: form.relation === 'Non-Exclusive' ? 'Active' : form.status,
					doj: form.relation === 'Non-Exclusive' || isNaN(form.doj.getTime()) ? null : form.doj.toISOString().slice(0, 10),
					profile_url: serializeCreatorLinks(form.url), location: form.location, ops_manager: form.talent_manager, version: creator.version
				}
			});
			for (const attachment of form.attachments) await uploadCreatorDocument(creator.id, attachment.doc_type, attachment.file, attachment.file.name);
			setEditOpen(false);
			toast.success('Creator updated.');
		} catch (error) { toast.error('Creator could not be updated.', { description: (error as Error).message }); }
	}

	if (creatorQuery.isLoading) return <div className="py-20 text-center text-[13px] text-[var(--n-fg-muted)]">Loading creator workspace…</div>;
	if (creatorQuery.error || !creator) return <QueryErrorState description="This creator workspace is temporarily unavailable." onRetry={() => creatorQuery.refetch()} />;

	const invoices = invoicesQuery.data ?? [];
	const documents = documentsQuery.data ?? [];
	const links = parseCreatorLinks(creator.profile_url);
	const dashboard = dashboardQuery.data;
	const campaigns = dashboard?.campaigns ?? [];
	return (
		<section className="space-y-6">
			<div className="text-[13px] text-[var(--n-fg-muted)]"><Link className="hover:underline" href="/creators">Creators</Link> <span className="mx-2">/</span> {creator.name}</div>
			<div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
				<div className="xl:col-span-2 min-w-0 space-y-6">
					<header className="flex flex-wrap items-center justify-between gap-4">
						<div><h1 className="text-[26px] font-bold">{creator.name}</h1><div className="mt-2 flex gap-2"><Tag tone={relTone(creator.relationship)}>{creator.relationship}</Tag><Tag tone={statusTone(creator.status)}>{creator.status}</Tag></div></div>
						{!isAccounts && <Button variant="primary" onClick={() => setEditConfirmOpen(true)}><Icon name="edit" size={14} className="mr-1" />Edit creator</Button>}
					</header>
					{dashboardQuery.isLoading && <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Loading creator metrics">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[74px] animate-pulse rounded border bg-gray-50" style={{ borderColor: 'var(--n-border)' }} />)}</div>}
					{dashboardQuery.error && <QueryErrorState description="Creator financial metrics are temporarily unavailable." onRetry={() => dashboardQuery.refetch()} />}
					{dashboard && <><div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
						<MetricCard label="Campaigns" value={dashboard.metrics.campaign_count} />
						<MetricCard label="Total billing" value={`₹${inr(dashboard.metrics.total_billing) || '0'}`} dotColor="#2563eb" />
						<MetricCard label="Creator fees" value={`₹${inr(dashboard.metrics.creator_fees) || '0'}`} dotColor="#d97706" />
						<MetricCard label="Agency margin" value={`₹${inr(dashboard.metrics.agency_margin) || '0'}`} dotColor="#0d9070" />
						<MetricCard label="Amount paid" value={`₹${inr(dashboard.metrics.amount_paid) || '0'}`} />
						<MetricCard label="Outstanding" value={`₹${inr(dashboard.metrics.outstanding) || '0'}`} valueColor={Number(dashboard.metrics.outstanding) > 0 ? '#b45309' : undefined} />
						<MetricCard label="Average deal" value={`₹${inr(dashboard.metrics.average_deal_value) || '0'}`} />
						<MetricCard label="Active campaigns" value={dashboard.metrics.active_campaigns} />
					</div><div className="grid grid-cols-1 xl:grid-cols-3 gap-5"><div className="xl:col-span-2"><CreatorFinancialTrend months={dashboard.months} /></div><CreatorPaymentChart rows={dashboard.payment_statuses} /></div></>}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						{[['Niche', creator.category || '—'], ['Talent manager', creator.ops_manager || '—'], ['Location', creator.location || '—'], ['Joined', formatDoj(creator.doj)]].map(([label, value]) => <div key={label} className="rounded-xl border p-4" style={{ borderColor: 'var(--n-border)' }}><div className="text-[12px] font-medium uppercase tracking-wide text-[var(--n-fg-muted)]">{label}</div><div className="mt-1.5 text-[14px] font-medium">{value}</div></div>)}
					</div>
					<div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--n-border)' }}>
						<div className="flex items-center justify-between"><div><h2 className="text-[19px] font-semibold">Links</h2><p className="mt-1.5 text-[13px] text-[var(--n-fg-muted)]">Creator profiles, portfolios, and social channels.</p></div><Tag tone="neutral">{links.length}</Tag></div>
						{links.length ? <div className="flex flex-wrap gap-2">{links.map((link, index) => {
							let label = `Link ${index + 1}`;
							try { label = new URL(link).hostname.replace(/^www\./, '') || label; } catch { /* retain the safe fallback */ }
							return <a key={`${link}-${index}`} href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium hover:bg-[var(--n-bg-hover)]" style={{ borderColor: 'var(--n-border)' }}><Icon name="external-link" size={13} />{label}</a>;
						})}</div> : <p className="text-[12px] text-[var(--n-fg-muted)]">{isAccounts ? 'No creator links are on file.' : 'No creator links added yet. Use Edit creator to add one.'}</p>}
					</div>
				</div>
				<div className="xl:col-span-1 min-w-0">
					<CreatorBrandChart rows={dashboard?.brands ?? []} />
				</div>
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
				<div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--n-border)' }}><div className="flex justify-between"><div><h2 className="text-[19px] font-semibold">Campaigns</h2><p className="mt-1.5 text-[12px] font-medium text-[var(--n-fg-muted)]">{dashboard?.fy ?? 'Selected fiscal year'}</p></div><Tag tone="neutral">{campaigns.length}</Tag></div>{dashboardQuery.isLoading ? <p className="text-[13px]">Loading campaigns…</p> : campaigns.length ? campaigns.map(campaign => isAccounts ? <div key={campaign.deal_id} className="block rounded-lg border p-3" style={{ borderColor: 'var(--n-border)' }}><div className="flex items-center justify-between gap-2"><div className="text-[14px] font-medium">{campaign.campaign}</div><Tag tone={campaign.payment_status === 'Paid' ? 'yes' : campaign.payment_status === 'Overdue' ? 'no' : 'markup'}>{campaign.payment_status === 'Not set' ? 'Awaiting update' : campaign.payment_status}</Tag></div><div className="mt-1.5 text-[12px] leading-relaxed text-[var(--n-fg-muted)]">{campaign.brand} · ₹{inr(campaign.billing)} · Creator fee ₹{inr(campaign.creator_fee)} · Margin ₹{inr(campaign.margin)}</div></div> : <Link key={campaign.deal_id} href={`/commercial/${campaign.deal_id}`} className="block rounded-lg border p-3 hover:bg-[var(--n-bg-hover)]" style={{ borderColor: 'var(--n-border)' }}><div className="text-[14px] font-medium">{campaign.campaign}</div><div className="mt-1.5 text-[12px] leading-relaxed text-[var(--n-fg-muted)]">{campaign.brand} · ₹{inr(campaign.billing)} · Margin ₹{inr(campaign.margin)}</div></Link>) : <p className="text-[13px] text-[var(--n-fg-muted)]">No campaigns assigned in this fiscal year.</p>}</div>
				<div className="space-y-5">
					<div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--n-border)' }}><div className="flex justify-between"><h2 className="text-[19px] font-semibold">Creator invoices</h2><Tag tone="neutral">{invoices.length}</Tag></div>{invoices.length ? invoices.map(invoice => <button type="button" key={invoice.id} onClick={() => void downloadAuthenticatedFile(invoice.file, invoice.label || 'creator-invoice')} className="block text-[13px] inline-link">{invoice.campaign_name || invoice.brand} · {formatDocDate(invoice.uploaded_at)} ↗</button>) : <p className="text-[13px] text-[var(--n-fg-muted)]">No invoices uploaded yet.</p>}</div>
					{!isAccounts && <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--n-border)' }}><div className="flex justify-between"><h2 className="text-[19px] font-semibold">Documents</h2><Tag tone="neutral">{documents.length}</Tag></div>{documents.length ? documents.map(document => <button type="button" key={document.id} onClick={() => void downloadAuthenticatedFile(document.file, document.label || 'creator-document')} className="block text-[13px] inline-link">{document.doc_type} · {formatDocDate(document.uploaded_at)} ↗</button>) : <p className="text-[13px] text-[var(--n-fg-muted)]">No documents on file.</p>}</div>}
				</div>
			</div>
			{!isAccounts && <ConfirmDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen} title="Edit this creator?" description="You are about to update this creator’s master profile and documents." confirmLabel="Continue to edit" onConfirm={() => { setEditConfirmOpen(false); setEditOpen(true); }} />}
			{!isAccounts && <CreatorFormModal open={editOpen} onOpenChange={setEditOpen} title="Edit Creator" submitLabel="Save changes" initial={initial} onSubmit={save} creatorId={creator.id} />}
		</section>
	);
}
