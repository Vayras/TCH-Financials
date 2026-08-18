import { DataSource } from 'typeorm';
import { AppDataSource } from '../src/data-source';

const EXPECTED_URL = 'postgres://tch_dev:tch_dev_only@db:5432/tch_financials_dev';

async function seed(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    await manager.query(`
      INSERT INTO tch_creator
        (name, category, source, stage, relationship, status, email, portal_status)
      VALUES
        ('Dev Dummy Creator', 'Development Test', 'TCH', 'Closed', 'Friend', 'Active',
         'creator.dev@tch.local', 'active')
      ON CONFLICT (name) DO UPDATE SET
        email = EXCLUDED.email,
        portal_status = EXCLUDED.portal_status,
        status = EXCLUDED.status
    `);
    await manager.query(`
      INSERT INTO tch_profile
        (id, email, role, status, password_set, creator_id, display_name)
      VALUES
        ('10000000-0000-4000-8000-000000000001', 'admin.dev@tch.local',
         'super_admin', 'approved', true, NULL, 'Dev Admin'),
        ('10000000-0000-4000-8000-000000000002', 'accounts.dev@tch.local',
         'accounts', 'approved', true, NULL, 'Dev Accounts'),
        ('10000000-0000-4000-8000-000000000003', 'creator.dev@tch.local',
         'creator', 'approved', true,
         (SELECT id FROM tch_creator WHERE name = 'Dev Dummy Creator'), 'Dev Creator')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        password_set = EXCLUDED.password_set,
        creator_id = EXCLUDED.creator_id,
        display_name = EXCLUDED.display_name
    `);
  });
}

async function main(): Promise<void> {
  if (process.env.APP_ENV !== 'development' || process.env.DATABASE_URL !== EXPECTED_URL) {
    throw new Error('Refusing to seed: target is not the isolated Docker development database.');
  }
  await AppDataSource.initialize();
  try {
    await seed(AppDataSource);
    console.log('Development-only role accounts are ready.');
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
