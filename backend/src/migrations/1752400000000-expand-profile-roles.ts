import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Expand profile roles to the full 4-role organisational model.
 *
 * Role renames (safe — no data loss):
 *   admin  → super_admin
 *   member → tch_member
 *
 * New columns on tch_profile:
 *   creator_id   (bigint nullable) — links creator-role user to tch_creator
 *   display_name (varchar 100)
 *   avatar_url   (varchar 400)
 *
 * New columns on tch_creator:
 *   email         (varchar 200) — for portal invite; optional
 *   portal_status (varchar 20)  — none | invited | active
 *
 * New roles added to tch_invitation:
 *   accounts | tch_member | creator (previously only admin | member)
 */
export class ExpandProfileRoles1752400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Profile table: new columns ───────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE tch_profile
        ADD COLUMN IF NOT EXISTS creator_id bigint REFERENCES tch_creator(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS display_name varchar(100) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS avatar_url varchar(400) NOT NULL DEFAULT ''
    `);

    // ── 2. Profile table: rename existing roles ─────────────────────────────
    // Widen column first so both old and new values fit during the transition
    await queryRunner.query(`
      ALTER TABLE tch_profile ALTER COLUMN role TYPE varchar(20)
    `);
    await queryRunner.query(`
      UPDATE tch_profile SET role = 'super_admin' WHERE role = 'admin'
    `);
    await queryRunner.query(`
      UPDATE tch_profile SET role = 'tch_member' WHERE role = 'member'
    `);

    // ── 3. Invitation table: rename roles to match ──────────────────────────
    await queryRunner.query(`
      ALTER TABLE tch_invitation ALTER COLUMN role TYPE varchar(20)
    `);
    await queryRunner.query(`
      UPDATE tch_invitation SET role = 'super_admin' WHERE role = 'admin'
    `);
    await queryRunner.query(`
      UPDATE tch_invitation SET role = 'tch_member' WHERE role = 'member'
    `);

    // ── 4. Creator table: add portal access fields ──────────────────────────
    await queryRunner.query(`
      ALTER TABLE tch_creator
        ADD COLUMN IF NOT EXISTS email varchar(200) NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS portal_status varchar(20) NOT NULL DEFAULT 'none'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Revert creator portal columns ───────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE tch_creator
        DROP COLUMN IF EXISTS email,
        DROP COLUMN IF EXISTS portal_status
    `);

    // ── Revert invitation roles ─────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE tch_invitation SET role = 'member' WHERE role IN ('tch_member', 'creator', 'accounts')
    `);
    await queryRunner.query(`
      UPDATE tch_invitation SET role = 'admin' WHERE role = 'super_admin'
    `);

    // ── Revert profile roles ────────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE tch_profile SET role = 'member' WHERE role IN ('tch_member', 'creator', 'accounts')
    `);
    await queryRunner.query(`
      UPDATE tch_profile SET role = 'admin' WHERE role = 'super_admin'
    `);

    // ── Drop profile new columns ────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE tch_profile
        DROP COLUMN IF EXISTS creator_id,
        DROP COLUMN IF EXISTS display_name,
        DROP COLUMN IF EXISTS avatar_url
    `);
  }
}
