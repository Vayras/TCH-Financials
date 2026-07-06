import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Creator } from './creator.entity';

// A creator's social media stats at a point in time.
@Entity('tch_socialmediasnapshot')
export class SocialMediaSnapshot {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'creator_id', type: 'bigint' })
  creatorId: string;

  @ManyToOne(() => Creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  // Baseline | Quarterly
  @Column({ name: 'snapshot_type', length: 20, default: 'Quarterly' })
  snapshotType: string;

  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate: string;

  @Column({ length: 40, default: 'Instagram' })
  platform: string;

  @Column({ type: 'int', default: 0 })
  followers: number;

  // As percentage, e.g. 3.5 = 3.5%
  @Column({ name: 'engagement_rate', type: 'numeric', precision: 6, scale: 3, default: 0 })
  engagementRate: string;

  @Column({ name: 'estimated_reach', type: 'int', default: 0 })
  estimatedReach: number;

  @Column({ name: 'revenue_last_3m', type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenueLast3m: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'int', default: 1 })
  version: number;
}
