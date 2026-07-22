import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { CommercialDeal } from './commercial-deal.entity';

@Entity('tch_dealdocument')
export class DealDocument {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'deal_id', type: 'bigint' })
  dealId: string;

  @ManyToOne(() => CommercialDeal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deal_id' })
  deal: CommercialDeal;

  // ClientInvoice | CreatorInvoice
  @Column({ name: 'doc_type', length: 20, default: 'ClientInvoice' })
  docType: string;

  @Column({ length: 200, default: '' })
  label: string;

  // Relative media path, e.g. deal_docs/3/invoice.pdf
  @Column({ length: 500, default: '' })
  file: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;
}
