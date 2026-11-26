export type BriefContent = {
  schema_version: 1;
  objective: string;
  product_context: string;
  audience: string;
  mandatory_messages: string[];
  no_mandatory_messages: boolean;
  creative_direction: string;
  prohibited_claims: string[];
  call_to_action: string;
  disclosure: string;
  tags: string[];
  languages: string[];
  deliverables: {
    id: string;
    platform: 'instagram' | 'youtube' | 'linkedin' | 'other';
    format: string;
    quantity: number;
    specifications: string;
    due_date: string;
  }[];
  references: { label: string; url: string }[];
};
export type AgencyBrief = {
  campaign: { id: string; name: string; brand: string };
  version: number;
  draft: BriefContent;
  shared_version: number | null;
  shared_revision_id: string | null;
  shared_at: string | null;
  recipient_count: number;
  capabilities: { can_edit: boolean; can_share: boolean; can_manage_assignments: boolean };
};
export type SharedBrief = {
  id: string;
  name: string;
  brand: string;
  shared_revision_id: string;
  shared_version: number;
  shared_at: string;
  content: BriefContent;
};
export type CreatorBriefView =
  | (SharedBrief & { brief_shared: true; brief_assigned: true })
  | {
      id: string;
      name: string;
      brand: string;
      brief_shared: false;
      // false when the creator only reaches this campaign through a deal
      brief_assigned: boolean;
      shared_revision_id: null;
      shared_version: null;
      shared_at: null;
      content: null;
    };
export type CreatorCampaignSummary = {
  id: string;
  name: string;
  brand: string;
  shared_revision_id: string | null;
  shared_version: number | null;
  shared_at: string | null;
  brief_shared: boolean;
  brief_assigned: boolean;
};
export type Assignments = {
  version: number;
  members: { user_id: string; can_publish: boolean; email: string; display_name: string }[];
  creators: { creator_id: string; name: string }[];
};
export type AssignmentOptions = {
  members: { user_id: string; email: string; display_name: string }[];
  creators: { creator_id: string; name: string; profiles: { email: string; user_id: string }[] }[];
  has_more: boolean;
};
