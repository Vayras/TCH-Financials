import { Controller } from '@nestjs/common';
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

@Controller('employee-reports')
export class EmployeeReportsController extends VersionedCrudBase<EmployeeWeeklyReport> {
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
