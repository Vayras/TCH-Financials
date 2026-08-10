import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type AppRole = 'super_admin' | 'accounts' | 'tch_member' | 'creator';

@Entity('tch_profile')
export class Profile {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 20, default: 'tch_member' })
  role: AppRole;

  @Column({ length: 20, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'password_set', type: 'boolean', default: true })
  passwordSet: boolean;

  // Links a creator-role user to their tch_creator record
  @Column({ name: 'creator_id', type: 'bigint', nullable: true })
  creatorId: string | null;

  @Column({ name: 'display_name', length: 100, default: '' })
  displayName: string;

  @Column({ name: 'avatar_url', length: 400, default: '' })
  avatarUrl: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
