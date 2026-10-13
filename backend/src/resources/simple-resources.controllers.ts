import { BadRequestException, Body, ConflictException, Controller, Get, Put, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  contractingDto, dropOffDto, employeeReportDto, eventInviteDto, snapshotDto,
} from '../common/serializers';
import {
  ContractingCompliance, DropOff, EmployeeWeeklyReport, EventInvite,
  SocialMediaSnapshot,
} from '../entities';
import { VersionedCrudBase } from './versioned-crud.base';
import { Roles } from '../auth/roles.decorator';

@Roles('super_admin', 'tch_member')
@Controller('contracting')
export class ContractingController extends VersionedCrudBase<ContractingCompliance> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, {
      entity: ContractingCompliance,
      dto: contractingDto,
      relations: ['creator'],
      order: { id: 'ASC' },
      creatorFilter: true,
      fields: {
        creator: 'creatorId',
        final_meeting: 'finalMeeting',
        agreement_sent: 'agreementSent',
        agreement_signed: 'agreementSigned',
        bank_verified: 'bankVerified',
        time_to_sign: 'timeToSign',
        renewal_date: 'renewalDate',
        renewal_note: 'renewalNote',
      },
    });
  }
}

@Roles('super_admin', 'tch_member')
@Controller('dropoffs')
export class DropOffsController extends VersionedCrudBase<DropOff> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, {
      entity: DropOff,
      dto: dropOffDto,
      relations: ['creator'],
      order: { dropOffDate: 'DESC', id: 'DESC' },
      fields: {
        creator: 'creatorId',
        creator_name_raw: 'creatorNameRaw',
        drop_off_date: 'dropOffDate',
        drop_off_date_note: 'dropOffDateNote',
        reason: 'reason',
        learning: 'learning',
        duration: 'duration',
      },
    });
  }
}

@Roles('super_admin', 'tch_member')
@Controller('social-snapshots')
export class SocialSnapshotsController extends VersionedCrudBase<SocialMediaSnapshot> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, {
      entity: SocialMediaSnapshot,
      dto: snapshotDto,
      relations: ['creator'],
      order: { snapshotDate: 'ASC', id: 'ASC' },
      creatorFilter: true,
      fields: {
        creator: 'creatorId',
        snapshot_type: 'snapshotType',
        snapshot_date: 'snapshotDate',
        platform: 'platform',
        followers: 'followers',
        engagement_rate: 'engagementRate',
        estimated_reach: 'estimatedReach',
        revenue_last_3m: 'revenueLast3m',
        notes: 'notes',
      },
    });
  }
}

@Roles('super_admin', 'tch_member')
@Controller('event-invites')
export class EventInvitesController extends VersionedCrudBase<EventInvite> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, {
      entity: EventInvite,
      dto: eventInviteDto,
      relations: ['creator'],
      order: { eventDate: 'DESC', id: 'ASC' },
      creatorFilter: true,
      fields: {
        creator: 'creatorId',
        event_name: 'eventName',
        event_date: 'eventDate',
        invited_date: 'invitedDate',
        response: 'response',
        notes: 'notes',
      },
    });
  }
}

@Roles('super_admin', 'tch_member')
@Controller('employee-reports')
export class EmployeeReportsController extends VersionedCrudBase<EmployeeWeeklyReport> {
  @Get('members')
  members() { return this.dataSource.query("SELECT id,display_name,email FROM tch_profile WHERE status='approved' AND role IN ('super_admin','tch_member') ORDER BY display_name,email"); }

  @Get('automatic')
  async automatic(@Query('week') week: string) {
    assertReportingWeek(week);
    const members = await this.members();
    const deals = await this.dataSource.query(`SELECT d.id,d.responsible_member_id,d.tch_poc,d.confirmation_date::text AS confirmation_date,d.total_fee,d.agency_fee_inr,d.campaign_id,c.name AS campaign,d.brand,
      (c.status='Active' AND d.campaign_over <> 'Y') AS active_now,
      (d.confirmation_date BETWEEN $1::date-6 AND $1::date) AS confirmed_this_week
      FROM tch_commercialdeal d LEFT JOIN tch_campaign c ON c.id=d.campaign_id
      WHERE d.confirmation_date BETWEEN $1::date-6 AND $1::date OR (c.status='Active' AND d.campaign_over <> 'Y') ORDER BY d.confirmation_date DESC,d.id DESC`, [week]);
    const notes = await this.dataSource.query('SELECT member_id,note,version FROM tch_team_weekly_note WHERE week_ending=$1',[week]);
    return {members,deals,notes};
  }

  @Put('note')
  async note(@Body() body: {member_id: string;week: string;note: string;version: number}) {
    assertReportingWeek(body.week);
    if (typeof body.note !== 'string' || body.note.length > 10000 || !Number.isInteger(body.version) || body.version < 0) throw new BadRequestException('Invalid weekly note.');
    if (!(await this.members()).some((m: {id: string}) => m.id === body.member_id)) throw new BadRequestException('Choose an approved team member.');
    const rows = body.version === 0
      ? await this.dataSource.query('INSERT INTO tch_team_weekly_note(member_id,week_ending,note) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING version',[body.member_id,body.week,body.note])
      : await this.dataSource.query('UPDATE tch_team_weekly_note SET note=$3,version=version+1 WHERE member_id=$1 AND week_ending=$2 AND version=$4 RETURNING version',[body.member_id,body.week,body.note,body.version]);
    if (!rows.length) throw new ConflictException('This note changed. Refresh before editing again.');
    return rows[0];
  }

  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, {
      entity: EmployeeWeeklyReport,
      dto: employeeReportDto,
      order: { weekEnding: 'DESC', employeeName: 'ASC' },
      fields: {
        week_ending: 'weekEnding',
        employee_name: 'employeeName',
        new_outreach: 'newOutreach',
        paid_confirmations: 'paidConfirmations',
        revenue_locked: 'revenueLocked',
        profit_locked: 'profitLocked',
        barter_confirmations: 'barterConfirmations',
        live_campaigns: 'liveCampaigns',
        action_points: 'actionPoints',
      },
    });
  }
}

export function assertReportingWeek(week: string) {
  if (typeof week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isFinite(Date.parse(week)) || new Date(week).toISOString().slice(0,10) !== week || new Date(week).getUTCDay() !== 4) throw new BadRequestException('Choose a valid Thursday week ending.');
}
