import * as path from 'path';
import * as dotenv from 'dotenv';

const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
// Docker/deployment database routing must take precedence over local .env files.
const injectedDatabaseUrl = process.env.DATABASE_URL;
const injectedOpenAiKey = process.env.OPENAI_API_KEY;
const injectedOpenAiModel = process.env.OPENAI_MODEL;
const injectedOpenAiSearchModel = process.env.OPENAI_SEARCH_MODEL;
if (!process.env.OPENAI_API_KEY?.trim()) delete process.env.OPENAI_API_KEY;
if (!process.env.OPENAI_SEARCH_MODEL?.trim()) delete process.env.OPENAI_SEARCH_MODEL;

dotenv.config({ path: path.resolve(baseDir, '.env'), override: true });
dotenv.config({ path: path.resolve(baseDir, '..', '.env'), override: true });
dotenv.config({ path: path.resolve(baseDir, '..', '..', '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), override: true });
if (injectedDatabaseUrl) process.env.DATABASE_URL = injectedDatabaseUrl;
if (injectedOpenAiKey) process.env.OPENAI_API_KEY = injectedOpenAiKey;
if (injectedOpenAiModel) process.env.OPENAI_MODEL = injectedOpenAiModel;
if (injectedOpenAiSearchModel) process.env.OPENAI_SEARCH_MODEL = injectedOpenAiSearchModel;




export const env = {
  appEnv: process.env.APP_ENV ?? 'development',
  swaggerEnabled: process.env.SWAGGER_ENABLED === undefined
    ? (process.env.APP_ENV ?? 'development') === 'development'
    : process.env.SWAGGER_ENABLED === 'true',
  databaseUrl: process.env.DATABASE_URL ?? '',
  databaseSslCa: (process.env.DATABASE_SSL_CA ?? '').replace(/\\n/g, '\n'),
  databaseSslRejectUnauthorized:
    (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !== 'false',
  port: parseInt(process.env.PORT ?? '8000', 10),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  mediaRoot: process.env.MEDIA_ROOT ?? path.resolve(__dirname, '..', 'media'),
  // The public URL of the frontend (used to build Supabase redirectTo links).
  // Set APP_URL in .env for production. Defaults to localhost:5050 for dev.
  appUrl: (process.env.APP_URL ?? 'http://localhost:5050').replace(/\/+$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL?.trim() ?? '',
  // Resend — used to send invite emails. Prefer RESEND_FROM_EMAIL; falls back to onboarding sender.
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail:
    process.env.RESEND_FROM_EMAIL?.trim() || 'TCH Financials <beth.t@example.com>',
  // OpenAI — used for AI concept generation in Campaign Briefs.
  openaiApiKey: (process.env.OPENAI_API_KEY ?? '').trim(),
  openaiModel: (process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
};

if (!env.databaseUrl) {
  const user = process.env.POSTGRES_USER ?? 'tch';
  const pass = process.env.POSTGRES_PASSWORD ?? 'tch';
  const db = process.env.POSTGRES_DB ?? 'tch_financials';
  env.databaseUrl = `postgres://${user}:${pass}@localhost:5432/${db}`;
}
