import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../features/studio/preview-model.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  context,
);
const {
  validatePreviewRequest,
  filterPreviewAssets,
  applyPreviewPreset,
  getPreviewReference,
  completePreviewJob,
} = context.exports;

test('preview submission rejects blank prompts and invalid video settings', () => {
  assert.match(
    validatePreviewRequest({ kind: 'image', prompt: '  ', duration: 5, ratio: '1:1' }),
    /describe/i,
  );
  assert.match(
    validatePreviewRequest({ kind: 'video', prompt: 'Product shot', duration: 99, ratio: '9:16' }),
    /duration/i,
  );
  assert.equal(
    validatePreviewRequest({
      kind: 'video',
      prompt: 'Slow product reveal',
      duration: 5,
      ratio: '9:16',
    }),
    null,
  );
  assert.match(
    validatePreviewRequest({ kind: 'image', prompt: 'x'.repeat(4001), duration: 5, ratio: '1:1' }),
    /4,000/,
  );
});

test('library filters never return another project’s assets', () => {
  const assets = [
    { id: 'one', projectId: 'personal', kind: 'image', title: 'Amber bottle' },
    { id: 'two', projectId: 'campaign', kind: 'image', title: 'Amber campaign' },
    { id: 'three', projectId: 'personal', kind: 'video', title: 'Botanical motion' },
  ];
  assert.equal(filterPreviewAssets(assets, 'personal', 'all', '').length, 2);
  assert.equal(filterPreviewAssets(assets, 'personal', 'video', '')[0].id, 'three');
  assert.equal(filterPreviewAssets(assets, 'personal', 'all', 'AMBER')[0].id, 'one');
  assert.equal(filterPreviewAssets(assets, 'campaign', 'video', '').length, 0);
});

test('a preset fills request settings without changing media mode', () => {
  const draft = {
    kind: 'video',
    prompt: 'Old prompt',
    ratio: '1:1',
    duration: 10,
    resolution: '1080p',
    referenceId: '',
  };
  const next = applyPreviewPreset(draft, 'coastal');
  assert.equal(next.kind, 'video');
  assert.equal(next.ratio, '16:9');
  assert.match(next.prompt, /coast/i);
  assert.equal(draft.prompt, 'Old prompt');
});

test('video references must be images from the active project', () => {
  const assets = [
    { id: 'mine', projectId: 'one', kind: 'image', title: 'My image', src: '/mine.svg' },
    { id: 'other', projectId: 'two', kind: 'image' },
    { id: 'clip', projectId: 'one', kind: 'video' },
  ];
  assert.equal(getPreviewReference(assets, 'one', 'mine').id, 'mine');
  assert.equal(getPreviewReference(assets, 'one', 'other'), null);
  assert.equal(getPreviewReference(assets, 'one', 'clip'), null);
});

test('a completed sample keeps submitted settings and reference separate from sample dimensions', () => {
  const job = {
    projectId: 'one',
    kind: 'video',
    prompt: 'Slow reveal',
    ratio: '9:16',
    duration: 10,
    resolution: '1080p',
    reference: { id: 'ref', title: 'My image', src: '/mine.svg' },
  };
  const asset = completePreviewJob(job, 'new-result');
  assert.equal(asset.projectId, 'one');
  assert.equal(asset.ratio, '9:16');
  assert.equal(asset.duration, 10);
  assert.equal(asset.mediaRatio, '16:9');
  assert.equal(asset.reference.id, 'ref');
  assert.equal(asset.prompt, 'Slow reveal');
});
