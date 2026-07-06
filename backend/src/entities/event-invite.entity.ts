import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Creator } from './creator.entity';

// Event invitations sent to creators and their responses.
@Entity('tch_eventinvite')
export class EventInvite {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'creator_id', type: 'bigint' })
  creatorId: string;

  @ManyToOne(() => Creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  @Column({ name: 'event_name', length: 255 })
  eventName: string;

  @Column({ name: 'event_date', type: 'date' })
  eventDate: string;

  @Column({ name: 'invited_date', type: 'date', nullable: true })
  invitedDate: string | null;

  // Accepted | Declined | NoResponse | ''
  @Column({ length: 20, default: '' })
  response: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'int', default: 1 })
  version: number;
}
