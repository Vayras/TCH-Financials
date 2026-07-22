import {
  Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { CommercialDeal } from './commercial-deal.entity';
import { Creator } from './creator.entity';

// Per-creator split of a deal's billing. A deal with no shares falls back to
// its single creator in aggregations (legacy behaviour).
@Entity('tch_dealcreatorshare')
export class DealCreatorShare {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'deal_id', type: 'bigint' })
  dealId: string;

  @ManyToOne(() => CommercialDeal, (d) => d.creatorShares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: CommercialDeal;

  @Column({ name: 'creator_id', type: 'bigint', nullable: true })
  creatorId: string | null;

  @ManyToOne(() => Creator, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator | null;

  @Column({ name: 'creator_name_raw', length: 200, default: '' })
  creatorNameRaw: string;

  @Column({ name: 'total_fee', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalFee: string;

  @Column({ name: 'agency_fee_pct', type: 'numeric', precision: 6, scale: 4, default: 0 })
  agencyFeePct: string;

  @Column({ name: 'agency_fee_inr', type: 'numeric', precision: 14, scale: 2, default: 0 })
  agencyFeeInr: string;

  @Column({ name: 'creator_fee', type: 'numeric', precision: 14, scale: 2, default: 0 })
  creatorFee: string;

  @Column({ name: 'ro_number', length: 80, default: '' })
  roNumber: string;
}
