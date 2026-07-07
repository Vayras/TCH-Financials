// Wire-format serializers. Field names and shapes must match the DRF
// serializers the frontend was built against (see frontend/lib/api.ts types):
// snake_case keys, FK columns exposed under the bare relation name ('creator',
// 'campaign_id'), decimals as strings, ids as numbers.

import {
  Campaign, CommercialDeal, ContractingCompliance, Creator, CreatorDocument,
  DealCreatorShare, DealDocument, DropOff, EmployeeWeeklyReport, EventInvite,
  SocialMediaSnapshot,
} from '../entities';

const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

const ts = (d: Date | null | undefined): string | null =>
  d ? new Date(d).toISOString() : null;

export function creatorDto(c: Creator) {
  return {
    id: Number(c.id),
    name: c.name,
    category: c.category,
    source: c.source,
    stage: c.stage,
    relationship: c.relationship,
    status: c.status,
    doj: c.doj,
    doj_note: c.dojNote,
    profile_url: c.profileUrl,
    location: c.location,
    ops_manager: c.opsManager,
    notes: c.notes,
    created_at: ts(c.createdAt),
    updated_at: ts(c.updatedAt),
    version: c.version,
  };
}

export function creatorDocumentDto(d: CreatorDocument) {
  return {
    id: Number(d.id),
    creator: Number(d.creatorId),
    creator_name: d.creator?.name ?? '',
    doc_type: d.docType,
    label: d.label,
    file: d.file ? `/media/${d.file}` : '',
    uploaded_at: ts(d.uploadedAt),
  };
}

export function contractingDto(c: ContractingCompliance) {
  return {
    id: Number(c.id),
    creator: Number(c.creatorId),
    creator_name: c.creator?.name ?? '',
    final_meeting: c.finalMeeting,
    agreement_sent: c.agreementSent,
    agreement_signed: c.agreementSigned,
    bank_verified: c.bankVerified,
    time_to_sign: c.timeToSign,
    renewal_date: c.renewalDate,
    renewal_note: c.renewalNote,
    version: c.version,
  };
}

export function campaignDto(c: Campaign, dealCount: number) {
  return {
    id: Number(c.id),
    name: c.name,
    brand: c.brand,
    status: c.status,
    start_date: c.startDate,
    end_date: c.endDate,
    notes: c.notes,
    deal_count: dealCount,
    created_at: ts(c.createdAt),
    version: c.version,
  };
}

export function shareDto(s: DealCreatorShare) {
  return {
    id: Number(s.id),
    creator: num(s.creatorId),
    creator_name: s.creatorId && s.creator ? s.creator.name : s.creatorNameRaw,
    creator_relationship: s.creatorId && s.creator ? s.creator.relationship : 'NonTCH',
    creator_name_raw: s.creatorNameRaw,
    total_fee: s.totalFee,
    agency_fee_pct: s.agencyFeePct,
    agency_fee_inr: s.agencyFeeInr,
    creator_fee: s.creatorFee,
  };
}

export function dealDto(d: CommercialDeal) {
  return {
    id: Number(d.id),
    confirmation_date: d.confirmationDate,
    e_invoice_date: d.eInvoiceDate,
    creator: num(d.creatorId),
    creator_name: d.creatorId && d.creator ? d.creator.name : d.creatorNameRaw,
    creator_name_raw: d.creatorNameRaw,
    creator_relationship: d.creatorId && d.creator ? d.creator.relationship : 'NonTCH',
    tch_poc: d.tchPoc,
    agency_commission_agreed: d.agencyCommissionAgreed,
    direction: d.direction,
    total_fee: d.totalFee,
    agency_fee_pct: d.agencyFeePct,
    agency_fee_inr: d.agencyFeeInr,
    creator_fee: d.creatorFee,
    billing_entity: d.billingEntity,
    brand: d.brand,
    brand_poc: d.brandPoc,
    campaign: d.campaign?.name ?? null,
    campaign_id: num(d.campaignId),
    campaign_status: d.campaign?.status ?? '',
    deliverables: d.deliverables,
    ro_number: d.roNumber,
    campaign_over: d.campaignOver,
    invoice_received: d.invoiceReceived,
    payment_cleared: d.paymentCleared,
    e_invoice_number: d.eInvoiceNumber,
    payment_received: d.paymentReceived,
    client_invoice_number: d.clientInvoiceNumber,
    client_invoice_date: d.clientInvoiceDate,
    client_invoice_amount: d.clientInvoiceAmount,
    client_payment_status: d.clientPaymentStatus,
    client_payment_received_amount: d.clientPaymentReceivedAmount,
    client_payment_date: d.clientPaymentDate,
    creator_invoice_number: d.creatorInvoiceNumber,
    creator_invoice_date: d.creatorInvoiceDate,
    creator_invoice_amount: d.creatorInvoiceAmount,
    creator_payment_status: d.creatorPaymentStatus,
    creator_payment_cycle: d.creatorPaymentCycle,
    creator_payment_date: d.creatorPaymentDate,
    comments: d.comments,
    completed_at: d.completedAt,
    created_at: ts(d.createdAt),
    creator_shares: (d.creatorShares ?? []).map(shareDto),
    version: d.version,
  };
}

export function dealDocumentDto(d: DealDocument) {
  return {
    id: Number(d.id),
    deal: Number(d.dealId),
    doc_type: d.docType,
    label: d.label,
    file: d.file ? `/media/${d.file}` : '',
    uploaded_at: ts(d.uploadedAt),
  };
}

export function dropOffDto(d: DropOff) {
  return {
    id: Number(d.id),
    creator: num(d.creatorId),
    creator_name: d.creatorId && d.creator ? d.creator.name : d.creatorNameRaw,
    creator_name_raw: d.creatorNameRaw,
    drop_off_date: d.dropOffDate,
    drop_off_date_note: d.dropOffDateNote,
    reason: d.reason,
    learning: d.learning,
    duration: d.duration,
    created_at: ts(d.createdAt),
    version: d.version,
  };
}

export function snapshotDto(s: SocialMediaSnapshot) {
  return {
    id: Number(s.id),
    creator: Number(s.creatorId),
    creator_name: s.creator?.name ?? '',
    snapshot_type: s.snapshotType,
    snapshot_date: s.snapshotDate,
    platform: s.platform,
    followers: s.followers,
    engagement_rate: s.engagementRate,
    estimated_reach: s.estimatedReach,
    revenue_last_3m: s.revenueLast3m,
    notes: s.notes,
    created_at: ts(s.createdAt),
    version: s.version,
  };
}

export function eventInviteDto(e: EventInvite) {
  return {
    id: Number(e.id),
    creator: Number(e.creatorId),
    creator_name: e.creator?.name ?? '',
    event_name: e.eventName,
    event_date: e.eventDate,
    invited_date: e.invitedDate,
    response: e.response,
    notes: e.notes,
    created_at: ts(e.createdAt),
    version: e.version,
  };
}

export function employeeReportDto(r: EmployeeWeeklyReport) {
  return {
    id: Number(r.id),
    week_ending: r.weekEnding,
    employee_name: r.employeeName,
    new_outreach: r.newOutreach,
    paid_confirmations: r.paidConfirmations,
    revenue_locked: r.revenueLocked,
    profit_locked: r.profitLocked,
    barter_confirmations: r.barterConfirmations,
    live_campaigns: r.liveCampaigns,
    action_points: r.actionPoints,
    version: r.version,
  };
}
