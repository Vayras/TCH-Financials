'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type CreatorDocument, type CreatorInvoice, type DealPage } from '@/lib/api';
import { formatDoj, formatDocDate, inr } from '@/lib/utils';
import { EMPTY_FORM, relTone, statusTone, uploadCreatorDocument } from '@/lib/creators';
import type { CreatorForm } from '@/types/creator';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import QueryErrorState from '@/components/QueryErrorState';
import CreatorFormModal from '@/components/CreatorFormModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useCreatorQuery, useUpdateCreatorMutation } from '../queries';

export default function CreatorDetailPage() {
	const id = Number((useParams()?.id as string) || 0) || null;
	const creatorQuery = useCreatorQuery(id);
	const creator = creatorQuery.data;
	const updateMutation = useUpdateCreatorMutation();
	const [editConfirmOpen, setEditConfirmOpen] = React.useState(false);
	const [editOpen, setEditOpen] = React.useState(false);

	const dealsQuery = useQuery<DealPage>({
		queryKey: ['creator-deals', id],
		queryFn: () => api.get<DealPage>(`/deals/?page=1&page_size=100&creator=${id}&sort_by=billing_period&sort_order=desc`),
		enabled: id !== null
	});
	const invoicesQuery = useQuery<CreatorInvoice[]>({ queryKey: ['creator-invoices', { creator: id }], queryFn: () => api.get(`/creator-invoices/?creator=${id}`), enabled: id !== null });
	const documentsQuery = useQuery<CreatorDocument[]>({ queryKey: ['creator-documents', { creator: id }], queryFn: () => api.get(`/creator-documents/?creator=${id}`), enabled: id !== null });

	const initial = React.useMemo<CreatorForm>(() => creator ? {
		name: creator.name, niche: creator.category, relation: creator.relationship,
		status: creator.status, doj: creator.doj ? new Date(creator.doj) : EMPTY_FORM.doj,
		url: creator.profile_url ? [creator.profile_url] : [], location: creator.location,
		talent_manager: creator.ops_manager, attachments: []
	} : EMPTY_FORM, [creator]);

	async function save(form: CreatorForm) {
		if (!creator) return;
		try {
			await updateMutation.mutateAsync({ id: creator.id, payload: {
				name: form.name, category: form.niche, relationship: form.relation,
				status: form.relation === 'Non-Exclusive' ? 'Active' : form.status,
				doj: form.relation === 'Non-Exclusive' || isNaN(form.doj.getTime()) ? null : form.doj.toISOString().slice(0, 10),
				profile_url: form.url[0] ?? '', location: form.location, ops_manager: form.talent_manager, version: creator.version
			} });
			for (const attachment of form.attachments) await uploadCreatorDocument(creator.id, attachment.doc_type, attachment.file, attachment.file.name);
			setEditOpen(false);
			toast.success('Creator updated.');
		} catch (error) { toast.error('Creator could not be updated.', { description: (error as Error).message }); }
	}

	if (creatorQuery.isLoading) return <div className="py-20 text-center text-[13px] text-[var(--n-fg-muted)]">Loading creator workspace…</div>;
	if (creatorQuery.error || !creator) return <QueryErrorState description="This creator workspace is temporarily unavailable." onRetry={() => creatorQuery.refetch()} />;

	const deals = dealsQuery.data?.items ?? [];
	const invoices = invoicesQuery.data ?? [];
	const documents = documentsQuery.data ?? [];
	return (
		<section className="space-y-6">
			<div className="text-[13px] text-[var(--n-fg-subtle)]"><Link className="hover:underline" href="/creators">Creators</Link> <span className="mx-2">/</span> {creator.name}</div>
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div><h1 className="text-[26px] font-bold">{creator.name}</h1><div className="mt-2 flex gap-2"><Tag tone={relTone(creator.relationship)}>{creator.relationship}</Tag><Tag tone={statusTone(creator.status)}>{creator.status}</Tag></div></div>
				<Button variant="primary" onClick={() => setEditConfirmOpen(true)}><Icon name="edit" size={14} className="mr-1" />Edit creator</Button>
			</header>
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{[['Niche', creator.category || '—'], ['Talent manager', creator.ops_manager || '—'], ['Location', creator.location || '—'], ['Joined', formatDoj(creator.doj)]].map(([label, value]) => <div key={label} className="rounded-xl border p-4" style={{ borderColor: 'var(--n-border)' }}><div className="text-[11px] uppercase text-[var(--n-fg-subtle)]">{label}</div><div className="mt-1 text-[14px] font-medium">{value}</div></div>)}
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
				<div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--n-border)' }}><div className="flex justify-between"><h2 className="font-semibold">Campaigns</h2><Tag tone="neutral">{dealsQuery.data?.total ?? deals.length}</Tag></div>{dealsQuery.isLoading ? <p className="text-[12px]">Loading campaigns…</p> : deals.length ? deals.map(deal => <Link key={deal.id} href={`/commercial/${deal.id}`} className="block rounded-lg border p-3 hover:bg-[var(--n-bg-hover)]" style={{ borderColor: 'var(--n-border)' }}><div className="text-[13px] font-medium">{deal.campaign || deal.brand}</div><div className="mt-1 text-[11px] text-[var(--n-fg-subtle)]">{deal.brand} · ₹{inr(deal.total_fee)}</div></Link>) : <p className="text-[12px] text-[var(--n-fg-muted)]">No campaigns assigned yet.</p>}</div>
				<div className="space-y-5">
					<div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--n-border)' }}><div className="flex justify-between"><h2 className="font-semibold">Creator invoices</h2><Tag tone="neutral">{invoices.length}</Tag></div>{invoices.length ? invoices.map(invoice => <a key={invoice.id} href={invoice.file} target="_blank" rel="noopener" className="block text-[12px] inline-link">{invoice.campaign_name || invoice.brand} · {formatDocDate(invoice.uploaded_at)} ↗</a>) : <p className="text-[12px] text-[var(--n-fg-muted)]">No invoices uploaded yet.</p>}</div>
					<div className="rounded-xl border p-5 space-y-3" style={{ borderColor: 'var(--n-border)' }}><div className="flex justify-between"><h2 className="font-semibold">Documents</h2><Tag tone="neutral">{documents.length}</Tag></div>{documents.length ? documents.map(document => <a key={document.id} href={document.file} target="_blank" rel="noopener" className="block text-[12px] inline-link">{document.doc_type} · {formatDocDate(document.uploaded_at)} ↗</a>) : <p className="text-[12px] text-[var(--n-fg-muted)]">No documents on file.</p>}</div>
				</div>
			</div>
			<ConfirmDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen} title="Edit this creator?" description="You are about to update this creator’s master profile and documents." confirmLabel="Continue to edit" onConfirm={() => { setEditConfirmOpen(false); setEditOpen(true); }} />
			<CreatorFormModal open={editOpen} onOpenChange={setEditOpen} title="Edit Creator" submitLabel="Save changes" initial={initial} onSubmit={save} creatorId={creator.id} />
		</section>
	);
}
