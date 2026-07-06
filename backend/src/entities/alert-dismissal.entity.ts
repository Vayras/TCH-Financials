import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A dismissed ('cleared') alert on the Alerts page. Alerts are recomputed from
// live data on every load, so clearing one means remembering its stable key
// here and filtering it out of the payload.
@Entity('tch_alertdismissal')
export class AlertDismissal {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ length: 255, unique: true })
  key: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
