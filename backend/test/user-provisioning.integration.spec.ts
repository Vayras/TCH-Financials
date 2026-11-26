import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { HardenUserManagement1792200000000 } from '../src/migrations/1792200000000-harden-user-management';
import { FixExpiredInviteProvisioning1792300000000 } from '../src/migrations/1792300000000-fix-expired-invite-provisioning';

// The profile trigger lives on auth.users and writes to public tables, so this
// test needs a whole throwaway database rather than a schema.
const url = process.env.USER_MGMT_TEST_DATABASE_URL;
test(
  'profile trigger: expired invitees must still set a password; backfilled invites get a fresh week',
  { skip: !url },
  async () => {
    assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url!).hostname));
    const name = `user_mgmt_test_${randomUUID().replace(/-/g, '')}`;
    const admin = await new DataSource({ type: 'postgres', url }).initialize();
    await admin.query(`CREATE DATABASE ${name}`);
    const dbUrl = new URL(url!);
    dbUrl.pathname = `/${name}`;
    const db = await new DataSource({ type: 'postgres', url: dbUrl.toString() }).initialize();
    try {
      await db.query(`CREATE SCHEMA auth`);
      await db.query(`CREATE TABLE auth.users (
        id uuid PRIMARY KEY, email text NOT NULL, email_confirmed_at timestamptz,
        confirmed_at timestamptz, invited_at timestamptz, encrypted_password text,
        raw_user_meta_data jsonb NOT NULL DEFAULT '{}')`);
      await db.query(`CREATE TABLE tch_creator (
        id bigserial PRIMARY KEY, email text NOT NULL DEFAULT '', portal_status text)`);
      await db.query(`CREATE TABLE tch_profile (
        id uuid PRIMARY KEY, email varchar(255) UNIQUE NOT NULL, role varchar(20) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending', password_set boolean NOT NULL DEFAULT true,
        display_name varchar(100) NOT NULL DEFAULT '', creator_id bigint)`);
      await db.query(`CREATE TABLE tch_invitation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) UNIQUE NOT NULL,
        role varchar(20) NOT NULL DEFAULT 'tch_member', created_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz)`);

      // State before the hardening migration ran.
      await db.query(
        `INSERT INTO tch_invitation(email, role, created_at) VALUES
        ('legacy@example.com', 'accounts', now() - interval '10 days'),
        ('recent@example.com', 'creator', now() - interval '2 days')`,
      );
      const brokenId = randomUUID(),
        withPasswordId = randomUUID();
      // A profile the buggy trigger already created, and one whose user did set a password.
      await db.query(
        `INSERT INTO tch_profile(id, email, role, status, password_set) VALUES
        ($1, 'broken@example.com', 'tch_member', 'approved', true),
        ($2, 'has-password@example.com', 'tch_member', 'approved', true)`,
        [brokenId, withPasswordId],
      );
      await db.query(
        `INSERT INTO auth.users(id, email, invited_at, encrypted_password) VALUES
        ($1, 'broken@example.com', now() - interval '9 days', ''),
        ($2, 'has-password@example.com', now() - interval '9 days', '$2a$10$hash')`,
        [brokenId, withPasswordId],
      );

      const runner = db.createQueryRunner();
      await runner.connect();
      await new HardenUserManagement1792200000000().up(runner);
      const expiresAt = async (email: string) =>
        (
          await db.query(
            `SELECT expires_at > now() + interval '6 days' AS fresh, expires_at < now() AS expired
            FROM tch_invitation WHERE email = $1`,
            [email],
          )
        )[0];
      assert.equal((await expiresAt('legacy@example.com')).expired, true);

      await new FixExpiredInviteProvisioning1792300000000().up(runner);
      await runner.release();
      await db.query(
        `CREATE TRIGGER on_auth_user_synced AFTER INSERT OR UPDATE ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.tch_sync_user_profile()`,
      );

      // Backfilled invitations get a fresh week; the repair only touches users without a password.
      assert.equal((await expiresAt('legacy@example.com')).fresh, true);
      assert.equal((await expiresAt('recent@example.com')).fresh, true);
      const passwordSet = async (id: string) =>
        (await db.query(`SELECT password_set FROM tch_profile WHERE id = $1`, [id]))[0]
          .password_set;
      assert.equal(await passwordSet(brokenId), false);
      assert.equal(await passwordSet(withPasswordId), true);

      // An invitation the API wrote that has genuinely expired stays expired.
      await db.query(
        `INSERT INTO tch_invitation(email, role, created_at, expires_at)
        VALUES ('expired@example.com', 'accounts', now() - interval '20 days', now() - interval '1 day')`,
      );
      const confirm = async (email: string, invited: boolean) => {
        const id = randomUUID();
        await db.query(
          `INSERT INTO auth.users(id, email, email_confirmed_at, invited_at, encrypted_password)
          VALUES ($1, $2, now(), $3, $4)`,
          [id, email, invited ? new Date() : null, invited ? '' : '$2a$10$hash'],
        );
        const [profile] = await db.query(
          `SELECT role, status, password_set FROM tch_profile WHERE id = $1`,
          [id],
        );
        return profile;
      };

      assert.deepEqual(await confirm('LEGACY@example.com', true), {
        role: 'accounts',
        status: 'approved',
        password_set: false,
      });
      assert.deepEqual(await confirm('expired@example.com', true), {
        role: 'tch_member',
        status: 'pending',
        password_set: false,
      });
      assert.deepEqual(await confirm('self-signup@example.com', false), {
        role: 'tch_member',
        status: 'pending',
        password_set: true,
      });
    } finally {
      await db.destroy();
      await admin.query(`DROP DATABASE ${name}`);
      await admin.destroy();
    }
  },
);
