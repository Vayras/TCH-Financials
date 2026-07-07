import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Campaign } from './campaign.entity';
import { Creator } from './creator.entity';
import { DealCreatorShare } from './deal-creator-share.entity';

// Single source of truth for money. Overview / entity summary / insights are
// derived from this table, never stored.
@Entity('tch_commercialdeal')
export class CommercialDeal {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'confirmation_date', type: 'date', nullable: true })
  confirmationDate: string | null;

  @Column({ name: 'e_invoice_date', type: 'date', nullable: true })
  eInvoiceDate: string | null;

  @Column({ name: 'creator_id', type: 'bigint', nullable: true })
  creatorId: string | null;

  @ManyToOne(() => Creator, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator | null;

  // Raw name string for non-TCH / outsiders without a Creator row
  @Column({ name: 'creator_name_raw', length: 200, default: '' })
  creatorNameRaw: string;

  @Column({ name: 'tch_poc', length: 120, default: '' })
  tchPoc: string;

  @Column({ name: 'agency_commission_agreed', length: 120, default: '' })
  agencyCommissionAgreed: string;

  // Inbound | Outbound | MarkUp
  @Column({ length: 16, default: 'Outbound' })
  direction: string;

  @Column({ name: 'total_fee', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalFee: string;

  // Fractional, e.g. 0.20 = 20%
  @Column({ name: 'agency_fee_pct', type: 'numeric', precision: 6, scale: 4, default: 0 })
  agencyFeePct: string;

  // Profit to TCH
  @Column({ name: 'agency_fee_inr', type: 'numeric', precision: 14, scale: 2, default: 0 })
  agencyFeeInr: string;

  @Column({ name: 'creator_fee', type: 'numeric', precision: 14, scale: 2, default: 0 })
  creatorFee: string;

  @Column({ name: 'billing_entity', length: 120, default: '' })
  billingEntity: string;

  @Column({ length: 200, default: '' })
  brand: string;

  @Column({ name: 'brand_poc', length: 200, default: '' })
  brandPoc: string;

  @Column({ name: 'campaign_id', type: 'bigint', nullable: true })
  campaignId: string | null;

  @ManyToOne(() => Campaign, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign | null;

  @Column({ length: 255, default: '' })
  deliverables: string;

  @Column({ name: 'ro_number', length: 80, default: '' })
  roNumber: string;

  // Y/N flags ('Y' | 'N' | '')
  @Column({ name: 'campaign_over', length: 1, default: '' })
  campaignOver: string;

  @Column({ name: 'invoice_received', length: 1, default: '' })
  invoiceReceived: string;

  @Column({ name: 'payment_cleared', length: 1, default: '' })
  paymentCleared: string;

  @Column({ name: 'e_invoice_number', length: 80, default: '' })
  eInvoiceNumber: string;

  @Column({ name: 'payment_received', length: 1, default: '' })
  paymentReceived: string;

  // --- Finance: Client Invoice (TCH -> Client) ---
  @Column({ name: 'client_invoice_number', length: 120, default: '' })
  clientInvoiceNumber: string;

  @Column({ name: 'client_invoice_date', type: 'date', nullable: true })
  clientInvoiceDate: string | null;

  @Column({ name: 'client_invoice_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  clientInvoiceAmount: string;

  // Pending | Partial | Received | Overdue | ''
  @Column({ name: 'client_payment_status', length: 20, default: '' })
  clientPaymentStatus: string;

  @Column({ name: 'client_payment_received_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  clientPaymentReceivedAmount: string;

  @Column({ name: 'client_payment_date', type: 'date', nullable: true })
  clientPaymentDate: string | null;

  // --- Finance: Creator Invoice (Creator -> TCH) ---
  @Column({ name: 'creator_invoice_number', length: 120, default: '' })
  creatorInvoiceNumber: string;

  @Column({ name: 'creator_invoice_date', type: 'date', nullable: true })
  creatorInvoiceDate: string | null;

  @Column({ name: 'creator_invoice_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  creatorInvoiceAmount: string;

  // Pending | Scheduled | Paid | Overdue | ''
  @Column({ name: 'creator_payment_status', length: 20, default: '' })
  creatorPaymentStatus: string;

  // Immediate | Net15 | Net30 | Net45 | Net60 | ''
  @Column({ name: 'creator_payment_cycle', length: 20, default: '' })
  creatorPaymentCycle: string;

  @Column({ name: 'creator_payment_date', type: 'date', nullable: true })
  creatorPaymentDate: string | null;

  @Column({ type: 'text', default: '' })
  comments: string;

  // Set when both invoices are on file (see DealDocumentsController) — the
  // anchor date for the "clear payment" alert's Wednesday-cycle math.
  @Column({ name: 'completed_at', type: 'date', nullable: true })
  completedAt: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'int', default: 1 })
  version: number;

  @OneToMany(() => DealCreatorShare, (s) => s.deal)
  creatorShares: DealCreatorShare[];
}
