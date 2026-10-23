import '../env';

function positiveInt(name: string, fallback: number, max: number) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) throw new Error(`Invalid ${name}`);
  return parsed;
}

export function socialImportsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return !!env.TRIOSPHERE_API_TOKEN?.trim();
}

export const socialConfig = {
  paused: !socialImportsEnabled(),
  enabled: socialImportsEnabled(),
  apiToken: process.env.TRIOSPHERE_API_TOKEN?.trim() ?? '',
  globalDailyLimit: positiveInt('SOCIAL_GLOBAL_DAILY_LIMIT', 100, 10000),
  globalHourlyLimit: positiveInt('SOCIAL_GLOBAL_HOURLY_LIMIT', 20, 30),
};
