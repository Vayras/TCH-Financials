import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorPaginationParams } from '../src/common/pagination';

test('creator finance pagination defaults to 20 and caps pages at 50', () => {
  assert.deepEqual(creatorPaginationParams(), { page: 1, pageSize: 20, requested: false });
  assert.deepEqual(creatorPaginationParams('3', '50'), { page: 3, pageSize: 50, requested: true });
  assert.throws(() => creatorPaginationParams('0', '20'));
  assert.throws(() => creatorPaginationParams('1.5', '20'));
  assert.throws(() => creatorPaginationParams('1', '51'));
});
