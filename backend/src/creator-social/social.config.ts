import '../env';

function positiveInt(name: string, fallback: number, max: number) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`Invalid ${name}`);
  return parsed;
}

export const socialConfig = {
  enabled: process.env.BRIGHTDATA_IMPORTS_ENABLED === 'true',
  apiKey: process.env.BRIGHTDATA_API_KEY?.trim() ?? '',
  datasetId: process.env.BRIGHTDATA_IG_DATASET_ID?.trim() ?? '',
  postsDatasetId: process.env.BRIGHTDATA_IG_POSTS_DATASET_ID?.trim() ?? '',
  cooldownSeconds: positiveInt('SOCIAL_REFRESH_COOLDOWN_SECONDS', 3600, 604800),
  creatorDailyLimit: positiveInt('SOCIAL_CREATOR_DAILY_LIMIT', 3, 100),
  globalDailyLimit: positiveInt('SOCIAL_GLOBAL_DAILY_LIMIT', 100, 10000),
};
