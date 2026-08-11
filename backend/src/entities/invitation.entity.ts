import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { type AppRole } from './profile.entity';

@Entity('tch_invitation')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 20, default: 'tch_member' })
  role: AppRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;
}
