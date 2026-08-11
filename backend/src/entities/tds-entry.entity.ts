import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { CommercialDeal } from './commercial-deal.entity';
import { Creator } from './creator.entity';

@Entity('tch_tds_entry')
export class TdsEntry {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'creator_id', type: 'bigint' })
  creatorId: string;

  @ManyToOne(() => Creator, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  @Column({ name: 'deal_id', type: 'bigint', nullable: true })
  dealId: string | null;

  @ManyToOne(() => CommercialDeal, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'deal_id' })
  deal: CommercialDeal | null;

  @Column({ length: 20 })
  quarter: string; // Q1, Q2, Q3, Q4

  @Column({ name: 'tds_rate', type: 'numeric', precision: 6, scale: 4, default: 0 })
  tdsRate: string;

  @Column({ name: 'gross_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  grossAmount: string;

  @Column({ name: 'tds_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  tdsAmount: string;

  @Column({ name: 'net_payable', type: 'numeric', precision: 14, scale: 2, default: 0 })
  netPayable: string;

  @Column({ name: 'remittance_date', type: 'date', nullable: true })
  remittanceDate: string | null;

  @Column({ name: 'challan_number', length: 120, default: '' })
  challanNumber: string;

  @Column({ length: 20, default: 'Pending' })
  status: 'Pending' | 'Remitted';

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
