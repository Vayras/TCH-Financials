import { api, type CreatorDocument } from '@/lib/api';
import type { AttachmentType, CreatorForm } from '@/types/creator';

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

export const REL = [
	{ value: 'Exclusive', label: 'Exclusive' },
	{ value: 'Non-Exclusive', label: 'Non-Exclusive' }
];

export const STATUS = [
	{ value: 'Active', label: 'Active' },
	{ value: 'Inactive', label: 'Inactive' }
];

export const REL_FILTERS = ['All', 'Exclusive', 'Non-Exclusive'];
export const STATUS_FILTERS = ['All', 'Active', 'Inactive'];

// Kept in the existing profile_url column for backwards compatibility.
// Newlines are safe URL separators and allow older single-link records to
// continue working without a schema migration.
export function parseCreatorLinks(value: string | null | undefined): string[] {
	return (value ?? '').split(/[\r\n]+/).map((link) => link.trim()).filter(Boolean);
}

export function serializeCreatorLinks(links: string[]): string {
	return links.map((link) => link.trim()).filter(Boolean).join('\n');
}

export const DOC_TYPES = [
	{ value: 'Contract', label: 'Contract' },
	{ value: 'PAN', label: 'PAN Card' },
	{ value: 'Aadhaar', label: 'Aadhaar Card' },
	{ value: 'Cheque', label: 'Cancelled Cheque' },
	{ value: 'Bank', label: 'Bank Details' },
	{ value: 'GST', label: 'GST' },
	{ value: 'Other', label: 'Other' }
];

// Contract is only collected (and required) for Exclusive creators. It sits
// last so the other slots don't shift when it appears.
export const ATTACH_SLOTS: { key: AttachmentType; label: string; exclusiveOnly?: boolean }[] = [
	{ key: 'PAN', label: 'PAN Card' },
	{ key: 'Aadhaar', label: 'Aadhaar Card' },
	{ key: 'Cheque', label: 'Cancelled Cheque' },
	{ key: 'Contract', label: 'Contract / Agreement', exclusiveOnly: true }
];

export function relTone(rel: string) {
	return rel === 'Exclusive' ? ('exclusive' as const) : ('friend' as const);
}

export function statusTone(status: string) {
	return status === 'Active' ? ('yes' as const) : ('no' as const);
}

export async function uploadCreatorDocument(
	creatorId: number,
	docType: string,
	file: File,
	label = ''
): Promise<CreatorDocument> {
	const fd = new FormData();
	fd.append('creator', String(creatorId));
	fd.append('doc_type', docType);
	fd.append('label', label);
	fd.append('file', file);
	return api.upload<CreatorDocument>('/creator-documents/', fd);
}
