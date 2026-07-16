'use client';

import * as React from 'react';
import { useForm, useFieldArray, type FieldErrors, type RegisterOptions, type Path } from 'react-hook-form';
import type { Creator } from '@/lib/api';
import type { DealForm, ShareForm } from '@/types/deal';
import { EMPTY_SHARE } from '@/types/deal';
import { DIRECTION, MONTH_NAMES } from '@/lib/deals';
import { inr } from '@/lib/utils';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Label from '@/components/ui/Label';
import Icon from '@/components/ui/Icon';

type FormValues = DealForm & {
	shares: ShareForm[];
	client_invoice_file: FileList | null;
	creator_invoice_file: FileList | null;
};

export type CampaignFormResult = {
	form: DealForm;
	shares: ShareForm[];
	clientInvoiceFile: File | null;
	creatorInvoiceFile: File | null;
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

/** Thin section header to visually group related fields */
function SectionHeader({ children }: { children: React.ReactNode }) {
	return (
		<div className="col-span-full pt-2 pb-1 mb-4" style={{ borderBottom: '1px solid var(--n-border)' }}>
			<span
				className="text-[11px] font-semibold uppercase tracking-widest"
				style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.08em' }}
			>
				{children}
			</span>
		</div>
	);
}

/** Consistent field wrapper — label + input + inline error */
function Field({
	label,
	error,
	hint,
	children,
	className,
}: {
	label: string;
	error?: string;
	hint?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={className}>
			<Label>{label}</Label>
			{children}
			{error ? (
				<p className="mt-0.5 text-[12px]" style={{ color: '#b91c1c' }}>{error}</p>
			) : hint ? (
				<p className="mt-0.5 text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>{hint}</p>
			) : (
				<div className="min-h-[18px]" />
			)}
		</div>
	);
}

export interface CampaignFormModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	submitLabel: string;
	initial: DealForm;
	initialShares: ShareForm[];
	creators: Creator[];
	campaignNames: string[];
	onSubmit: (values: CampaignFormResult) => Promise<void> | void;
}

export function CampaignFormModal({
	open,
	onOpenChange,
	title,
	submitLabel,
	initial,
	initialShares,
	creators,
	campaignNames,
	onSubmit,
}: CampaignFormModalProps) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		watch,
		getValues,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({ defaultValues: { ...initial, shares: initialShares } });

	const shares = useFieldArray({ control, name: 'shares' });
	const [summaryError, setSummaryError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (open) {
			setSummaryError(null);
			reset({ ...initial, shares: initialShares, client_invoice_file: null, creator_invoice_file: null });
		}
	}, [open, initial, initialShares, reset]);

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
			? (Number(watchTotalFee) || 0) + watchShares.reduce((n, s) => n + (Number(s.total_fee) || 0), 0)
			: 0;

	const submitHandler = handleSubmit(
		async (v) => {
			setSummaryError(null);
			const { shares: shareRows, client_invoice_file, creator_invoice_file, ...form } = v;
			await onSubmit({
				form,
				shares: shareRows,
				clientInvoiceFile: client_invoice_file?.[0] ?? null,
				creatorInvoiceFile: creator_invoice_file?.[0] ?? null,
			});
		},
		(errs) => {
			const count = countErrors(errs);
			setSummaryError(
				`${count} required field${count === 1 ? '' : 's'} missing. Fields marked in red below must be filled in. Invoice uploads are optional.`
			);
		}
	);

	const err = (k: keyof DealForm) => (errors[k]?.message as string) || undefined;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			className="max-w-3xl"
			footer={
				<>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button variant="primary" type="submit" form="campaign-form" disabled={isSubmitting}>
						{isSubmitting ? 'Saving…' : submitLabel}
					</Button>
				</>
			}
		>
			{summaryError && (
				<div
					className="mb-4 text-[13px] rounded-md p-3 flex gap-2 items-start"
					style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
				>
					<Icon name="alert-circle" size={14} className="mt-0.5 shrink-0" />
					{summaryError}
				</div>
			)}

			<form id="campaign-form" onSubmit={submitHandler} className="grid grid-cols-2 gap-x-4 gap-y-0">

				{/* ── 1. Deal Info ─────────────────────────────────────────────────── */}
				<SectionHeader>Deal Info</SectionHeader>

				<Field label="Confirmation Date *" error={err('confirmation_date')}>
					<Input
						type="date"
						{...reg('confirmation_date', required)}
						className={errors.confirmation_date ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="Direction *" error={err('direction')}>
					<Select
						{...reg('direction', required)}
						options={DIRECTION}
						className={errors.direction ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="E-Invoice Number *" error={err('e_invoice_number')}>
					<Input
						placeholder="e.g. TCH/2627/Jul01"
						{...reg('e_invoice_number', required)}
						className={errors.e_invoice_number ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="E-Invoice Date" error={err('e_invoice_date')}>
					<Input type="date" {...reg('e_invoice_date')} />
				</Field>

				{/* ── 2. Creator & Team ────────────────────────────────────────────── */}
				<SectionHeader>Creator & Team</SectionHeader>

				<Field label="Creator *" error={err('creator')} className="col-span-full">
					<Select
						{...reg('creator', required)}
						options={creatorOptions}
						placeholder="— select creator —"
						className={errors.creator ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="TCH Point of Contact *" error={err('tch_poc')} className="col-span-full">
					<Input
						placeholder="Name of TCH person handling this deal"
						{...reg('tch_poc', required)}
						className={errors.tch_poc ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				{/* ── 3. Campaign Details ──────────────────────────────────────────── */}
				<SectionHeader>Campaign Details</SectionHeader>

				<Field label="Brand *" error={err('brand')}>
					<Input
						placeholder="Brand name"
						{...reg('brand', required)}
						className={errors.brand ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="Brand POC Email *" error={err('brand_poc')}>
					<Input
						type="email"
						placeholder="poc@brand.com"
						{...reg('brand_poc', required)}
						className={errors.brand_poc ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="Billing Entity" error={err('billing_entity')} className="col-span-full">
					<Input
						placeholder="e.g. TCH Media Pvt. Ltd."
						{...reg('billing_entity')}
					/>
				</Field>

				<Field
					label="Campaign Name *"
					error={err('campaign')}
					className="col-span-full"
				>
					<Input
						list="campaign-name-options"
						placeholder="Pick an existing campaign or type a new name"
						{...reg('campaign', required)}
						className={errors.campaign ? 'border-[#b91c1c]' : ''}
					/>
					<datalist id="campaign-name-options">
						{campaignNames.map((name) => <option key={name} value={name} />)}
					</datalist>
					{suggestedCampaignName && suggestedCampaignName !== watchCampaign && (
						<button
							type="button"
							onClick={() => setValue('campaign', suggestedCampaignName, { shouldValidate: true })}
							className="mt-1 text-[12px] underline decoration-dotted hover:no-underline"
							style={{ color: 'var(--n-accent)' }}
						>
							Use suggested: {suggestedCampaignName}
						</button>
					)}
				</Field>

				<Field label="Deliverables *" error={err('deliverables')}>
					<Input
						placeholder="e.g. 1 Reel + 3 Stories"
						{...reg('deliverables', required)}
						className={errors.deliverables ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="RO Number" error={err('ro_number')}>
					<Input placeholder="Optional" {...reg('ro_number')} />
				</Field>

				{/* ── 4. Financials ────────────────────────────────────────────────── */}
				<SectionHeader>Financials</SectionHeader>

				<Field label="Total Deal Fee (₹) *" error={err('total_fee')}>
					<Input
						type="number"
						step="0.01"
						placeholder="0.00"
						{...reg('total_fee', { ...required, onChange: recomputeFees })}
						className={errors.total_fee ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field
					label="Agency Fee %"
					error={err('agency_fee_pct')}
					hint="Enter as percent: 20 = 20 %, 0.20 = 20 %"
				>
					<Input
						type="number"
						step="0.0001"
						placeholder="e.g. 20"
						{...reg('agency_fee_pct', {
							...required,
							onChange: () => { feeBasis.current = 'pct'; recomputeFees(); },
						})}
						className={errors.agency_fee_pct ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field
					label="Agency Fee (₹)"
					error={err('agency_fee_inr')}
					hint="Edit this or % above — the other auto-updates"
				>
					<Input
						type="number"
						step="0.01"
						placeholder="0.00"
						{...reg('agency_fee_inr', {
							...required,
							onChange: () => { feeBasis.current = 'inr'; recomputeFees(); },
						})}
						className={errors.agency_fee_inr ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				<Field label="Creator Fee (₹)" error={err('creator_fee')} hint="Auto-calculated: Total − Agency">
					<Input
						type="number"
						step="0.01"
						placeholder="0.00"
						{...reg('creator_fee', required)}
						className={errors.creator_fee ? 'border-[#b91c1c]' : ''}
					/>
				</Field>

				{/* ── 5. Split Billing ─────────────────────────────────────────────── */}
				<div className="col-span-full pt-2 pb-1" style={{ borderBottom: '1px solid var(--n-border)' }}>
					<div className="flex items-center justify-between">
						<span
							className="text-[11px] font-semibold uppercase tracking-widest"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.08em' }}
						>
							Split Billing
							{shares.fields.length > 0 && (
								<span className="ml-2 normal-case font-normal text-[12px]" style={{ color: 'var(--n-fg-muted)' }}>
									Campaign total ₹{inr(splitTotal)} · fields above = 1st creator&apos;s share
								</span>
							)}
						</span>
						<Button variant="outline" onClick={() => shares.append({ ...EMPTY_SHARE })}>
							<Icon name="plus" size={13} /> Add creator
						</Button>
					</div>
				</div>

				<div className="col-span-full">
					{shares.fields.length === 0 ? (
						<p className="text-[13px] py-1" style={{ color: 'var(--n-fg-subtle)' }}>
							Single creator deal. Add additional creators above to split billing across multiple people.
						</p>
					) : (
						<div className="space-y-2 pt-1">
							{shares.fields.map((field, i) => (
								<div
									key={field.id}
									className="grid gap-2 items-start rounded-md p-3"
									style={{
										gridTemplateColumns: '1fr 140px 140px 36px',
										background: 'var(--n-bg-soft)',
										border: '1px solid var(--n-border)',
									}}
								>
									<div>
										<Label>Creator</Label>
										<Select
											{...register(`shares.${i}.creator`, { required: 'Required' })}
											options={creatorOptions}
											placeholder="— select creator —"
										/>
										{errors.shares?.[i]?.creator && (
											<p className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</p>
										)}
									</div>
									<div>
										<Label>Their Fee (₹)</Label>
										<Input
											type="number"
											step="0.01"
											placeholder="0.00"
											{...register(`shares.${i}.total_fee`, { required: 'Required' })}
										/>
										{errors.shares?.[i]?.total_fee && (
											<p className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</p>
										)}
									</div>
									<div>
										<Label>Agency Fee %</Label>
										<Input
											type="number"
											step="0.0001"
											placeholder="e.g. 20"
											{...register(`shares.${i}.agency_fee_pct`, { required: 'Required' })}
										/>
										{errors.shares?.[i]?.agency_fee_pct && (
											<p className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</p>
										)}
									</div>
									<div className="pt-5">
										<button
											type="button"
											onClick={() => shares.remove(i)}
											className="h-8 w-8 flex items-center justify-center rounded transition-colors"
											style={{ color: '#b91c1c' }}
											onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
											onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
											aria-label="Remove creator"
										>
											<Icon name="x" size={14} />
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* ── 6. Invoices ──────────────────────────────────────────────────── */}
				<SectionHeader>Invoices</SectionHeader>

				<div>
					<Label>Client Invoice (TCH → Client)</Label>
					<input
						type="file"
						accept="image/*,application/pdf"
						{...register('client_invoice_file')}
						className="mt-1 block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)] cursor-pointer"
					/>
				</div>

				<div>
					<Label>Creator Invoice (Creator → TCH)</Label>
					<input
						type="file"
						accept="image/*,application/pdf"
						{...register('creator_invoice_file')}
						className="mt-1 block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)] cursor-pointer"
					/>
				</div>

				{/* ── 7. Comments ──────────────────────────────────────────────────── */}
				<SectionHeader>Comments</SectionHeader>
				<div className="col-span-full">
					<Textarea placeholder="Optional notes or context about this deal…" {...register('comments')} />
				</div>
			</form>
		</Dialog>
	);
}

export default CampaignFormModal;
