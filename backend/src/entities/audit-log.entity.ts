import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tch_audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_email', length: 255, default: '' })
  actorEmail: string;

  @Column({ name: 'actor_role', length: 20, default: '' })
  actorRole: string;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 500 })
  path: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 120, nullable: true })
  resourceId: string | null;

  @Column({ name: 'field_names', type: 'jsonb', default: () => "'[]'::jsonb" })
  fieldNames: string[];

  @Column({ name: 'response_status', type: 'smallint' })
  responseStatus: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
