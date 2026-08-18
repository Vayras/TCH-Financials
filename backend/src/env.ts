import * as path from 'path';
import * as dotenv from 'dotenv';

// The repo keeps one .env at the root (shared with the frontend / docker);
// backend/.env can override locally. Real environment variables win over both.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  port: parseInt(process.env.PORT ?? '8000', 10),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  mediaRoot: process.env.MEDIA_ROOT ?? path.resolve(__dirname, '..', 'media'),
};

if (!env.databaseUrl) {
  const user = process.env.POSTGRES_USER ?? 'tch';
  const pass = process.env.POSTGRES_PASSWORD ?? 'tch';
  const db = process.env.POSTGRES_DB ?? 'tch_financials';
  env.databaseUrl = `postgres://${user}:${pass}@localhost:5432/${db}`;
}
