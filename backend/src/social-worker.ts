import 'reflect-metadata';
import { setTimeout } from 'node:timers/promises';
import { AppDataSource } from './data-source';
import { TrioSphereClient } from './creator-social/triosphere.client';
import { SocialImportProcessor } from './creator-social/social-import.processor';
import { socialConfig } from './creator-social/social.config';
import { structuredLog } from './common/observability';

async function main() {
  if (!socialConfig.enabled || !socialConfig.apiToken) {
    throw new Error('TRIOSPHERE_API_TOKEN must be configured before starting the social worker.');
  }
  await AppDataSource.initialize();
  let stopped = false;
  process.on('SIGTERM', () => {
    stopped = true;
  });
  process.on('SIGINT', () => {
    stopped = true;
  });
  const processor = new SocialImportProcessor(
    AppDataSource,
    new TrioSphereClient(socialConfig.apiToken),
  );
  structuredLog('info', 'social_worker_started');
  try {
    while (!stopped) {
      try {
        if (!(await processor.runOnce())) await setTimeout(2000);
      } catch {
        structuredLog('error', 'social_worker_iteration_failed');
        await setTimeout(5000);
      }
    }
  } finally {
    await AppDataSource.destroy();
  }
}
void main().catch(() => {
  structuredLog('error', 'social_worker_startup_failed');
  process.exitCode = 1;
});
