import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { entities } from './entities';

// Local databases do not use TLS. Remote databases verify their certificate
// by default; DATABASE_SSL_CA can provide the Supabase/project CA chain.
// `db` is the private service name used only by docker-compose.dev.yml.
const isLocal = /@(localhost|127\.0\.0\.1|db)[:/]/.test(env.databaseUrl);
const url = env.databaseUrl.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');

// Used both by the running app (via TypeOrmModule) and the TypeORM CLI for
// migrations (npm run migration:run). Schema changes go through migrations
// only — never synchronize — because the database is the shared Supabase one.
export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  ssl: isLocal ? false : {
    rejectUnauthorized: env.databaseSslRejectUnauthorized,
    ca: env.databaseSslCa || undefined,
  },
  entities,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
