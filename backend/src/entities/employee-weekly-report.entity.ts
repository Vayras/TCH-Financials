import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tch_employeeweeklyreport')
export class EmployeeWeeklyReport {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'week_ending', type: 'date', nullable: true })
  weekEnding: string | null;

  @Column({ name: 'employee_name', length: 120 })
  employeeName: string;

  @Column({ name: 'new_outreach', type: 'int', default: 0 })
  newOutreach: number;

  @Column({ name: 'paid_confirmations', length: 255, default: '' })
  paidConfirmations: string;

  @Column({ name: 'revenue_locked', type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenueLocked: string;

  @Column({ name: 'profit_locked', type: 'numeric', precision: 14, scale: 2, default: 0 })
  profitLocked: string;

  @Column({ name: 'barter_confirmations', length: 255, default: '' })
  barterConfirmations: string;

  @Column({ name: 'live_campaigns', type: 'int', default: 0 })
  liveCampaigns: number;

  @Column({ name: 'action_points', type: 'text', default: '' })
  actionPoints: string;

  @Column({ type: 'int', default: 1 })
  version: number;
}
