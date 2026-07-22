'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray, type Path, type RegisterOptions, type FieldErrors } from 'react-hook-form';
import { ConflictError, type Deal, type Creator } from '@/lib/api';
import { useFiscalYear } from '@/lib/fiscal-year';
import {
	buildShare,
	creatorNamesOf,
	EMPTY_DEAL_FORM,
	normalisePctString,
	DIRECTION,
	MONTH_NAMES
} from '@/lib/deals';
import { EMPTY_SHARE, type DealForm, type ShareForm } from '@/types/deal';
import { inr } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Tag from '@/components/ui/Tag';
import Link from 'next/link';
import CreatorInvoiceControls, { InvoiceReadinessSummary } from './CreatorInvoiceControls';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import {
	useCommercialDealQuery,
	useCommercialCreatorsQuery,
	useCommercialCampaignsQuery,
	useCommercialDocsQuery,
	useSaveDealMutation,
	useDeleteDealMutation
} from '../queries';

type FormValues = DealForm & {
	shares: ShareForm[];
	client_invoice_file: FileList | null;
};

function monthYearLabel(iso: string): string {
	const [y, m] = iso.split('-');
	return `${MONTH_NAMES[Number(m)] ?? m} ${y}`;
}

function countErrors(errs: FieldErrors<FormValues>): number {
	let n = 0;
	const walk = (node: unknown) => {
		if (!node || typeof node !== 'object') return;
		if ('message' in (node as object) && 'type' in (node as object)) { n += 1; return; }
		for (const v of Object.values(node as object)) walk(v);
	};
	walk(errs);
	return n;
}

export default function CampaignDetailPage() {
	const router = useRouter();
	const params = useParams();
	const idStr = params?.id as string;
	const id = idStr ? Number(idStr) : null;

	const { fyStart } = useFiscalYear();
	const { data: deal = null, isLoading: dealsLoading } = useCommercialDealQuery(id);
	const { data: creators = [], isLoading: creatorsLoading } = useCommercialCreatorsQuery();
	const { data: campaigns = [], isLoading: campaignsLoading } = useCommercialCampaignsQuery();
	const { data: docs = [], isLoading: docsLoading } = useCommercialDocsQuery(id);

	const saveDealMutation = useSaveDealMutation(fyStart);
	const deleteDealMutation = useDeleteDealMutation(fyStart);

	const initialForm = React.useMemo<DealForm>(() => {
		if (!deal) {
			return { ...EMPTY_DEAL_FORM, confirmation_date: new Date().toISOString().slice(0, 10) };
		}
		const primary = deal.creator_shares?.[0];
		return {
			confirmation_date: deal.confirmation_date ?? '',
			e_invoice_number: deal.e_invoice_number ?? '',
			e_invoice_date: deal.e_invoice_date ?? '',
			creator: primary
				? primary.creator
					? String(primary.creator)
					: ''
				: deal.creator
					? String(deal.creator)
					: '',
			tch_poc: deal.tch_poc ?? '',
			direction: deal.direction,
			total_fee: primary ? primary.total_fee : deal.total_fee,
			agency_fee_pct: primary ? primary.agency_fee_pct : deal.agency_fee_pct,
			agency_fee_inr: primary ? primary.agency_fee_inr : deal.agency_fee_inr,
			creator_fee: primary ? primary.creator_fee : deal.creator_fee,
			billing_entity: deal.billing_entity,
			brand: deal.brand,
			brand_poc: deal.brand_poc ?? '',
			campaign: deal.campaign ?? '',
			deliverables: deal.deliverables,
			ro_number: deal.ro_number,
			comments: deal.comments
		};
	}, [deal]);

	const initialShares = React.useMemo<ShareForm[]>(
		() =>
			(deal?.creator_shares ?? []).slice(1).map((s) => ({
				creator: s.creator ? String(s.creator) : '',
				total_fee: s.total_fee,
				agency_fee_pct: s.agency_fee_pct,
				creator_fee: s.creator_fee,
				ro_number: s.ro_number || ''
			})),
		[deal]
	);

	const {
		register,
		control,
		handleSubmit,
		reset,
		watch,
		getValues,
		setValue,
		formState: { errors, isSubmitting, dirtyFields },
	} = useForm<FormValues>({ defaultValues: { ...initialForm, shares: initialShares } });

	const shares = useFieldArray({ control, name: 'shares' });
	const [summaryError, setSummaryError] = React.useState<string | null>(null);
	const [isEditing, setIsEditing] = React.useState(false);
	const [confirmEditOpen, setConfirmEditOpen] = React.useState(false);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

	React.useEffect(() => {
		if (deal) {
			reset({ ...initialForm, shares: initialShares, client_invoice_file: null });
		}
	}, [deal, initialForm, initialShares, reset]);

	const reg = (name: Path<FormValues>, options?: RegisterOptions<FormValues, Path<FormValues>>) =>
		register(name, options);

	const feeBasis = React.useRef<'pct' | 'inr'>('pct');
	const recomputeFees = () => {
		const total = Number(getValues('total_fee'));
		if (!Number.isFinite(total) || total <= 0) return;
		if (feeBasis.current === 'inr') {
			const a = Number(getValues('agency_fee_inr'));
			if (!Number.isFinite(a) || a <= 0) return;
			setValue('agency_fee_pct', (a / total).toFixed(4));
			setValue('creator_fee', (total - a).toFixed(2));
			return;
		}
		const p = Number(getValues('agency_fee_pct'));
		if (!Number.isFinite(p) || p <= 0) return;
		const pct = p < 1 ? p : p / 100;
		const a = total * pct;
		setValue('agency_fee_inr', a.toFixed(2));
		setValue('creator_fee', (total - a).toFixed(2));
	};

	const required = { required: 'Required' } as const;
	const creatorOptions = creators.map((c) => ({ value: String(c.id), label: `${c.name} · ${c.relationship}` }));

	const [
		watchCreator, watchBrand, watchEInvDate, watchConfDate, watchCampaign, watchTotalFee, watchShares,
	] = watch(['creator', 'brand', 'e_invoice_date', 'confirmation_date', 'campaign', 'total_fee', 'shares']);

	const suggestedCampaignName = React.useMemo(() => {
		const creatorName = creators.find((c) => String(c.id) === watchCreator)?.name || '';
		const date = watchEInvDate || watchConfDate;
		const parts = [watchBrand?.trim(), creatorName, date ? monthYearLabel(date) : ''].filter(Boolean);
		return parts.join(' · ');
	}, [creators, watchCreator, watchBrand, watchEInvDate, watchConfDate]);

	const splitTotal =
		(watchShares?.length ?? 0) > 0
			? (Number(watchTotalFee) || 0) + watchShares.reduce((n: number, s: any) => n + (Number(s.total_fee) || 0), 0)
			: 0;

	async function submit(values: FormValues) {
		setSummaryError(null);
		const clientInvoiceFile = values.client_invoice_file?.[0] ?? null;

		const payload: Record<string, any> = {};
		const simpleFields: (keyof DealForm)[] = [
			'confirmation_date', 'e_invoice_number', 'e_invoice_date', 'creator', 'tch_poc',
			'direction', 'total_fee', 'agency_fee_pct', 'agency_fee_inr', 'creator_fee',
			'billing_entity', 'brand', 'brand_poc', 'campaign', 'deliverables', 'ro_number', 'comments'
		];

		for (const f of simpleFields) {
			if (dirtyFields[f]) {
				if (f === 'creator') {
					payload.creator = values.creator ? Number(values.creator) : null;
				} else if (f === 'confirmation_date' || f === 'e_invoice_date') {
					payload[f] = values[f] || null;
				} else if (f === 'agency_fee_pct') {
					payload.agency_fee_pct = normalisePctString(values.agency_fee_pct);
				} else {
					payload[f] = values[f];
				}
			}
		}

		// Always force split updates if splits (shares) or relevant fees were changed
		if (dirtyFields.shares || dirtyFields.creator || dirtyFields.total_fee || dirtyFields.agency_fee_pct || dirtyFields.creator_fee || dirtyFields.ro_number) {
			const hasSplit = values.shares.length > 0;
			const finalShareRows = hasSplit
				? [
					buildShare(values.creator, values.total_fee, values.agency_fee_pct, values.creator_fee, values.ro_number),
					...values.shares.map((s: any) => buildShare(s.creator, s.total_fee, s.agency_fee_pct, s.creator_fee, s.ro_number))
				]
				: [];
			const sum = (k: 'total_fee' | 'agency_fee_inr' | 'creator_fee') =>
				finalShareRows.reduce((n: number, s: any) => n + (Number(s[k]) || 0), 0).toFixed(2);

			payload.creator_shares = finalShareRows;
			payload.total_fee = hasSplit ? sum('total_fee') : values.total_fee || '0';
			payload.agency_fee_inr = hasSplit ? sum('agency_fee_inr') : values.agency_fee_inr || '0';
			payload.creator_fee = hasSplit ? sum('creator_fee') : values.creator_fee || '0';
		}

		// If no fields changed but file uploads exist, we still want to save
		if (Object.keys(payload).length === 0 && !clientInvoiceFile) {
			router.push('/commercial');
			return;
		}

		try {
			await saveDealMutation.mutateAsync({
				editingId: deal?.id,
				editingVersion: deal?.version,
				payload,
				clientInvoiceFile,
				creatorInvoiceFile: null
			});
			toast.success('Campaign changes saved.');
			router.push('/commercial');
		} catch (e) {
			toast.error('Campaign changes could not be saved.', { description: (e as Error).message });
		}
	}

	async function remove() {
		if (!deal) return;
		try {
			await deleteDealMutation.mutateAsync(deal.id);
			setConfirmDeleteOpen(false);
			toast.success('Campaign deleted.');
			router.push('/commercial');
		} catch (e) {
			toast.error('Campaign could not be deleted.', { description: (e as Error).message });
		}
	}

	const selectedCreatorIds = React.useMemo(() => {
		return [watchCreator, ...(watchShares || []).map((s: any) => s.creator)].filter(Boolean);
	}, [watchCreator, watchShares]);

	const hasDuplicateCreator = React.useMemo(() => {
		return selectedCreatorIds.length !== new Set(selectedCreatorIds).size;
	}, [selectedCreatorIds]);

	if (dealsLoading || creatorsLoading || campaignsLoading || docsLoading) {
		return <div className="p-8 text-center text-[14px]">Loading campaign workspace...</div>;
	}

	if (!deal) {
		return (
			<div className="p-8 text-center">
				<p className="text-[14px] text-red-600 mb-4">Campaign not found.</p>
				<Button variant="outline" onClick={() => router.push('/commercial')}>Back to Campaigns</Button>
			</div>
		);
	}

	const campaignTitle = [deal.brand, deal.campaign].filter(Boolean).join(' · ') || 'Campaign';

	return (
		<div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
			<style dangerouslySetInnerHTML={{ __html: `
				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(8px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
			`}} />
			{/* Breadcrumbs */}
			<div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
				<Link href="/commercial" className="hover:underline">Campaign Tracking</Link>
				<Icon name="chevron-right" size={12} />
				<span className="font-medium text-[var(--n-fg)]">{campaignTitle}</span>
			</div>

			<header className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-[26px] font-bold tracking-tight text-[var(--n-fg)]">
						{campaignTitle}
					</h1>
					<p className="text-[13px]" style={{ color: 'var(--n-fg-subtle)' }}>
						Workspace for tracking creator payouts and billing details.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{!isEditing ? (
						<Button variant="primary" onClick={() => setConfirmEditOpen(true)}>
							<Icon name="edit" size={14} className="mr-1" /> Edit Campaign
						</Button>
					) : (
						<>
							<Button variant="outline" onClick={() => { setIsEditing(false); reset({ ...initialForm, shares: initialShares }); }}>
								Cancel Edit
							</Button>
							<Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
								<Icon name="trash" size={14} className="mr-1" /> Delete
							</Button>
						</>
					)}
				</div>
			</header>

			{summaryError && (
				<div
					className="text-[13px] rounded-md p-3 flex gap-2 items-start"
					style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
				>
					<Icon name="alert-circle" size={14} className="mt-0.5 shrink-0" />
					{summaryError}
				</div>
			)}
			<form onSubmit={handleSubmit(submit)} className="flex flex-col gap-6">
				<fieldset disabled={!isEditing} className="contents group-disabled:pointer-events-none">
					{/* Details Card */}
					{!isEditing ? (
						<div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
							<div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--n-border)' }}>
								<div>
									<h2 className="text-[16px] font-semibold text-[var(--n-fg)]">Campaign Overview</h2>
									<p className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
										General campaign attributes and invoice parameters.
									</p>
								</div>
								{watch('direction') && (
									<Tag tone={watch('direction') === 'Outbound' ? 'outbound' : 'inbound'}>
										{watch('direction')}
									</Tag>
								)}
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[13px]">
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Brand</span>
									<span className="font-semibold text-[14px] mt-0.5 block" style={{ color: 'var(--n-fg)' }}>{watchBrand || '—'}</span>
								</div>
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Campaign</span>
									<span className="font-medium mt-0.5 block" style={{ color: 'var(--n-fg)' }}>{watchCampaign || '—'}</span>
								</div>
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Confirmation Date</span>
									<span className="tabular-nums mt-0.5 block" style={{ color: 'var(--n-fg-muted)' }}>{watchConfDate || '—'}</span>
								</div>
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>E-Invoice #</span>
									<span className="tabular-nums font-mono text-[12.5px] mt-0.5 block" style={{ color: 'var(--n-fg-muted)' }}>{watch('e_invoice_number') || '—'}</span>
								</div>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t text-[13px]" style={{ borderColor: 'var(--n-border)' }}>
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>TCH POC</span>
									<span className="font-medium mt-0.5 block" style={{ color: 'var(--n-fg)' }}>{watch('tch_poc') || '—'}</span>
								</div>
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Brand POC</span>
									<span className="font-medium mt-0.5 block truncate" style={{ color: 'var(--n-fg)' }} title={watch('brand_poc')}>{watch('brand_poc') || '—'}</span>
								</div>
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Deliverables</span>
									<span className="font-medium mt-0.5 block" style={{ color: 'var(--n-fg)' }}>{watch('deliverables') || '—'}</span>
								</div>
								<div>
									<span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>RO Number</span>
									<span className="font-medium mt-0.5 block" style={{ color: 'var(--n-fg)' }}>{watch('ro_number') || '—'}</span>
								</div>
							</div>

							{watch('comments') && (
								<div className="pt-3 border-t text-[12.5px]" style={{ borderColor: 'var(--n-border)' }}>
									<span className="block text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--n-fg-subtle)' }}>Comments</span>
									<p style={{ color: 'var(--n-fg-muted)' }}>{watch('comments')}</p>
								</div>
							)}
						</div>
					) : (
						<div className="rounded-xl border p-5 transition-all" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-3">
									<div>
										<Label>Confirmation Date *</Label>
										<Input type="date" {...reg('confirmation_date', required)} />
										{errors.confirmation_date && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
									</div>
									<div>
										<Label>Direction *</Label>
										<Select {...reg('direction', required)} options={DIRECTION} />
										{errors.direction && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
									</div>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<Label>E-Invoice Number *</Label>
										<Input placeholder="e.g. TCH/2627/Jul01" {...reg('e_invoice_number', required)} />
										{errors.e_invoice_number && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
									</div>
									<div>
										<Label>E-Invoice Date</Label>
										<Input type="date" {...reg('e_invoice_date')} />
									</div>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<Label>Brand *</Label>
										<Input placeholder="Brand name" {...reg('brand', required)} />
										{errors.brand && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
									</div>
									<div>
										<Label>Brand POC Email *</Label>
										<Input type="email" placeholder="poc@brand.com" {...reg('brand_poc', required)} />
										{errors.brand_poc && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
									</div>
								</div>

								<div>
									<Label>Campaign Name *</Label>
									<Input list="campaign-name-options" placeholder="Pick existing or type new campaign name" {...reg('campaign', required)} />
									<datalist id="campaign-name-options">
										{campaigns.map((c) => <option key={c.name} value={c.name} />)}
									</datalist>
									{suggestedCampaignName && suggestedCampaignName !== watchCampaign && (
										<button
											type="button"
											onClick={() => setValue('campaign', suggestedCampaignName, { shouldValidate: true })}
											className="mt-1 text-[12px] hover:underline text-left flex items-center gap-1"
											style={{ color: 'var(--n-accent)' }}
										>
											<Icon name="sparkles" size={11} />
											Use suggested: {suggestedCampaignName}
										</button>
									)}
									{errors.campaign && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
								</div>

								<div className="space-y-4 pt-3 border-t" style={{ borderColor: 'var(--n-border)' }}>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label>TCH Point of Contact *</Label>
											<Input placeholder="TCH person handling this deal" {...reg('tch_poc', required)} />
											{errors.tch_poc && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
										</div>
										<div>
											<Label>Billing Entity</Label>
											<Input placeholder="Billing entity name" {...reg('billing_entity')} />
										</div>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label>Deliverables *</Label>
											<Input placeholder="e.g. 1 Reel" {...reg('deliverables', required)} />
											{errors.deliverables && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
										</div>
									</div>

									<div>
										<Label>Comments</Label>
										<Textarea placeholder="Add internal notes..." rows={3} {...reg('comments')} />
									</div>

									{/* Document Uploads */}
									<div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--n-border)' }}>
										<div>
											<Label>Client Invoice Upload</Label>
											<input type="file" {...register('client_invoice_file')} className="text-[13px] w-full" />
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Creator Split (Grid of Cards) */}
					<div className="space-y-6">
						<div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--n-border)' }}>
							<div>
								<h2 className="text-[16px] font-semibold text-[var(--n-fg)]">Creator Splits</h2>
								<p className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
									{shares.fields.length > 0
										? `Multiple creators configured. Combined split: ₹${inr(splitTotal)}`
										: 'Configure the creator fee and agency splits for this campaign.'}
								</p>
							</div>
							<div className="flex flex-wrap items-center justify-end gap-2">
								{deal && <InvoiceReadinessSummary dealId={deal.id} creatorCount={deal.creator_shares?.length || (deal.creator ? 1 : 0)} documents={docs} />}
								{isEditing && (
									<Button type="button" variant="outline" onClick={() => shares.append({ ...EMPTY_SHARE })}>
										<Icon name="plus" size={14} className="mr-1" /> Add Creator
									</Button>
								)}
							</div>
						</div>

						{hasDuplicateCreator && isEditing && (
							<div
								className="text-[13px] rounded-md p-3 flex gap-2 items-center"
								style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
							>
								<Icon name="alert-triangle" size={14} className="shrink-0" />
								<span>Warning: A creator is selected multiple times. Please make sure split partners are unique.</span>
							</div>
						)}

						{/* Grid of Creator Cards */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Primary Creator Card */}
							{!isEditing ? (
								<div className="rounded-xl border p-4 flex flex-col justify-between space-y-3 transition-all" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
									<div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--n-border)' }}>
										<span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--n-fg-subtle)]">Primary Creator</span>
										<Tag tone="accent">Primary</Tag>
									</div>
									<div>
										<p className="text-[15px] font-semibold" style={{ color: 'var(--n-fg)' }}>
											{creators.find(c => String(c.id) === watchCreator)?.name || '—'}
										</p>
										<p className="text-[12px] mt-0.5" style={{ color: 'var(--n-fg-subtle)' }}>
											{creators.find(c => String(c.id) === watchCreator)?.relationship || ''}
										</p>
									</div>
									<div className="grid grid-cols-4 gap-2 pt-2 border-t text-[12px]" style={{ borderColor: 'var(--n-border)' }}>
										<div>
											<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Their Fee</span>
											<span className="font-semibold tabular-nums text-[13px]" style={{ color: 'var(--n-fg)' }}>₹{inr(watchTotalFee)}</span>
										</div>
										<div>
											<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Agency %</span>
											<span className="font-medium tabular-nums text-[13px]" style={{ color: 'var(--n-fg-muted)' }}>
												{Number(watch('agency_fee_pct')) < 1 ? (Number(watch('agency_fee_pct')) * 100).toFixed(1) : Number(watch('agency_fee_pct'))}%
											</span>
										</div>
										<div>
											<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Net Payout</span>
											<span className="font-bold tabular-nums text-[13px]" style={{ color: 'var(--n-accent)' }}>
												₹{inr(watch('creator_fee'))}
											</span>
										</div>
										<div>
											<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>RO Number</span>
											<span className="font-medium text-[13px]" style={{ color: 'var(--n-fg)' }}>{watch('ro_number') || '—'}</span>
										</div>
									</div>
									{deal && <CreatorInvoiceControls dealId={deal.id} creatorId={deal.creator_shares?.[0]?.creator ?? deal.creator} />}
								</div>
							) : (
								<div className="rounded-xl border p-4 space-y-4 transition-all" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
									<div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--n-border)' }}>
										<span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--n-fg-subtle)]">Primary Creator</span>
									</div>
									<div>
										<Label>Creator *</Label>
										<Select {...reg('creator', required)} options={creatorOptions} placeholder="— select creator —" />
										{errors.creator && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label>Their Fee (₹) *</Label>
											<Input
												type="number"
												step="0.01"
												placeholder="0.00"
												{...register('total_fee', { ...required, onChange: recomputeFees })}
											/>
											{errors.total_fee && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
										</div>
										<div>
											<Label>Agency Fee % *</Label>
											<Input
												type="number"
												step="0.0001"
												placeholder="e.g. 20"
												{...register('agency_fee_pct', {
													...required,
													onChange: () => { feeBasis.current = 'pct'; recomputeFees(); },
												})}
											/>
											{errors.agency_fee_pct && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
										</div>
									</div>
									<div className="pt-2 border-t grid grid-cols-2 gap-3" style={{ borderColor: 'var(--n-border)' }}>
										<div>
											<Label>Net Payout (Creator Fee) *</Label>
											<Input
												type="number"
												step="0.01"
												placeholder="0.00"
												{...register('creator_fee', required)}
											/>
											{errors.creator_fee && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
										</div>
										<div>
											<Label>RO Number</Label>
											<Input placeholder="Optional" {...register('ro_number')} />
										</div>
									</div>
									{deal && (
										<CreatorInvoiceControls
											dealId={deal.id}
											creatorId={deal.creator_shares?.[0]?.creator ?? deal.creator}
											pendingAssignment={String(deal.creator_shares?.[0]?.creator ?? deal.creator ?? '') !== String(watchCreator || '')}
										/>
									)}
								</div>
							)}

							{/* Additional Creator Cards */}
							{shares.fields.map((field, i) => {
								const creatorShareFee = watchShares?.[i]?.total_fee || 0;
								const creatorSharePct = watchShares?.[i]?.agency_fee_pct || 0;
								const pctVal = Number(creatorSharePct) < 1 ? Number(creatorSharePct) : Number(creatorSharePct) / 100;
								const defaultNetPayout = Number(creatorShareFee) * (1 - pctVal);
								const customNetPayout = watchShares?.[i]?.creator_fee;
								const displayNetPayout = customNetPayout !== undefined && customNetPayout !== '' ? Number(customNetPayout) : defaultNetPayout;
								const partnerCreator = creators.find(c => String(c.id) === watchShares?.[i]?.creator);

								if (!isEditing) {
									return (
										<div key={field.id} className="rounded-xl border p-4 flex flex-col justify-between space-y-3 transition-all" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
											<div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--n-border)' }}>
												<span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--n-fg-subtle)]">Split Partner {i + 1}</span>
											</div>
											<div>
												<p className="text-[15px] font-semibold" style={{ color: 'var(--n-fg)' }}>
													{partnerCreator?.name || '—'}
												</p>
												<p className="text-[12px] mt-0.5" style={{ color: 'var(--n-fg-subtle)' }}>
													{partnerCreator?.relationship || ''}
												</p>
											</div>
											<div className="grid grid-cols-4 gap-2 pt-2 border-t text-[12px]" style={{ borderColor: 'var(--n-border)' }}>
												<div>
													<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Their Fee</span>
													<span className="font-semibold tabular-nums text-[13px]" style={{ color: 'var(--n-fg)' }}>₹{inr(creatorShareFee)}</span>
												</div>
												<div>
													<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Agency %</span>
													<span className="font-medium tabular-nums text-[13px]" style={{ color: 'var(--n-fg-muted)' }}>
														{(pctVal * 100).toFixed(1)}%
													</span>
												</div>
												<div>
													<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>Net Payout</span>
													<span className="font-bold tabular-nums text-[13px]" style={{ color: 'var(--n-accent)' }}>
														₹{inr(displayNetPayout)}
													</span>
												</div>
												<div>
													<span className="block text-[10.5px] uppercase tracking-wider" style={{ color: 'var(--n-fg-subtle)' }}>RO Number</span>
													<span className="font-medium text-[13px]" style={{ color: 'var(--n-fg)' }}>
														{watchShares?.[i]?.ro_number || '—'}
													</span>
												</div>
											</div>
											{deal && <CreatorInvoiceControls dealId={deal.id} creatorId={deal.creator_shares?.[i + 1]?.creator ?? null} />}
										</div>
									);
								}

								const recomputeShareFees = () => {
									const t = Number(getValues(`shares.${i}.total_fee`));
									const p = Number(getValues(`shares.${i}.agency_fee_pct`));
									if (Number.isFinite(t) && Number.isFinite(p)) {
										const pct = p < 1 ? p : p / 100;
										const a = t * pct;
										setValue(`shares.${i}.creator_fee`, (t - a).toFixed(2));
									}
								};

								return (
									<div key={field.id} className="rounded-xl border p-4 space-y-4 transition-all" style={{ background: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
										<div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--n-border)' }}>
											<span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--n-fg-subtle)]">Split Partner {i + 1}</span>
											<button
												type="button"
												onClick={() => shares.remove(i)}
												className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-red-50 text-red-600 transition-colors"
											>
												<Icon name="x" size={14} />
											</button>
										</div>
										<div>
											<Label>Creator *</Label>
											<Select {...register(`shares.${i}.creator`, { required: 'Required' })} options={creatorOptions} placeholder="— select creator —" />
											{errors.shares?.[i]?.creator && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
										</div>
										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label>Their Fee (₹) *</Label>
												<Input
													type="number"
													step="0.01"
													placeholder="0.00"
													{...register(`shares.${i}.total_fee`, { required: 'Required', onChange: recomputeShareFees })}
												/>
												{errors.shares?.[i]?.total_fee && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
											</div>
											<div>
												<Label>Agency Fee % *</Label>
												<Input
													type="number"
													step="0.0001"
													placeholder="e.g. 20"
													{...register(`shares.${i}.agency_fee_pct`, { required: 'Required', onChange: recomputeShareFees })}
												/>
												{errors.shares?.[i]?.agency_fee_pct && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
											</div>
										</div>
									<div className="pt-2 border-t grid grid-cols-2 gap-3" style={{ borderColor: 'var(--n-border)' }}>
											<div>
												<Label>Net Payout (Creator Fee) *</Label>
												<Input
													type="number"
													step="0.01"
													placeholder="0.00"
													{...register(`shares.${i}.creator_fee`, { required: 'Required' })}
												/>
												{errors.shares?.[i]?.creator_fee && <p className="text-[12px] mt-0.5 text-red-600">Required</p>}
											</div>
											<div>
												<Label>RO Number</Label>
												<Input placeholder="Optional" {...register(`shares.${i}.ro_number`)} />
											</div>
										</div>
									{deal && (
										<CreatorInvoiceControls
											dealId={deal.id}
											creatorId={deal.creator_shares?.[i + 1]?.creator ?? null}
											pendingAssignment={String(deal.creator_shares?.[i + 1]?.creator ?? '') !== String(watchShares?.[i]?.creator || '')}
										/>
									)}
									</div>
								);
							})}
						</div>
					</div>
				</fieldset>

				{/* Actions Panel */}
				{isEditing && (
					<div className="border-t pt-4 flex justify-end gap-3" style={{ borderColor: 'var(--n-border)' }}>
						<Button type="button" variant="outline" onClick={() => { setIsEditing(false); reset({ ...initialForm, shares: initialShares }); }}>
							Cancel
						</Button>
						<Button type="submit" variant="primary" disabled={isSubmitting}>
							{isSubmitting ? 'Saving...' : 'Save Changes'}
						</Button>
					</div>
				)}
			</form>
			<ConfirmDialog
				open={confirmEditOpen}
				onOpenChange={setConfirmEditOpen}
				title="Edit this campaign?"
				description="You are about to enable editing for campaign details and creator splits."
				confirmLabel="Continue to edit"
				onConfirm={() => { setConfirmEditOpen(false); setIsEditing(true); }}
			/>
			<ConfirmDialog
				open={confirmDeleteOpen}
				onOpenChange={setConfirmDeleteOpen}
				title="Delete this campaign?"
				description="This action cannot be undone and will remove its associated creator invoice records."
				confirmLabel="Delete campaign"
				confirmVariant="danger"
				pending={deleteDealMutation.isPending}
				onConfirm={remove}
			/>
		</div>
	);
}
