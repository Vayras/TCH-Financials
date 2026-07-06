import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Creator } from './creator.entity';

// Log of creators who left TCH.
@Entity('tch_dropoff')
export class DropOff {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'creator_id', type: 'bigint', nullable: true })
  creatorId: string | null;

  @ManyToOne(() => Creator, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator | null;

  @Column({ name: 'creator_name_raw', length: 200, default: '' })
  creatorNameRaw: string;

  @Column({ name: 'drop_off_date', type: 'date', nullable: true })
  dropOffDate: string | null;

  @Column({ name: 'drop_off_date_note', length: 120, default: '' })
  dropOffDateNote: string;

  @Column({ type: 'text', default: '' })
  reason: string;

  @Column({ type: 'text', default: '' })
  learning: string;

  @Column({ length: 80, default: '' })
  duration: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'int', default: 1 })
  version: number;
}
