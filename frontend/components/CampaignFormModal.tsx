'use client';

import * as React from 'react';
import { useForm, useFieldArray, Controller, type FieldErrors, type RegisterOptions, type Path } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import MuiDialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MuiButton from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import type { Creator } from '@/lib/api';
import type { DealForm, ShareForm } from '@/types/deal';
import { DIRECTION, EMPTY_SHARE, MONTH_NAMES } from '@/lib/deals';
import { inr } from '@/lib/utils';
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

const muiInputSx = {
	'& .MuiInputBase-root': { bgcolor: 'var(--n-bg-soft)', fontSize: 14 },
	'& .MuiFormHelperText-root': { minHeight: 18, m: '2px 0 0' }
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

	// Spread helper: MUI TextField needs the ref on inputRef, not ref.
	const reg = (name: Path<FormValues>, options?: RegisterOptions<FormValues, Path<FormValues>>) => {
		const { ref, ...rest } = register(name, options);
		return { ...rest, inputRef: ref };
	};

	// Agency fee % and Agency fee (INR) are kept in sync both ways: editing the
	// % derives the INR, editing the INR derives the %. feeBasis remembers which
	// one the user drove last so changing Total Fee recomputes the right one.
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

	const creatorOptions = creators.map((c) => ({
		value: String(c.id),
		label: `${c.name} · ${c.relationship}`
	}));

	const [watchCreator, watchBrand, watchEInvDate, watchConfDate, watchCampaign, watchTotalFee, watchShares] = watch([
		'creator',
		'brand',
		'e_invoice_date',
		'confirmation_date',
		'campaign',
		'total_fee',
		'shares'
	]);

	// Suggested campaign name following the Brand + Creator + Month/Year convention.
	const suggestedCampaignName = React.useMemo(() => {
		const creatorName = creators.find((c) => String(c.id) === watchCreator)?.name || '';
		const date = watchEInvDate || watchConfDate;
		const parts = [watchBrand?.trim(), creatorName, date ? monthYearLabel(date) : ''].filter(Boolean);
		return parts.join(' · ');
	}, [creators, watchCreator, watchBrand, watchEInvDate, watchConfDate]);

	// Campaign total when splitting (primary share + additional shares).
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

	const errText = (k: keyof DealForm) => (errors[k]?.message as string) ?? ' ';

	return (
		<MuiDialog open={open} onClose={() => onOpenChange(false)} fullWidth maxWidth="md">
			<DialogTitle>{title}</DialogTitle>
			<DialogContent dividers>
				{summaryError && (
					<Alert severity="error" sx={{ mb: 2, '& .MuiAlert-message': { fontSize: 13 } }}>
						{summaryError}
					</Alert>
				)}
				<form id="campaign-form" onSubmit={submitHandler} className="grid grid-cols-3 gap-3">
					<div>
						<TextField label="Confirmation Date" type="date" size="small" fullWidth {...reg('confirmation_date', required)} error={!!errors.confirmation_date} helperText={errText('confirmation_date')} sx={muiInputSx} slotProps={{ inputLabel: { shrink: true } }} />
					</div>
					<div>
						<TextField label="E-Invoice Date" type="date" size="small" fullWidth {...reg('e_invoice_date')} helperText=" " sx={muiInputSx} slotProps={{ inputLabel: { shrink: true } }} />
					</div>
					<div>
						<TextField select label="Direction" size="small" fullWidth {...reg('direction', required)} error={!!errors.direction} helperText={errText('direction')} sx={muiInputSx} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
							{DIRECTION.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
						</TextField>
					</div>

					<div className="col-span-3">
						<TextField select label="Creator (pick from master)" size="small" fullWidth {...reg('creator', required)} error={!!errors.creator} helperText={errText('creator')} sx={muiInputSx} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
							<option value="">— pick creator —</option>
							{creatorOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
						</TextField>
					</div>
					<div className="col-span-2">
						<TextField label="TCH POC" size="small" fullWidth placeholder="TCH person handling this deal" {...reg('tch_poc', required)} error={!!errors.tch_poc} helperText={errText('tch_poc')} sx={muiInputSx} />
					</div>
					<div />

					<div>
						<TextField label="Total Fee (INR)" type="number" size="small" fullWidth {...reg('total_fee', { ...required, onChange: recomputeFees })} error={!!errors.total_fee} helperText={errText('total_fee')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.01' } }} />
					</div>
					<div>
						<TextField label="Agency Fee %" type="number" size="small" fullWidth placeholder="20 or 0.20 = 20%" {...reg('agency_fee_pct', { ...required, onChange: () => { feeBasis.current = 'pct'; recomputeFees(); } })} error={!!errors.agency_fee_pct} helperText={errText('agency_fee_pct')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.0001' } }} />
					</div>
					<div>
						<TextField label="Agency Fee (INR)" type="number" size="small" fullWidth {...reg('agency_fee_inr', { ...required, onChange: () => { feeBasis.current = 'inr'; recomputeFees(); } })} error={!!errors.agency_fee_inr} helperText={errText('agency_fee_inr')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.01' } }} />
					</div>
					<div className="col-span-2">
						<TextField label="Creator Fee (INR) — auto" type="number" size="small" fullWidth {...reg('creator_fee', required)} error={!!errors.creator_fee} helperText={errText('creator_fee')} sx={muiInputSx} slotProps={{ htmlInput: { step: '0.01' } }} />
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
								Single creator. Add creators here to split this campaign&apos;s billing across
								several people — each keeps their own fee, profit, and reporting.
							</p>
						) : (
							<div className="space-y-2">
								{shares.fields.map((field, i) => (
									<div key={field.id} className="grid grid-cols-12 gap-2 items-center">
										<div className="col-span-6">
											<Select
												{...register(`shares.${i}.creator`, { required: 'Required' })}
												options={creatorOptions}
												placeholder="— pick creator —"
											/>
											{errors.shares?.[i]?.creator && (
												<div className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</div>
											)}
										</div>
										<div className="col-span-3">
											<Input
												type="number"
												step="0.01"
												placeholder="Their fee"
												{...register(`shares.${i}.total_fee`, { required: 'Required' })}
											/>
											{errors.shares?.[i]?.total_fee && (
												<div className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</div>
											)}
										</div>
										<div className="col-span-2">
											<Input
												type="number"
												step="0.01"
												placeholder="Agency ₹"
												{...register(`shares.${i}.agency_fee_inr`, { required: 'Required' })}
											/>
											{errors.shares?.[i]?.agency_fee_inr && (
												<div className="text-[12px] mt-0.5" style={{ color: '#b91c1c' }}>Required</div>
											)}
										</div>
										<div className="col-span-1 flex justify-end">
											<Button variant="danger" onClick={() => shares.remove(i)}>×</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					<div>
						<TextField label="Brand" size="small" fullWidth {...reg('brand', required)} error={!!errors.brand} helperText={errText('brand')} sx={muiInputSx} />
					</div>
					<div>
						<TextField label="Brand POC" size="small" fullWidth placeholder="Brand-side contact" {...reg('brand_poc', required)} error={!!errors.brand_poc} helperText={errText('brand_poc')} sx={muiInputSx} />
					</div>
					<div>
						<Controller
							control={control}
							name="campaign"
							rules={{ required: 'Required' }}
							render={({ field }) => (
								<Autocomplete
									freeSolo
									size="small"
									options={campaignNames}
									value={field.value}
									onInputChange={(_, value) => field.onChange(value)}
									renderInput={(params) => (
										<TextField
											{...params}
											label="Campaign (pick or create)"
											error={!!errors.campaign}
											helperText={errText('campaign')}
											sx={muiInputSx}
										/>
									)}
								/>
							)}
						/>
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
					</div>

					<div className="col-span-2">
						<TextField label="Deliverables" size="small" fullWidth {...reg('deliverables', required)} error={!!errors.deliverables} helperText={errText('deliverables')} sx={muiInputSx} />
					</div>
					<div>
						<TextField label="RO Number" size="small" fullWidth {...reg('ro_number')} helperText=" " sx={muiInputSx} />
					</div>

					<div className="col-span-3 border-t pt-3 mt-1" style={{ borderColor: 'var(--n-border)' }}>
						<div className="text-[12px] font-semibold uppercase mb-2" style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.06em' }}>
							Invoices
						</div>
					</div>
					<div className="col-span-3 grid grid-cols-2 gap-3">
						<div>
							<Label>Client Invoice (TCH → Client) — upload</Label>
							<input
								type="file"
								accept="image/*,application/pdf"
								{...register('client_invoice_file')}
								className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
							/>
						</div>
						<div>
							<Label>Creator Invoice (Creator → TCH) — upload</Label>
							<input
								type="file"
								accept="image/*,application/pdf"
								{...register('creator_invoice_file')}
								className="block w-full text-[13px] file:mr-3 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-3 file:py-1 file:text-[13px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
							/>
						</div>
					</div>

					<div className="col-span-3">
						<Label>Comments</Label>
						<Textarea {...register('comments')} />
					</div>
				</form>
			</DialogContent>
			<DialogActions>
				<MuiButton variant="outlined" onClick={() => onOpenChange(false)} sx={{ textTransform: 'none' }}>
					Cancel
				</MuiButton>
				<MuiButton
					variant="contained"
					type="submit"
					form="campaign-form"
					disabled={isSubmitting}
					sx={{ bgcolor: 'var(--n-accent)', textTransform: 'none', '&:hover': { bgcolor: '#380e44' } }}
				>
					{isSubmitting ? 'Saving…' : submitLabel}
				</MuiButton>
			</DialogActions>
		</MuiDialog>
	);
}

export default CampaignFormModal;
