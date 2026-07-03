'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Icon from '@/components/ui/Icon';

export type AttachmentType = 'Contract' | 'PAN' | 'Aadhaar' | 'Cheque';
export type CreatorAttachment = { doc_type: AttachmentType; file: File };

export type CreatorForm = {
	name: string;
	niche: string;
	relation: string;
	status: string;
	doj: Date;
	url: string[];
	location: string;
	talent_manager: string;
	attachments: CreatorAttachment[];
};

export const EMPTY_FORM: CreatorForm = {
	name: '',
	niche: '',
	relation: '',
	status: '',
	doj: new Date('2002-09-12'),
	url: [],
	location: '',
	talent_manager: '',
	attachments: []
};

const REL = [
	{ value: 'Exclusive', label: 'Exclusive' },
	{ value: 'Non-Exclusive', label: 'Non-Exclusive' }
];

const STATUS = [
	{ value: 'Active', label: 'Active' },
	{ value: 'Inactive', label: 'Inactive' }
];

// Contract is only collected (and required) for Exclusive creators. It sits
// last so the other slots don't shift when it appears.
const ATTACH_SLOTS: { key: AttachmentType; label: string; exclusiveOnly?: boolean }[] = [
	{ key: 'PAN', label: 'PAN Card' },
	{ key: 'Aadhaar', label: 'Aadhaar Card' },
	{ key: 'Cheque', label: 'Cancelled Cheque' },
	{ key: 'Contract', label: 'Contract / Agreement', exclusiveOnly: true }
];

// react-hook-form works with input-native values: dates as yyyy-mm-dd
// strings, files as FileList, and field arrays as objects. Convert to/from
// the public CreatorForm shape at the edges.
type FormValues = {
	name: string;
	niche: string;
	relation: string;
	status: string;
	doj: string;
	url: { value: string }[];
	location: string;
	talent_manager: string;
	attachments: Record<AttachmentType, FileList | null>;
};

const EMPTY_ATTACHMENTS: Record<AttachmentType, FileList | null> = {
	Contract: null,
	PAN: null,
	Aadhaar: null,
	Cheque: null
};

function toValues(f: CreatorForm): FormValues {
	return {
		name: f.name,
		niche: f.niche,
		relation: f.relation,
		status: f.status,
		doj: isNaN(f.doj.getTime()) ? '' : f.doj.toISOString().slice(0, 10),
		url: f.url.map((value) => ({ value })),
		location: f.location,
		talent_manager: f.talent_manager,
		attachments: EMPTY_ATTACHMENTS
	};
}

function fromValues(v: FormValues): CreatorForm {
	return {
		name: v.name,
		niche: v.niche,
		relation: v.relation,
		status: v.status,
		doj: new Date(v.doj),
		url: v.url.map((u) => u.value).filter(Boolean),
		location: v.location,
		talent_manager: v.talent_manager,
		attachments: ATTACH_SLOTS.flatMap((slot) => {
			const file = v.attachments[slot.key]?.[0];
			return file ? [{ doc_type: slot.key, file }] : [];
		})
	};
}

export interface CreatorFormModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	submitLabel: string;
	initial: CreatorForm;
	onSubmit: (form: CreatorForm) => Promise<void> | void;
	error?: string | null;
	/** Show and require the document slots (used when creating; edits manage docs via the Docs dialog). */
	requireAttachments?: boolean;
}

export function CreatorFormModal({
	open,
	onOpenChange,
	title,
	submitLabel,
	initial,
	onSubmit,
	error,
	requireAttachments = false
}: CreatorFormModalProps) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		watch,
		getValues,
		formState: { errors, isSubmitting }
	} = useForm<FormValues>({ defaultValues: toValues(initial) });

	const urls = useFieldArray({ control, name: 'url' });

	React.useEffect(() => {
		if (open) reset(toValues(initial));
	}, [open, initial, reset]);

	const relation = watch('relation');
	const slots = ATTACH_SLOTS.filter((s) => !s.exclusiveOnly || relation === 'Exclusive');

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			footer={
				<>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="primary" type="submit" form="creator-form" disabled={isSubmitting}>
						{isSubmitting ? 'Saving…' : submitLabel}
					</Button>
				</>
			}
		>
			<form
				id="creator-form"
				onSubmit={handleSubmit(async (v) => onSubmit(fromValues(v)))}
				className="grid grid-cols-2 gap-3"
			>
				<div className="col-span-2">
					<Label>Name</Label>
					<Input
						{...register('name', { required: 'Name is required' })}
						placeholder="Saili Satwe"
					/>
					{errors.name && (
						<div className="text-[12px] mt-1" style={{ color: '#b91c1c' }}>
							{errors.name.message}
						</div>
					)}
				</div>
				<div>
					<Label>Niche</Label>
					<Input {...register('niche')} placeholder="Lifestyle / Fashion" />
				</div>
				<div>
					<Label>Relation</Label>
					<Select {...register('relation')} options={REL} placeholder="Select relation…" />
				</div>
				<div>
					<Label>Status</Label>
					<Select {...register('status')} options={STATUS} placeholder="Select status…" />
				</div>
				<div>
					<Label>DOJ</Label>
					<Input type="date" {...register('doj')} />
				</div>
				<div>
					<Label>Location</Label>
					<Input {...register('location')} placeholder="Mumbai" />
				</div>
				<div>
					<Label>Talent Manager</Label>
					<Input {...register('talent_manager')} placeholder="Arzoo / Akshita" />
				</div>
				<div className="col-span-2">
					<Label>URLs</Label>
					<div className="space-y-2">
						{urls.fields.map((field, i) => (
							<div key={field.id} className="flex gap-1">
								<Input
									type="url"
									{...register(`url.${i}.value`)}
									placeholder="https://www.instagram.com/…"
								/>
								<Button variant="ghost" onClick={() => urls.remove(i)}>
									✕
								</Button>
							</div>
						))}
						<Button variant="outline" onClick={() => urls.append({ value: '' })}>
							<Icon name="plus" size={13} /> Add URL
						</Button>
					</div>
				</div>
				{requireAttachments && (
					<div className="col-span-2 rounded p-3 mt-1" style={{ background: 'var(--n-bg-soft)' }}>
						<div
							className="text-[11.5px] font-medium uppercase mb-2"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Attachments (required)
						</div>
						<div className="grid grid-cols-2 gap-3">
							{slots.map((slot) => (
								<div key={slot.key}>
									<Label>{slot.label} *</Label>
									<input
										type="file"
										accept="image/*,application/pdf"
										{...register(`attachments.${slot.key}`, {
											validate: (v) => {
												if (slot.exclusiveOnly && getValues('relation') !== 'Exclusive') return true;
												return (v && v.length > 0) || `${slot.label} is required`;
											}
										})}
										className="block w-full text-[12.5px] file:mr-2 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-2 file:py-1 file:text-[12.5px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
									/>
									{errors.attachments?.[slot.key] && (
										<div className="text-[12px] mt-1" style={{ color: '#b91c1c' }}>
											{errors.attachments[slot.key]?.message}
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				)}
				{error && (
					<div
						className="col-span-2 text-[12px] rounded p-2"
						style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
					>
						{error}
					</div>
				)}
			</form>
		</Dialog>
	);
}

export default CreatorFormModal;
