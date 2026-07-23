import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppDataSource } from './data-source';
import { AlertsService } from './analytics/alerts.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './resources/users.controller';
import { CampaignsController } from './resources/campaigns.controller';
import { CreatorsController } from './resources/creators.controller';
import { CreatorInvoicesController } from './resources/creator-invoices.controller';
import { DealDocumentsController } from './resources/deal-documents.controller';
import { DealsController } from './resources/deals.controller';
import { DocumentsController } from './resources/documents.controller';
import {
  ContractingController, DropOffsController, EmployeeReportsController,
  EventInvitesController, SocialSnapshotsController,
} from './resources/simple-resources.controllers';

@Module({
  imports: [
    TypeOrmModule.forRoot(AppDataSource.options),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
  ],
  controllers: [
    AnalyticsController,
    AuthController,
    UsersController,
    CampaignsController,
    CreatorsController,
    CreatorInvoicesController,
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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
