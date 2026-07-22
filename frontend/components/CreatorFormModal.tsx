'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { api, type CreatorDocument } from '@/lib/api';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import { formatDocDate } from '@/lib/utils';
import type { AttachmentType, CreatorForm } from '@/types/creator';
import { ATTACH_SLOTS, REL, STATUS } from '@/lib/creators';

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
	/** Require every document slot (creating). When false (editing), slots are optional uploads. */
	requireAttachments?: boolean;
	/** Existing creator being edited — enables the on-file document list. */
	creatorId?: number | null;
}

export function CreatorFormModal({
	open,
	onOpenChange,
	title,
	submitLabel,
	initial,
	onSubmit,
	error,
	requireAttachments = false,
	creatorId = null
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

	const [urlError, setUrlError] = React.useState<string | null>(null);

	// Documents already on file (edit mode only).
	const [existingDocs, setExistingDocs] = React.useState<CreatorDocument[]>([]);
	const [docsLoading, setDocsLoading] = React.useState(false);

	const loadDocs = React.useCallback(async () => {
		if (!creatorId) return;
		setDocsLoading(true);
		try {
			setExistingDocs(await api.get<CreatorDocument[]>(`/creator-documents/?creator=${creatorId}`));
		} catch (e) {
			alert((e as Error).message);
		} finally {
			setDocsLoading(false);
		}
	}, [creatorId]);

	React.useEffect(() => {
		if (open) {
			reset(toValues(initial));
			setUrlError(null);
			if (creatorId) loadDocs();
			else setExistingDocs([]);
		}
	}, [open, initial, reset, creatorId, loadDocs]);

	async function deleteDoc(id: number) {
		if (!confirm('Delete this document?')) return;
		try {
			await api.del(`/creator-documents/${id}/`);
			await loadDocs();
		} catch (e) {
			alert((e as Error).message);
		}
	}

	const relation = watch('relation');
	const slots = ATTACH_SLOTS.filter((s) => !s.exclusiveOnly || relation === 'Exclusive');
	const onFileTypes = new Set(existingDocs.map((d) => d.doc_type));

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
				onSubmit={handleSubmit(async (v) => {
					if (v.url.map((u) => u.value.trim()).filter(Boolean).length === 0) {
						setUrlError('At least one URL is required');
						return;
					}
					setUrlError(null);
					await onSubmit(fromValues(v));
				})}
				className="grid grid-cols-2 gap-3"
			>
				<div className="col-span-2">
					<Label>Name</Label>
					<Input
						{...register('name', { required: 'Name is required' })}
						placeholder="Saili Satwe"
					/>
					{errors.name && (
						<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
							{errors.name.message}
						</div>
					)}
				</div>
				<div>
					<Label>Niche</Label>
					<Input
						{...register('niche', { required: 'Niche is required' })}
						placeholder="Lifestyle / Fashion"
					/>
					{errors.niche && (
						<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
							{errors.niche.message}
						</div>
					)}
				</div>
				<div>
					<Label>Relation</Label>
					<Select
						{...register('relation', { required: 'Relation is required' })}
						options={REL}
						placeholder="Select relation…"
					/>
					{errors.relation && (
						<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
							{errors.relation.message}
						</div>
					)}
				</div>
				{relation !== 'Non-Exclusive' && (
					<div>
						<Label>Status</Label>
						<Select
							{...register('status', {
								required: relation !== 'Non-Exclusive' ? 'Status is required' : false
							})}
							options={STATUS}
							placeholder="Select status…"
						/>
						{errors.status && (
							<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
								{errors.status.message}
							</div>
						)}
					</div>
				)}
				{relation !== 'Non-Exclusive' && (
					<div>
						<Label>DOJ</Label>
						<Input
							type="date"
							{...register('doj', {
								required: relation !== 'Non-Exclusive' ? 'DOJ is required' : false
							})}
						/>
						{errors.doj && (
							<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
								{errors.doj.message}
							</div>
						)}
					</div>
				)}
				<div>
					<Label>Location</Label>
					<Input
						{...register('location', { required: 'Location is required' })}
						placeholder="Mumbai"
					/>
					{errors.location && (
						<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
							{errors.location.message}
						</div>
					)}
				</div>
				<div>
					<Label>Talent Manager</Label>
					<Input
						{...register('talent_manager', { required: 'Talent Manager is required' })}
						placeholder="Arzoo / Akshita"
					/>
					{errors.talent_manager && (
						<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
							{errors.talent_manager.message}
						</div>
					)}
				</div>
				<div className="col-span-2">
					<Label>URLs</Label>
					<div className="space-y-2">
						{urls.fields.map((field, i) => (
							<div key={field.id} className="flex gap-1">
								<Input
									type="url"
									{...register(`url.${i}.value`, { required: 'URL cannot be empty' })}
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
					{(urlError || errors.url) && (
						<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
							{urlError ?? 'URL cannot be empty'}
						</div>
					)}
				</div>

				{creatorId !== null && (
					<div className="col-span-2 rounded p-3 mt-1" style={{ background: 'var(--n-bg-soft)' }}>
						<div
							className="text-[11.5px] font-medium uppercase mb-2"
							style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
						>
							Documents on file
						</div>
						{docsLoading ? (
							<div className="text-[13px] py-3 text-center" style={{ color: 'var(--n-fg-subtle)' }}>
								Loading…
							</div>
						) : existingDocs.length === 0 ? (
							<div
								className="text-[13px] rounded p-3 text-center"
								style={{ border: '1px dashed var(--n-border)', color: 'var(--n-fg-subtle)' }}
							>
								No documents uploaded yet — add them below.
							</div>
						) : (
							<ul
								className="rounded border divide-y"
								style={{ borderColor: 'var(--n-border)', background: 'var(--n-bg)' }}
							>
								{existingDocs.map((d) => (
									<li key={d.id} className="flex items-center gap-2 px-3 py-2">
										<Tag tone="neutral">{d.doc_type}</Tag>
										<div className="min-w-0 flex-1">
											<a
												className="inline-link text-[13px] font-medium"
												href={d.file}
												target="_blank"
												rel="noopener"
											>
												{d.label || d.file.split('/').pop()} ↗
											</a>
											<div className="text-[11.5px]" style={{ color: 'var(--n-fg-subtle)' }}>
												Uploaded {formatDocDate(d.uploaded_at)}
											</div>
										</div>
										<Button variant="danger" onClick={() => deleteDoc(d.id)}>
											Del
										</Button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}

				<div className="col-span-2 rounded p-3 mt-1" style={{ background: 'var(--n-bg-soft)' }}>
					<div
						className="text-[11.5px] font-medium uppercase mb-2"
						style={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em' }}
					>
						{requireAttachments && relation !== 'Non-Exclusive' ? 'Attachments (required)' : 'Upload / replace documents'}
					</div>
					<div className="grid grid-cols-2 gap-3">
						{slots.map((slot) => (
							<div key={slot.key}>
								<Label>
									{slot.label}
									{requireAttachments && relation !== 'Non-Exclusive' ? ' *' : ''}
									{!requireAttachments && onFileTypes.has(slot.key) && (
										<span className="ml-1" style={{ color: 'var(--n-fg-subtle)' }}>
											(on file ✓)
										</span>
									)}
								</Label>
								<input
									type="file"
									accept="image/*,application/pdf"
									{...register(`attachments.${slot.key}`, {
										validate: (v) => {
											if (!requireAttachments) return true;
											if (getValues('relation') === 'Non-Exclusive') return true;
											if (slot.exclusiveOnly && getValues('relation') !== 'Exclusive') return true;
											return (v && v.length > 0) || `${slot.label} is required`;
										}
									})}
									className="block w-full text-[12.5px] file:mr-2 file:rounded file:border file:border-[var(--n-border)] file:bg-[var(--n-bg)] file:px-2 file:py-1 file:text-[12.5px] file:text-[var(--n-fg)] hover:file:border-[var(--n-border-strong)]"
								/>
								{errors.attachments?.[slot.key] && (
									<div className="text-[12px] mt-1" style={{ color: 'var(--color-danger)' }}>
										{errors.attachments[slot.key]?.message}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
				{error && (
					<div
						className="col-span-2 text-[12px] rounded p-2"
						style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger-border)' }}
					>
						{error}
					</div>
				)}
			</form>
		</Dialog>
	);
}

export default CreatorFormModal;
