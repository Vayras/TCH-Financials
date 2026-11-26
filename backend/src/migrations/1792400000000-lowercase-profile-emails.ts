import { MigrationInterface, QueryRunner } from 'typeorm';

// Profiles created by the 1752700000000 trigger stored auth.users.email as
// typed. Everything since stores and looks up lowercased addresses (password
// setup, the invite duplicate check), so normalise the old rows. Rows that
// would collide with another profile case-insensitively are left for manual
// review instead of failing the unique constraint.
export class LowercaseProfileEmails1792400000000 implements MigrationInterface {
  name = 'LowercaseProfileEmails1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.tch_profile p
      SET email = lower(trim(p.email))
      WHERE p.email <> lower(trim(p.email))
        AND NOT EXISTS (
          SELECT 1 FROM public.tch_profile other
          WHERE other.id <> p.id AND lower(trim(other.email)) = lower(trim(p.email))
        )
    `);
  }

  public async down(): Promise<void> {
    // The original casing carried no meaning and is not restored.
  }
}
