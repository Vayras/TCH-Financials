import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyticsService } from '../src/analytics/analytics.service';

test('creator dashboard attributes direct and shared deals without double counting', async () => {
  const creator = { id: '7', name: 'Creator Seven', relationship: 'Exclusive', category: 'Fashion', opsManager: 'Ops' };
  const service = new AnalyticsService({
    getRepository: () => ({ findOneBy: async () => creator }),
  } as never);
  service.allDeals = async () => [
    {
      id: '1', billingPeriod: '2026-04-01', creatorId: '7', creator, creatorShares: [],
      totalFee: '1000', creatorFee: '800', agencyFeeInr: '200', creatorPaymentStatus: 'Paid',
      brand: 'Brand A', campaignId: '10', campaign: { name: 'Launch', brand: 'Brand A', status: 'Over' },
    },
    {
      id: '2', billingPeriod: '2026-05-01', creatorId: null, creator: null,
      creatorShares: [{ creatorId: '7', creator, totalFee: '500', creatorFee: '400', agencyFeeInr: '100', creatorNameRaw: '' }],
      creatorPaymentStatus: 'Pending', brand: 'Brand B', campaignId: '11',
      campaign: { name: 'Always On', brand: 'Brand B', status: 'Active' },
    },
    {
      id: '3', billingPeriod: '2025-04-01', creatorId: '7', creator, creatorShares: [],
      totalFee: '9999', creatorFee: '9999', agencyFeeInr: '0', creatorPaymentStatus: 'Paid', brand: 'Old',
    },
  ] as never;

  const result = await service.creatorDashboard(7, 2026) as any;
  assert.deepEqual(result.metrics, {
    campaign_count: 2,
    total_billing: '1500.00',
    creator_fees: '1200.00',
    agency_margin: '300.00',
    amount_paid: '800.00',
    outstanding: '400.00',
    average_deal_value: '750.00',
    active_campaigns: 1,
  });
  assert.equal(result.months.find((month: any) => month.key === '2026-04').billing, '1000.00');
  assert.equal(result.months.find((month: any) => month.key === '2026-05').creator_fee, '400.00');
  assert.deepEqual(result.payment_statuses.map((row: any) => [row.status, row.count]), [['Paid', 1], ['Pending', 1]]);
  assert.deepEqual(result.brands.map((row: any) => row.name), ['Brand A', 'Brand B']);
  assert.deepEqual(result.brands[0], {
    name: 'Brand A', count: 1, billing: '1000.00', creator_fee: '800.00', margin: '200.00',
    paid: '800.00', outstanding: '0.00', billing_share: '0.6667', last_period: '2026-04-01',
  });
});

test('creator dashboard returns a complete zero state when the FY has no deals', async () => {
  const service = new AnalyticsService({
    getRepository: () => ({ findOneBy: async () => ({ id: '9', name: 'New Creator' }) }),
  } as never);
  service.allDeals = async () => [];
  const result = await service.creatorDashboard(9, 2026) as any;
  assert.equal(result.metrics.campaign_count, 0);
  assert.equal(result.metrics.total_billing, '0.00');
  assert.equal(result.metrics.average_deal_value, '0.00');
  assert.equal(result.months.length, 12);
  assert.deepEqual(result.payment_statuses, []);
  assert.deepEqual(result.campaigns, []);
});
