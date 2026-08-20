import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { todayISO } from '../common/dates';
import { fiscalYearOf } from '../common/fy';
import { AlertsService } from './alerts.service';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../auth/roles.decorator';

function fyStartOf(fy?: string): number {
  return fy ? Number(fy) : fiscalYearOf(todayISO());
}

@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly alerts: AlertsService,
  ) {}

  @Get('overview')
  @Roles('super_admin', 'accounts', 'tch_member')
  overview(@Query('fy') fy?: string, @Query('creator') creator?: string) {
    return this.analytics.overview(fyStartOf(fy), creator ?? '');
  }

  @Get('entity-summary')
  @Roles('super_admin', 'accounts', 'tch_member')
  entitySummary(
    @Query('fy') fy?: string,
    @Query('entity') entity?: string,
    @Query('quarter') quarter?: string,
    @Query('month') month?: string,
  ) {
    return this.analytics.entitySummary(fyStartOf(fy), entity ?? '', quarter ?? '', month ?? '');
  }

  @Get('creator-insights')
  @Roles('super_admin', 'tch_member')
  creatorInsights(@Query('fy') fy?: string) {
    return this.analytics.creatorInsights(fyStartOf(fy));
  }

  @Get('creators/:id/dashboard')
  @Roles('super_admin', 'accounts', 'tch_member')
  creatorDashboard(@Param('id') id: string, @Query('fy') fy?: string, @Query('month') month?: string) {
    if (!/^\d+$/.test(id)) throw new BadRequestException({ detail: 'Invalid creator id.' });
    return this.analytics.creatorDashboard(Number(id), fyStartOf(fy), month);
  }

  @Get('exclusives/quarterly')
  @Roles('super_admin', 'tch_member')
  async quarterlyExclusives(@Query('fy') fy?: string) {
    const fyStart = fyStartOf(fy);
    return { fy_start: fyStart, rows: await this.analytics.quarterlyExclusives(fyStart) };
  }

  @Get('alerts')
  @Roles('super_admin', 'tch_member')
  alertsView() {
    return this.alerts.compute();
  }

  @Post('alerts/dismiss')
  @Roles('super_admin', 'tch_member')
  async dismiss(@Body() body: { keys?: unknown }) {
    const keys = body?.keys;
    if (
      !Array.isArray(keys) ||
      !keys.length ||
      !keys.every((k) => typeof k === 'string' && k)
    ) {
      throw new BadRequestException({ detail: 'keys must be a non-empty list of strings' });
    }
    return { dismissed: await this.alerts.dismiss(keys as string[]) };
  }

  @Post('alerts/restore')
  @Roles('super_admin', 'tch_member')
  async restore() {
    return { restored: await this.alerts.restore() };
  }
}
