import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './data-source';
import { AlertsService } from './analytics/alerts.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { CampaignsController } from './resources/campaigns.controller';
import { CreatorsController } from './resources/creators.controller';
import { DealDocumentsController } from './resources/deal-documents.controller';
import { DealsController } from './resources/deals.controller';
import { DocumentsController } from './resources/documents.controller';
import {
  ContractingController, DropOffsController, EmployeeReportsController,
  EventInvitesController, SocialSnapshotsController,
} from './resources/simple-resources.controllers';

@Module({
  imports: [TypeOrmModule.forRoot(AppDataSource.options)],
  controllers: [
    AnalyticsController,
    CampaignsController,
    CreatorsController,
    DealDocumentsController,
    DealsController,
    DocumentsController,
    ContractingController,
    DropOffsController,
    EmployeeReportsController,
    EventInvitesController,
    SocialSnapshotsController,
  ],
  providers: [
    AnalyticsService,
    AlertsService,
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
})
export class AppModule {}
