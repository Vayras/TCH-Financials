import type { Deal } from '@/lib/api';

export type DealForm = {
	confirmation_date: string;
	e_invoice_date: string;
	creator: string;
	tch_poc: string;
	direction: string;
	total_fee: string;
	agency_fee_pct: string;
	agency_fee_inr: string;
	creator_fee: string;
	billing_entity: string;
	brand: string;
	brand_poc: string;
	campaign: string;
	deliverables: string;
	ro_number: string;
	comments: string;
};

// One extra creator on a multi-creator campaign. The first/primary creator
// lives in the main form fields; these are the additional split rows.
export type ShareForm = {
	creator: string;
	total_fee: string;
	agency_fee_inr: string;
};

export type DirFilter = 'All' | 'Inbound' | 'Outbound';

// Card grouping: one card per campaign (default), or rolled up by creator.
export type CardGroupBy = 'campaign' | 'creator';

export type CampaignGroup = {
	key: string;
	name: string;
	brand: string;
	status: '' | 'Active' | 'Over';
	creatorNames: string[];
	deals: Deal[];
	total: number;
};

export type CreatorGroup = {
	key: string;
	name: string;
	relationship?: string;
	deals: Deal[];
	total: number;
};
