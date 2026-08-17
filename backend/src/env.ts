import * as path from 'path';
import * as dotenv from 'dotenv';

// The repo keeps one .env at the root (shared with the frontend / docker);
// backend/.env can override locally. Real environment variables win over both.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export const env = {
  appEnv: process.env.APP_ENV ?? 'development',
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
  // Resend — used to send invite emails. Prefer RESEND_FROM_EMAIL; falls back to onboarding sender.
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail:
    process.env.RESEND_FROM_EMAIL?.trim() || 'TCH Financials <beth.t@example.com>',
};

if (!env.databaseUrl) {
  const user = process.env.POSTGRES_USER ?? 'tch';
  const pass = process.env.POSTGRES_PASSWORD ?? 'tch';
  const db = process.env.POSTGRES_DB ?? 'tch_financials';
  env.databaseUrl = `postgres://${user}:${pass}@localhost:5432/${db}`;
}

const isTestProcess = process.env.NODE_ENV === 'test';
const isLocalDatabase = /@(localhost|127\.0\.0\.1|db)[:/]/.test(env.databaseUrl);
if (!isTestProcess && env.appEnv !== 'development' && !env.supabaseUrl && !env.supabaseJwtSecret) {
  throw new Error('Non-development startup refused: Supabase authentication is not configured.');
}
if (!isTestProcess && env.appEnv === 'development' && !isLocalDatabase) {
  throw new Error('Development startup refused: DATABASE_URL must target a local database.');
}
