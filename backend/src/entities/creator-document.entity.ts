import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Creator } from './creator.entity';

@Entity('tch_creatordocument')
export class CreatorDocument {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'creator_id', type: 'bigint' })
  creatorId: string;

  @ManyToOne(() => Creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  // Contract | Agreement | PAN | Aadhaar | Cheque | Bank | GST | Other
  @Column({ name: 'doc_type', length: 20, default: 'Other' })
  docType: string;

  @Column({ length: 200, default: '' })
  label: string;

  // Relative media path, e.g. creator_docs/3/agreement.pdf
  @Column({ length: 300, default: '' })
  file: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;
}
