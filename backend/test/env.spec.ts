import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('deployment TrioSphere settings override stale dotenv files', () => {
  const temp = mkdtempSync(join(tmpdir(), 'tch-env-'));
  const app = join(temp, 'app');
  mkdirSync(app);
  writeFileSync(join(temp, '.env'), 'TRIOSPHERE_API_TOKEN=\n');
  writeFileSync(join(app, '.env'), 'TRIOSPHERE_API_TOKEN=\n');

  try {
    const backend = resolve(__dirname, '..');
    const result = spawnSync(
      process.execPath,
      [
        '-r',
        require.resolve('ts-node/register'),
        '-e',
        `process.stdout.write(String(require(${JSON.stringify(join(backend, 'src/creator-social/social.config.ts'))}).socialConfig.enabled))`,
      ],
      {
        cwd: app,
        env: {
          ...process.env,
          TS_NODE_PROJECT: join(backend, 'tsconfig.json'),
          TRIOSPHERE_API_TOKEN: 'deployment-token',
        },
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'true');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
