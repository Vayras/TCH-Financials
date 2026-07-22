import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommercialDeal } from './commercial-deal.entity';
import { Creator } from './creator.entity';

@Entity('tch_creatorinvoice')
export class CreatorInvoice {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'deal_id', type: 'bigint' })
  dealId: string;

  @ManyToOne(() => CommercialDeal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: CommercialDeal;

  @Column({ name: 'creator_id', type: 'bigint' })
  creatorId: string;

  @ManyToOne(() => Creator, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  @Column({ name: 'invoice_number', length: 120, default: '' })
  invoiceNumber: string;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate: string | null;

  @Column({ name: 'invoice_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  invoiceAmount: string;

  // Pending | Scheduled | Paid | Overdue | ''
  @Column({ name: 'payment_status', length: 20, default: '' })
  paymentStatus: string;

  // Immediate | Net15 | Net30 | Net45 | Net60 | ''
  @Column({ name: 'payment_cycle', length: 20, default: '' })
  paymentCycle: string;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ length: 200, default: '' })
  label: string;

  @Column({ length: 500, default: '' })
  file: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'int', default: 1 })
  version: number;
}
