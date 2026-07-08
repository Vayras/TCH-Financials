'use client';

import * as React from 'react';
import { useForm, useFieldArray, type FieldErrors, type RegisterOptions, type Path } from 'react-hook-form';
import type { Creator } from '@/lib/api';
import type { DealForm, ShareForm } from '@/types/deal';
import { DIRECTION, EMPTY_SHARE, MONTH_NAMES } from '@/lib/deals';
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
		if ('message' in (node as object) && 'type' in (node as object)) {
			n += 1;
			return;
		}
		for (const v of Object.values(node as object)) walk(v);
	};
	walk(errs);
	return n;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
	return (
		<div>
			<Label>{label}</Label>
			{children}
			<div className="min-h-[18px] text-[12px] mt-0.5" style={{ color: error ? '#b91c1c' : 'transparent' }}>
				{error ?? ' '}
			</div>
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
	onSubmit
}: CampaignFormModalProps) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		watch,
		getValues,
		setValue,
		formState: { errors, isSubmitting }
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
		const pct = p <= 1 ? p : p / 100;
		const a = total * pct;
		setValue('agency_fee_inr', a.toFixed(2));
		setValue('creator_fee', (total - a).toFixed(2));
	};

	const required = { required: 'Required' } as const;
	const creatorOptions = creators.map((c) => ({ value: String(c.id), label: `${c.name} · ${c.relationship}` }));

	const [watchCreator, watchBrand, watchEInvDate, watchConfDate, watchCampaign, watchTotalFee, watchShares] = watch([
		'creator',
		'brand',
		'e_invoice_date',
		'confirmation_date',
		'campaign',
		'total_fee',
		'shares'
	]);

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
				creatorInvoiceFile: creator_invoice_file?.[0] ?? null
			});
		},
		(errs) => {
			const count = countErrors(errs);
			setSummaryError(
				`${count} required field${count === 1 ? '' : 's'} missing. Fields marked in red are required. Invoice uploads are optional.`
			);
		}
	);

	const errText = (k: keyof DealForm) => (errors[k]?.message as string) || undefined;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			className="max-w-4xl"
			footer={
				<>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="primary" type="submit" form="campaign-form" disabled={isSubmitting}>
						{isSubmitting ? 'Saving…' : submitLabel}
					</Button>
				</>
			}
		>
			{summaryError && (
				<div className="mb-3 text-[13px] rounded p-3" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
					{summaryError}
				</div>
			)}
			<form id="campaign-form" onSubmit={submitHandler} className="grid grid-cols-3 gap-3">
				<Field label="Confirmation Date" error={errText('confirmation_date')}>
					<Input type="date" {...reg('confirmation_date', required)} className={errors.confirmation_date ? 'border-[#b91c1c]' : ''} />
				</Field>
				<Field label="E-Invoice #" error={errText('e_invoice_number')}>
					<Input placeholder="TCH/2627/Jul01" {...reg('e_invoice_number', required)} className={errors.e_invoice_number ? 'border-[#b91c1c]' : ''} />
				</Field>
				<Field label="E-Invoice Date">
					<Input type="date" {...reg('e_invoice_date')} />
				</Field>
				<Field label="Direction" error={errText('direction')}>
					<Select {...reg('direction', required)} options={DIRECTION} className={errors.direction ? 'border-[#b91c1c]' : ''} />
				</Field>

				<div className="col-span-3">
					<Field label="Creator (pick from master)" error={errText('creator')}>
						<Select {...reg('creator', required)} options={creatorOptions} placeholder="— pick creator —" className={errors.creator ? 'border-[#b91c1c]' : ''} />
					</Field>
				</div>
				<div className="col-span-2">
					<Field label="TCH POC" error={errText('tch_poc')}>
						<Input placeholder="TCH person handling this deal" {...reg('tch_poc', required)} className={errors.tch_poc ? 'border-[#b91c1c]' : ''} />
					</Field>
				</div>
				<div />

				<Field label="Total Fee (INR)" error={errText('total_fee')}>
					<Input type="number" step="0.01" {...reg('total_fee', { ...required, onChange: recomputeFees })} className={errors.total_fee ? 'border-[#b91c1c]' : ''} />
				</Field>
				<Field label="Agency Fee %" error={errText('agency_fee_pct')}>
					<Input type="number" step="0.0001" placeholder="20 or 0.20 = 20%" {...reg('agency_fee_pct', { ...required, onChange: () => { feeBasis.current = 'pct'; recomputeFees(); } })} className={errors.agency_fee_pct ? 'border-[#b91c1c]' : ''} />
				</Field>
				<Field label="Agency Fee (INR)" error={errText('agency_fee_inr')}>
					<Input type="number" step="0.01" {...reg('agency_fee_inr', { ...required, onChange: () => { feeBasis.current = 'inr'; recomputeFees(); } })} className={errors.agency_fee_inr ? 'border-[#b91c1c]' : ''} />
				</Field>
				<div className="col-span-2">
					<Field label="Creator Fee (INR) — auto" error={errText('creator_fee')}>
						<Input type="number" step="0.01" {...reg('creator_fee', required)} className={errors.creator_fee ? 'border-[#b91c1c]' : ''} />
					</Field>
				</div>

				<div className="col-span-3 mt-1 pt-3" style={{ borderTop: '1px solid var(--n-border)' }}>
					<div className="flex items-center justify-between mb-2">
						<Label>
							Additional creators (split billing)
							{shares.fields.length > 0 && (
								<span className="ml-2 font-normal" style={{ color: 'var(--n-fg-muted)' }}>
									Campaign total ₹ {inr(splitTotal)} · fields above are the 1st creator&apos;s share
								</span>
							)}
						</Label>
						<Button variant="outline" onClick={() => shares.append({ ...EMPTY_SHARE })}>
							<Icon name="plus" size={13} /> Add creator
						</Button>
					</div>
					{shares.fields.length === 0 ? (
						<p className="text-[12px]" style={{ color: 'var(--n-fg-subtle)' }}>
							Single creator. Add creators here to split this campaign&apos;s billing across several people.
						</p>
					) : (
						<div className="space-y-2">
							{shares.fields.map((field, i) => (
								<div key={field.id} className="grid grid-cols-12 gap-2 items-start">
									<div className="col-span-6">
										<Select {...register(`shares.${i}.creator`, { required: 'Required' })} options={creatorOptions} placeholder="— pick creator —" />
										{errors.shares?.[i]?.creator && <div className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</div>}
									</div>
									<div className="col-span-3">
										<Input type="number" step="0.01" placeholder="Their fee" {...register(`shares.${i}.total_fee`, { required: 'Required' })} />
										{errors.shares?.[i]?.total_fee && <div className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</div>}
									</div>
									<div className="col-span-2">
										<Input type="number" step="0.01" placeholder="Agency ₹" {...register(`shares.${i}.agency_fee_inr`, { required: 'Required' })} />
										{errors.shares?.[i]?.agency_fee_inr && <div className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</div>}
									</div>
									<div className="col-span-1 flex justify-end">
										<Button variant="danger" onClick={() => shares.remove(i)}>×</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<Field label="Brand" error={errText('brand')}>
					<Input {...reg('brand', required)} className={errors.brand ? 'border-[#b91c1c]' : ''} />
				</Field>
				<Field label="POC Email" error={errText('brand_poc')}>
					<Input type="email" placeholder="poc@brand.com" {...reg('brand_poc', required)} className={errors.brand_poc ? 'border-[#b91c1c]' : ''} />
				</Field>
				<Field label="Campaign (pick or create)" error={errText('campaign')}>
					<Input list="campaign-name-options" {...reg('campaign', required)} className={errors.campaign ? 'border-[#b91c1c]' : ''} />
					<datalist id="campaign-name-options">
						{campaignNames.map((name) => <option key={name} value={name} />)}
					</datalist>
					{suggestedCampaignName && suggestedCampaignName !== watchCampaign && (
						<button type="button" onClick={() => setValue('campaign', suggestedCampaignName, { shouldValidate: true })} className="mt-1 text-[12px] underline decoration-dotted hover:no-underline" style={{ color: 'var(--n-accent)' }}>
							Use suggested: {suggestedCampaignName}
						</button>
					)}
				</Field>

				<div className="col-span-2">
					<Field label="Deliverables" error={errText('deliverables')}>
						<Input {...reg('deliverables', required)} className={errors.deliverables ? 'border-[#b91c1c]' : ''} />
					</Field>
				</div>
				<Field label="RO Number">
					<Input {...reg('ro_number')} />
				</Field>

				<div className="col-span-3 border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
					<div className="text-[12px] font-semibold uppercase mb-2" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>
						Invoices
					</div>
				</div>
				<div className="col-span-3 grid grid-cols-2 gap-3">
					<div>
						<Label>Client Invoice (TCH → Client) — upload</Label>
						<input type="file" accept="image/*,application/pdf" {...register('client_invoice_file')} className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]" />
					</div>
					<div>
						<Label>Creator Invoice (Creator → TCH) — upload</Label>
						<input type="file" accept="image/*,application/pdf" {...register('creator_invoice_file')} className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]" />
					</div>
				</div>

				<div className="col-span-3">
					<Label>Comments</Label>
					<Textarea {...register('comments')} />
				</div>
			</form>
		</Dialog>
	);
}

export default CampaignFormModal;
