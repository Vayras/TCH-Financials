import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { CommercialDeal } from './commercial-deal.entity';
import { Creator } from './creator.entity';

@Entity('tch_payment_transaction')
export class PaymentTransaction {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: string;

  @Column({ name: 'vendor_name', length: 200 })
  vendorName: string;

  @Column({ name: 'utr_or_ref', length: 120 })
  utrOrRef: string;

  @Column({ name: 'debit_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  debitAmount: string;

  @Column({ name: 'credit_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  creditAmount: string;

  @Column({ name: 'deal_id', type: 'bigint', nullable: true })
  dealId: string | null;

  @ManyToOne(() => CommercialDeal, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'deal_id' })
  deal: CommercialDeal | null;

  @Column({ name: 'creator_id', type: 'bigint', nullable: true })
  creatorId: string | null;

  @ManyToOne(() => Creator, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator | null;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
