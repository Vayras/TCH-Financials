import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tch_invitation')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 20, default: 'member' })
  role: 'admin' | 'member';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;
}
