import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { entities } from './entities';

// Supabase's session pooler presents a certificate chain node-postgres can't
// verify against its default CA bundle (psql's sslmode=require skips
// verification; node's doesn't). Encrypt without CA verification for remote
// hosts, and skip TLS entirely for the local docker fallback.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(env.databaseUrl);
const url = env.databaseUrl.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');

// Used both by the running app (via TypeOrmModule) and the TypeORM CLI for
// migrations (npm run migration:run). Schema changes go through migrations
// only — never synchronize — because the database is the shared Supabase one.
export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  entities,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
