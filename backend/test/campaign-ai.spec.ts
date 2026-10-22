import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CampaignAIController } from '../src/campaign-content/campaign-ai.controller';
import { CampaignAIService } from '../src/campaign-content/campaign-ai.service';
import { env } from '../src/env';

test('AI generation requires and forwards a UUID idempotency key', async () => {
  let received: unknown;
  const controller = new CampaignAIController({
    generateIdeas: async (_actor: unknown, _campaign: string, _body: unknown, key: string) => {
      received = key;
      return { status: 'completed' };
    },
  } as never);
  const actor = { id: 'user', role: 'creator' as const, creatorId: '1' };
  await assert.rejects(
    controller.generate({ user: actor }, '3', {}, undefined),
    BadRequestException,
  );
  await assert.rejects(
    controller.generate({ user: actor }, '3', {}, 'not-a-uuid'),
    BadRequestException,
  );
  const key = 'a4e8c4f2-0ba9-4d65-91f4-2adcaab50765';
  await controller.generate({ user: actor }, '3', {}, key);
  assert.equal(received, key);
});

function mockAiDatabase() {
  let committedReservation = false;
  const sqls: string[] = [];
  const managerQuery = async (sql: string): Promise<any[]> => {
    sqls.push(sql);
    if (sql.includes('FROM tch_profile WHERE id'))
      return [{ role: 'creator', status: 'approved', creator_id: '1' }];
    if (sql.includes('FROM tch_campaign_brief_creator')) return [{ ok: 1 }];
    if (sql.includes('SELECT b.shared_revision_id'))
      return [{ shared_revision_id: 'revision', content: { title: 'Brief' } }];
    if (sql.includes('SELECT id,status FROM tch_campaign_ai_job')) return [];
    if (sql.includes('SELECT id, status FROM tch_campaign_ai_job')) return [];
    if (sql.includes('INSERT INTO tch_campaign_ai_job')) return [{ id: 'job' }];
    return [];
  };
  const manager = { query: managerQuery };
  const db = {
    manager,
    query: async (sql: string) => {
      sqls.push(sql);
      if (sql.includes('SELECT r.content')) return [{ content: { title: 'Brief' } }];
      if (sql.includes('SELECT name, category, notes'))
        return [{ name: 'Creator', category: 'Lifestyle', notes: '' }];
      if (sql.includes('tch_campaign_content_reference')) return [];
      return [];
    },
    transaction: async (work: (manager: { query: typeof managerQuery }) => Promise<unknown>) => {
      const value = await work(manager);
      committedReservation = true;
      return value;
    },
  };
  return { db, sqls, reserved: () => committedReservation };
}

test('AI generation commits its job before provider I/O and saves completion afterward', async () => {
  const originalKey = env.openaiApiKey,
    originalFetch = global.fetch;
  const harness = mockAiDatabase();
  env.openaiApiKey = 'test-key';
  global.fetch = (async (_input: unknown, init?: RequestInit) => {
    assert.equal(harness.reserved(), true);
    assert.ok(init?.signal instanceof AbortSignal);
    return {
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ ideas: [{ title: 'Idea', hook: 'Hook' }] }) } },
        ],
      }),
    } as Response;
  }) as typeof fetch;
  try {
    const service = new CampaignAIService(harness.db as never);
    const result = await service.generateIdeas(
      { id: 'user', role: 'creator', creatorId: '1' },
      '3',
      {},
      'a4e8c4f2-0ba9-4d65-91f4-2adcaab50765',
    );
    assert.equal(result.status, 'completed');
    assert.ok(harness.sqls.some((sql) => sql.includes("SET status='completed'")));
  } finally {
    env.openaiApiKey = originalKey;
    global.fetch = originalFetch;
  }
});

test('AI provider failures persist a failed job outcome', async () => {
  const originalKey = env.openaiApiKey,
    originalFetch = global.fetch;
  const harness = mockAiDatabase();
  env.openaiApiKey = 'test-key';
  global.fetch = (async () => {
    throw new Error('timeout');
  }) as typeof fetch;
  try {
    const service = new CampaignAIService(harness.db as never);
    await assert.rejects(
      service.generateIdeas(
        { id: 'user', role: 'creator', creatorId: '1' },
        '3',
        {},
        'a4e8c4f2-0ba9-4d65-91f4-2adcaab50765',
      ),
    );
    assert.ok(harness.sqls.some((sql) => sql.includes("SET status='failed'")));
  } finally {
    env.openaiApiKey = originalKey;
    global.fetch = originalFetch;
  }
});
