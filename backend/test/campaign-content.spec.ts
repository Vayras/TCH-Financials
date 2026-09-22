import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { blankBrief, validateBrief } from '../src/campaign-content/campaign-content.model';

test('drafts may be incomplete but sharing requires actionable content', () => {
  assert.deepEqual(validateBrief(blankBrief(), 'draft'), blankBrief());
  assert.throws(() => validateBrief(blankBrief(), 'share'));
  const brief = { ...blankBrief(), objective: 'Introduce coffee', product_context: 'Morning routine', no_mandatory_messages: true,
    deliverables: [{ id: '12345678-1234-4234-8234-123456789012', platform: 'instagram' as const, format: 'Reel', quantity: 1, specifications: '', due_date: '2026-10-01' }] };
  assert.equal(validateBrief(brief, 'share').objective, brief.objective);
  assert.throws(() => validateBrief({ ...brief, internal_notes: 'private' }, 'draft'));
  assert.throws(() => validateBrief({ ...brief, references: [{label: 'Bad', url: 'javascript:alert(1)'}] }, 'draft'));
  assert.throws(() => validateBrief({ ...brief, deliverables: [{...brief.deliverables[0], due_date: '2026-02-30'}] }, 'share'));
  assert.throws(() => validateBrief({ ...brief, deliverables: [brief.deliverables[0], brief.deliverables[0]] }, 'draft'));
  assert.throws(() => validateBrief({ ...brief, mandatory_messages: ['Required'] }, 'share'));
  assert.throws(() => validateBrief({ ...brief, objective: 'a'.repeat(4001) }, 'draft'));
});
