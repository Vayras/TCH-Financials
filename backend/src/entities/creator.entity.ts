import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('tch_creator')
export class Creator {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ length: 200, unique: true })
  name: string;

  @Column({ length: 200, default: '' })
  category: string;

  // EMW | TCH | OTHER | ''
  @Column({ length: 20, default: '' })
  source: string;

  // Lead | Discussing | Closed | Dropped | ''
  @Column({ length: 20, default: '' })
  stage: string;

  // Exclusive | Friend | Dropping | NonTCH
  @Column({ length: 20, default: 'Friend' })
  relationship: string;

  // Active | Inactive
  @Column({ length: 10, default: 'Active' })
  status: string;

  @Column({ type: 'date', nullable: true })
  doj: string | null;

  @Column({ name: 'doj_note', length: 120, default: '' })
  dojNote: string;

  @Column({ name: 'profile_url', length: 400, default: '' })
  profileUrl: string;

  @Column({ length: 80, default: '' })
  location: string;

  @Column({ name: 'ops_manager', length: 80, default: '' })
  opsManager: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'int', default: 1 })
  version: number;
}
