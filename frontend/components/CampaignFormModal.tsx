'use client';

import * as React from 'react';
import { useForm, type FieldErrors, type RegisterOptions, type Path } from 'react-hook-form';
import type { Creator } from '@/lib/api';
import type { DealForm, ShareForm } from '@/types/deal';
import { DIRECTION, MONTH_NAMES } from '@/lib/deals';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Icon from '@/components/ui/Icon';

type FormValues = DealForm;

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
		handleSubmit,
		reset,
		watch,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({ defaultValues: initial });

	const [summaryError, setSummaryError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (open) {
			setSummaryError(null);
			reset(initial);
		}
	}, [open, initial, reset]);

	const reg = (name: Path<FormValues>, options?: RegisterOptions<FormValues, Path<FormValues>>) =>
		register(name, options);

	const required = { required: 'Required' } as const;

	const [
		watchBrand, watchEInvDate, watchConfDate, watchCampaign,
	] = watch(['brand', 'e_invoice_date', 'confirmation_date', 'campaign']);

	const suggestedCampaignName = React.useMemo(() => {
		const date = watchEInvDate || watchConfDate;
		const parts = [watchBrand?.trim(), date ? monthYearLabel(date) : ''].filter(Boolean);
		return parts.join(' · ');
	}, [watchBrand, watchEInvDate, watchConfDate]);

	const submitHandler = handleSubmit(
		async (v) => {
			setSummaryError(null);
			// Pass form values with empty defaults for creator/financial fields
			await onSubmit({
				form: {
					...v,
					creator: '',
					total_fee: '0',
					agency_fee_pct: '0',
					agency_fee_inr: '0',
					creator_fee: '0',
				},
				shares: [],
				clientInvoiceFile: null,
				creatorInvoiceFile: null,
			});
		},
		(errs) => {
			const count = countErrors(errs);
			setSummaryError(
				`${count} required field${count === 1 ? '' : 's'} missing. Please fill in all highlighted fields.`
			);
		}
	);

	const err = (k: keyof DealForm) => (errors[k]?.message as string) || undefined;
	const fieldCls = (k: keyof DealForm) => err(k) ? 'border-red-500' : '';

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			className="max-w-2xl"
			footer={
				<>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button variant="primary" type="submit" form="campaign-form" disabled={isSubmitting}>
						{isSubmitting ? (
							<span className="flex items-center gap-2">
								<svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
									<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
									<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
								</svg>
								Creating…
							</span>
						) : (
							<span className="flex items-center gap-1.5">
								<Icon name="zap" size={13} />
								{submitLabel}
							</span>
						)}
					</Button>
				</>
			}
		>
			<style dangerouslySetInnerHTML={{ __html: `
				@keyframes slideDown {
					from { opacity: 0; transform: translateY(-6px); }
					to { opacity: 1; transform: translateY(0); }
				}
				.field-error-shake { animation: slideDown 0.2s ease-out; }
			`}} />

			{summaryError && (
				<div
					className="mb-5 text-[13px] rounded-xl p-3.5 flex gap-2.5 items-start field-error-shake"
					style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-border)' }}
				>
					<Icon name="alert-circle" size={15} className="mt-0.5 shrink-0" />
					<span>{summaryError}</span>
				</div>
			)}

			<form id="campaign-form" onSubmit={submitHandler}>
				{/* Section: Campaign & Brand */}
				<div className="mb-5">
					<div className="flex items-center gap-2 mb-4">
						<div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--n-accent)' }}>1</div>
						<span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--n-fg-subtle)' }}>Campaign Info</span>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="col-span-2">
							<Label>Campaign Name *</Label>
							<Input
								list="campaign-name-options"
								placeholder="Pick existing or type new campaign name"
								{...reg('campaign', required)}
								className={fieldCls('campaign')}
							/>
							<datalist id="campaign-name-options">
								{campaignNames.map((name) => <option key={name} value={name} />)}
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
							{err('campaign') && <p className="mt-1 text-[12px] text-red-500 field-error-shake">{err('campaign')}</p>}
						</div>
						<div>
							<Label>Brand *</Label>
							<Input placeholder="Brand name" {...reg('brand', required)} className={fieldCls('brand')} />
							{err('brand') && <p className="mt-1 text-[12px] text-red-500 field-error-shake">{err('brand')}</p>}
						</div>
						<div>
							<Label>Brand POC Email *</Label>
							<Input type="email" placeholder="poc@brand.com" {...reg('brand_poc', required)} className={fieldCls('brand_poc')} />
							{err('brand_poc') && <p className="mt-1 text-[12px] text-red-500 field-error-shake">{err('brand_poc')}</p>}
						</div>
						<div>
							<Label>Deliverables *</Label>
							<Input placeholder="e.g. 1 Reel + 3 Stories" {...reg('deliverables', required)} className={fieldCls('deliverables')} />
							{err('deliverables') && <p className="mt-1 text-[12px] text-red-500 field-error-shake">{err('deliverables')}</p>}
						</div>
						<div>
							<Label>Billing Entity</Label>
							<Input placeholder="e.g. TCH Media Pvt. Ltd." {...reg('billing_entity')} />
						</div>
					</div>
				</div>

				<div className="border-t mb-5" style={{ borderColor: 'var(--n-border)' }} />

				{/* Section: Deal Info */}
				<div>
					<div className="flex items-center gap-2 mb-4">
						<div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: 'var(--n-accent)' }}>2</div>
						<span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--n-fg-subtle)' }}>Deal Details</span>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label>Confirmation Date *</Label>
							<Input type="date" {...reg('confirmation_date', required)} className={fieldCls('confirmation_date')} />
							{err('confirmation_date') && <p className="mt-1 text-[12px] text-red-500">{err('confirmation_date')}</p>}
						</div>
						<div>
							<Label>Direction *</Label>
							<Select {...reg('direction', required)} options={DIRECTION} className={fieldCls('direction')} />
							{err('direction') && <p className="mt-1 text-[12px] text-red-500">{err('direction')}</p>}
						</div>
						<div>
							<Label>TCH Point of Contact *</Label>
							<Input placeholder="TCH person handling this deal" {...reg('tch_poc', required)} className={fieldCls('tch_poc')} />
							{err('tch_poc') && <p className="mt-1 text-[12px] text-red-500">{err('tch_poc')}</p>}
						</div>
						<div>
							<Label>E-Invoice Number *</Label>
							<Input placeholder="e.g. TCH/2627/Jul01" {...reg('e_invoice_number', required)} className={fieldCls('e_invoice_number')} />
							{err('e_invoice_number') && <p className="mt-1 text-[12px] text-red-500">{err('e_invoice_number')}</p>}
						</div>
					</div>
				</div>
			</form>
		</Dialog>
	);
}

export default CampaignFormModal;
