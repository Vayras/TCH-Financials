import {
  Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Creator } from './creator.entity';

@Entity('tch_contractingcompliance')
export class ContractingCompliance {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'creator_id', type: 'bigint', unique: true })
  creatorId: string;

  @OneToOne(() => Creator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: Creator;

  @Column({ name: 'final_meeting', length: 1, default: '' })
  finalMeeting: string;

  @Column({ name: 'agreement_sent', length: 1, default: '' })
  agreementSent: string;

  @Column({ name: 'agreement_signed', length: 1, default: '' })
  agreementSigned: string;

  @Column({ name: 'bank_verified', length: 1, default: '' })
  bankVerified: string;

  @Column({ name: 'time_to_sign', length: 120, default: '' })
  timeToSign: string;

  @Column({ name: 'renewal_date', type: 'date', nullable: true })
  renewalDate: string | null;

  @Column({ name: 'renewal_note', length: 120, default: '' })
  renewalNote: string;

  @Column({ type: 'int', default: 1 })
  version: number;
}
