import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../src/auth/roles.decorator';
import { SKIP_AUTH_KEY } from '../src/auth/skip-auth.decorator';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AuthController } from '../src/auth/auth.controller';
import { CampaignsController } from '../src/resources/campaigns.controller';
import { CreatorInvoicesController } from '../src/resources/creator-invoices.controller';
import { CreatorsController } from '../src/resources/creators.controller';
import { DealDocumentsController } from '../src/resources/deal-documents.controller';
import { DealsController } from '../src/resources/deals.controller';
import { DocumentsController } from '../src/resources/documents.controller';
import { PaymentTransactionsController } from '../src/resources/payment-transactions.controller';
import { TdsController } from '../src/resources/tds.controller';
import { UsersController } from '../src/resources/users.controller';
import {
  ContractingController, DropOffsController, EmployeeReportsController,
  EventInvitesController, SocialSnapshotsController,
} from '../src/resources/simple-resources.controllers';
import { AuditController } from '../src/resources/audit.controller';
import { HealthController } from '../src/health.controller';

const CONTROLLERS = [
  AnalyticsController, AuthController, CampaignsController, CreatorInvoicesController,
  CreatorsController, DealDocumentsController, DealsController, DocumentsController,
  PaymentTransactionsController, TdsController, UsersController, ContractingController,
  DropOffsController, EmployeeReportsController, EventInvitesController,
  SocialSnapshotsController,
  AuditController, HealthController,
];

test('every HTTP route declares roles or skip-auth metadata', () => {
  const missing: string[] = [];
  for (const Controller of CONTROLLERS) {
    const classRoles = Reflect.getMetadata(ROLES_KEY, Controller);
    let prototype: Record<string, unknown> = Controller.prototype as unknown as Record<string, unknown>;
    while (prototype && prototype !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === 'constructor') continue;
        const handler = prototype[name];
        if (typeof handler !== 'function' || Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
        const roles = Reflect.getMetadata(ROLES_KEY, handler) ?? classRoles;
        const skip = Reflect.getMetadata(SKIP_AUTH_KEY, handler) ?? Reflect.getMetadata(SKIP_AUTH_KEY, Controller);
        if (!roles?.length && !skip) missing.push(`${Controller.name}.${name}`);
      }
      prototype = Object.getPrototypeOf(prototype) as Record<string, unknown>;
    }
  }
  assert.deepEqual(missing, []);
});
