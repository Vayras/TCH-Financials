import * as fs from 'node:fs';
import * as path from 'node:path';

type Result = { key: string; ok: boolean; message: string };
const results: Result[] = [];
const check = (key: string, ok: boolean, message: string) => results.push({ key, ok, message });
const value = (key: string) => (process.env[key] ?? '').trim();

check('app_env', value('APP_ENV') === 'production', 'APP_ENV must be production.');
check('database_url', /^postgres(ql)?:\/\//.test(value('DATABASE_URL')), 'DATABASE_URL must be a PostgreSQL URL.');
check('database_remote', !/@(localhost|127\.0\.0\.1|db)[:/]/.test(value('DATABASE_URL')), 'Production database must not use a development hostname.');
check('database_tls', value('DATABASE_SSL_REJECT_UNAUTHORIZED').toLowerCase() !== 'false', 'TLS certificate verification must not be disabled.');
check('database_ca', value('DATABASE_SSL_CA').length > 0, 'DATABASE_SSL_CA must contain the verified project CA chain.');
check('supabase_url', /^https:\/\//.test(value('SUPABASE_URL')), 'SUPABASE_URL must use HTTPS.');
check('supabase_service_role', value('SUPABASE_SERVICE_ROLE_KEY').length > 20, 'SUPABASE_SERVICE_ROLE_KEY is required for admin workflows.');
check('frontend_supabase_url', value('NEXT_PUBLIC_SUPABASE_URL') === value('SUPABASE_URL'), 'Frontend and backend Supabase URLs must match.');
check('frontend_anon_key', value('NEXT_PUBLIC_SUPABASE_ANON_KEY').length > 20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required at build time.');
check('app_url', /^https:\/\//.test(value('APP_URL')), 'APP_URL must use HTTPS.');
const cors = value('CORS_ORIGINS').split(',').map((item) => item.trim()).filter(Boolean);
check('cors', cors.every((origin) => /^https:\/\//.test(origin) && !origin.includes('*')), 'CORS_ORIGINS may contain only explicit HTTPS origins.');
check('resend', value('RESEND_API_KEY').length > 10 && value('RESEND_FROM_EMAIL').includes('@'), 'Resend key and sender address are required.');
check('alert_webhook', !value('ALERT_WEBHOOK_URL') || /^https:\/\//.test(value('ALERT_WEBHOOK_URL')), 'ALERT_WEBHOOK_URL must use HTTPS when configured.');

const mediaRoot = value('MEDIA_ROOT');
check('media_root', path.isAbsolute(mediaRoot), 'MEDIA_ROOT must be an absolute path.');
if (path.isAbsolute(mediaRoot)) {
  check('media_exists', fs.existsSync(mediaRoot), 'MEDIA_ROOT must already exist before deployment.');
}
const backupDir = value('BACKUP_DIR');
check('backup_dir', path.isAbsolute(backupDir) && fs.existsSync(backupDir), 'BACKUP_DIR must be an existing absolute path.');

for (const result of results) {
  process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'} ${result.key}: ${result.message}\n`);
}
const failures = results.filter((result) => !result.ok);
if (failures.length) {
  process.stderr.write(`[preflight] ${failures.length} production requirement(s) failed. No deployment should proceed.\n`);
  process.exitCode = 2;
} else {
  process.stdout.write('[preflight] Static production configuration checks passed.\n');
}
