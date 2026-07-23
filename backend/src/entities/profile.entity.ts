import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('tch_profile')
export class Profile {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 20, default: 'member' })
  role: 'admin' | 'member';

  @Column({ length: 20, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'password_set', type: 'boolean', default: true })
  passwordSet: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
