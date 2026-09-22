import 'reflect-metadata';
import { setTimeout } from 'node:timers/promises';
import { AppDataSource } from './data-source';
import { BrightDataClient } from './creator-social/brightdata.client';
import { SocialImportProcessor } from './creator-social/social-import.processor';
import { socialConfig } from './creator-social/social.config';
import { structuredLog } from './common/observability';

async function main() {
  if (!socialConfig.enabled || !socialConfig.apiKey || !/^[a-zA-Z0-9_-]{1,100}$/.test(socialConfig.datasetId)) {
    throw new Error('Social imports must be enabled and configured before starting the worker.');
  }
  await AppDataSource.initialize();
  let stopped = false;
  process.on('SIGTERM', () => { stopped = true; });
  process.on('SIGINT', () => { stopped = true; });
  const processor = new SocialImportProcessor(AppDataSource, new BrightDataClient());
  structuredLog('info', 'social_worker_started');
  try {
    while (!stopped) {
      try { if (!await processor.runOnce()) await setTimeout(2000); }
      catch { structuredLog('error', 'social_worker_iteration_failed'); await setTimeout(5000); }
    }
  } finally { await AppDataSource.destroy(); }
}
void main().catch(() => { structuredLog('error', 'social_worker_startup_failed'); process.exitCode = 1; });
