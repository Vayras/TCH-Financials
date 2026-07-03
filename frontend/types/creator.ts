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
