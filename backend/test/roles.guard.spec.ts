import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../src/auth/roles.guard';
import { assertDealPatchAllowed } from '../src/resources/deals.controller';
import { creatorPortalDealDto } from '../src/resources/deals.controller';

function context(user?: { role: string }): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guard(metadata: { skip?: boolean; roles?: string[] }): RolesGuard {
  const reflector = {
    getAllAndOverride(key: string) {
      if (key === 'skipAuth') return metadata.skip;
      if (key === 'roles') return metadata.roles;
      return undefined;
    },
  };
  return new RolesGuard(reflector as never);
}

test('deny-by-default rejects an endpoint with no role policy', () => {
  assert.throws(() => guard({}).canActivate(context({ role: 'super_admin' })), ForbiddenException);
});

test('declared roles allow only matching users', () => {
  const rolesGuard = guard({ roles: ['super_admin', 'accounts'] });
  assert.equal(rolesGuard.canActivate(context({ role: 'accounts' })), true);
  assert.throws(() => rolesGuard.canActivate(context({ role: 'creator' })), ForbiddenException);
});

test('skip-auth endpoints bypass role enforcement', () => {
  assert.equal(guard({ skip: true }).canActivate(context()), true);
});

test('accounts deal patches are limited to finance fields', () => {
  assert.doesNotThrow(() => assertDealPatchAllowed('accounts', {
    version: 1,
    creator_payment_status: 'Paid',
  }));
  assert.throws(
    () => assertDealPatchAllowed('accounts', { version: 1, total_fee: '1.00' }),
    ForbiddenException,
  );
  assert.doesNotThrow(() => assertDealPatchAllowed('tch_member', { total_fee: '1.00' }));
});

test('creator deal responses omit client billing and agency profit fields', () => {
  const dto = creatorPortalDealDto({
    id: '9', brand: 'Brand', campaignId: '4', campaign: { name: 'Campaign', status: 'Active' },
    deliverables: 'One reel', creatorFee: '800.00', creatorPaymentStatus: 'Pending',
    creatorPaymentCycle: 'Net30', creatorPaymentDate: null, campaignOver: '',
    confirmationDate: '2026-08-01', creatorId: '3', creatorShares: [],
    totalFee: '1000.00', agencyFeeInr: '200.00', clientInvoiceAmount: '1000.00',
  } as never, '3') as Record<string, unknown>;
  assert.equal(dto.creator_fee, '800.00');
  assert.equal('total_fee' in dto, false);
  assert.equal('agency_fee_inr' in dto, false);
  assert.equal('client_invoice_amount' in dto, false);
});
