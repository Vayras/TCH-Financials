import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { CreatorInvoicesController } from '../src/resources/creator-invoices.controller';

test('eligible creator invoice campaigns exclude invoices across the entire history and page results', async () => {
  let sql = '';
  let params: unknown[] = [];
  const rows = Array.from({ length: 51 }, (_, index) => ({
    id: index + 1,
    brand: 'Brand',
    campaign: 'Campaign',
    creator_fee: '100',
  }));
  const controller = new CreatorInvoicesController({
    query: async (query: string, values: unknown[]) => {
      sql = query;
      params = values;
      return rows;
    },
  } as never);
  const result = await controller.eligibleCreatorDeals(
    { user: { creatorId: '7' } } as never,
    '2',
    '25',
  );
  assert.match(sql, /NOT EXISTS\s*\(SELECT 1 FROM tch_creatorinvoice/i);
  assert.match(sql, /tch_dealcreatorshare/);
  assert.deepEqual(params, ['7', 25, 26]);
  assert.equal(result.items.length, 25);
  assert.equal(result.has_more, true);
  assert.equal(result.page, 2);
});
