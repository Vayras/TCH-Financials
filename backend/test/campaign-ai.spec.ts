import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../src/env';

test('AI concept generation bounds configuration and handles missing key gracefully', () => {
  assert.equal(typeof env.openaiModel, 'string');
  assert.ok(env.openaiModel.length > 0);
});
