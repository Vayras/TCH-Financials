-- Development-only compatibility shim for migrations that integrate with
-- Supabase's auth.users table in production. This database is local and does
-- not provide Supabase authentication; the backend uses its existing mock
-- super-admin identity when SUPABASE_URL and SUPABASE_JWT_SECRET are empty.
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255),
  email_confirmed_at timestamptz,
  confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
