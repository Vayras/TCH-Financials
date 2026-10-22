import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { blankBrief, validateBrief } from '../src/campaign-content/campaign-content.model';

test('drafts may be incomplete but sharing requires actionable content', () => {
  assert.deepEqual(validateBrief(blankBrief(), 'draft'), blankBrief());
  assert.throws(() => validateBrief(blankBrief(), 'share'));
  const brief = {
    ...blankBrief(),
    objective: 'Introduce coffee',
    product_context: 'Morning routine',
    no_mandatory_messages: true,
    deliverables: [
      {
        id: '12345678-1234-4234-8234-123456789012',
        platform: 'instagram' as const,
        format: 'Reel',
        quantity: 1,
        specifications: '',
        due_date: '2026-10-01',
      },
    ],
  };
  assert.equal(validateBrief(brief, 'share').objective, brief.objective);
  assert.throws(() => validateBrief({ ...brief, internal_notes: 'private' }, 'draft'));
  assert.throws(() =>
    validateBrief(
      { ...brief, references: [{ label: 'Bad', url: 'javascript:alert(1)' }] },
      'draft',
    ),
  );
  assert.throws(() =>
    validateBrief(
      { ...brief, deliverables: [{ ...brief.deliverables[0], due_date: '2026-02-30' }] },
      'share',
    ),
  );
  assert.throws(() =>
    validateBrief(
      { ...brief, deliverables: [brief.deliverables[0], brief.deliverables[0]] },
      'draft',
    ),
  );
  assert.throws(() => validateBrief({ ...brief, mandatory_messages: ['Required'] }, 'share'));
  assert.throws(() => validateBrief({ ...brief, objective: 'a'.repeat(4001) }, 'draft'));
});

import { CampaignContentService } from '../src/campaign-content/campaign-content.service';
import { DataSource } from 'typeorm';
test('creator home binds summary to approved creator and shared briefs', async () => {
  const queries: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[]) => {
    queries.push({ sql, params });
    return sql.startsWith('SELECT id,role,status')
      ? [{ role: 'creator', status: 'approved', creator_id: '2' }]
      : [];
  };
  const service = new CampaignContentService({
    manager: { query },
    query,
  } as unknown as DataSource);
  await service.creatorHome({
    id: '11111111-1111-4111-8111-111111111111',
    role: 'creator',
    creatorId: '2',
  });
  const summary = queries[1];
  assert.deepEqual(summary.params, ['2']);
  assert.match(summary.sql, /a.creator_id=\$1/);
  assert.match(summary.sql, /x.creator_id=\$1/);
  assert.match(summary.sql, /r.id=b.shared_revision_id/);
  assert.doesNotMatch(summary.sql, /feedback|agency_fee|internal/);
});

test('creator notifications return one ordered bounded feed and an unread count independent of page size', async () => {
  const actor = {
    id: '11111111-1111-4111-8111-111111111111',
    role: 'creator' as const,
    creatorId: '2',
  };
  const timestamp = '2026-10-21T10:00:00.000Z';
  const feed = Array.from({ length: 51 }, (_, i) => ({
    id: `message:${i}`,
    type: 'message',
    campaign_id: '3',
    campaign_name: 'Campaign',
    brand: 'Brand',
    concept_id: 'c',
    concept_title: 'Idea',
    message: 'note',
    occurred_at: timestamp,
    unread: true,
    unread_count: 80,
    as_of: timestamp,
  }));
  const queries: string[] = [];
  const parameters: unknown[][] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    queries.push(sql);
    parameters.push(params);
    if (sql.includes('SELECT id,role,status'))
      return [{ role: 'creator', status: 'approved', creator_id: '2' }];
    if (sql.includes('WITH events AS'))
      return params[2] ? [{ ...feed[50], id: 'message:older', unread_count: 80 }] : feed;
    return [];
  };
  const service = new CampaignContentService({
    manager: { query },
    query,
  } as unknown as DataSource);
  const result = await service.creatorNotifications(actor);
  assert.equal(result.items.length, 50);
  assert.equal(result.unread_count, 80);
  assert.equal(result.has_more, true);
  assert.ok(result.next_cursor);
  const next = await service.creatorNotifications(actor, result.next_cursor ?? undefined);
  assert.equal(next.items.length, 1);
  assert.equal(next.items[0].id, 'message:older');
  const sql = queries.find((value) => value.includes('WITH events AS')) ?? '';
  assert.match(sql, /r\.shared_at IS NOT NULL/);
  assert.match(sql, /f\.visibility='shared'/);
  assert.match(sql, /f\.author_id<>\$2/);
  assert.match(sql, /ORDER BY e\.occurred_at DESC,e\.id DESC LIMIT 51/);
  assert.match(sql, /\(e\.occurred_at,e\.id\)<\(\$3::timestamptz,\$4::text\)/);
  assert.equal(result.as_of, timestamp);
  const cursorParams = parameters.find((value) => typeof value[2] === 'string');
  assert.ok(cursorParams?.[2]);
  assert.ok(cursorParams?.[3]);
});
