import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfilesAndInvitations1752300000000 implements MigrationInterface {
  name = 'AddProfilesAndInvitations1752300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create tables
    await queryRunner.query(`
      CREATE TABLE tch_profile (
        id         UUID PRIMARY KEY,
        email      VARCHAR(255) UNIQUE NOT NULL,
        role       VARCHAR(20) NOT NULL DEFAULT 'member',
        status     VARCHAR(20) NOT NULL DEFAULT 'pending',
        password_set BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE tch_invitation (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email       VARCHAR(255) UNIQUE NOT NULL,
        role        VARCHAR(20) NOT NULL DEFAULT 'member',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        accepted_at TIMESTAMPTZ
      )
    `);

    // 2. Create triggers to automatically manage profiles based on auth.users changes
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.tch_sync_user_profile()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      DECLARE
        invited_role VARCHAR(20) := 'member';
        is_invited   BOOLEAN := FALSE;
        existing_id  UUID;
      BEGIN
        -- If not confirmed, do nothing yet
        IF NEW.email_confirmed_at IS NULL AND NEW.confirmed_at IS NULL THEN
          RETURN NEW;
        END IF;

        -- Check if profile already exists
        SELECT id INTO existing_id FROM public.tch_profile WHERE id = NEW.id LIMIT 1;
        IF existing_id IS NOT NULL THEN
          RETURN NEW;
        END IF;

        -- Check if this email was invited by an admin
        SELECT role, TRUE INTO invited_role, is_invited
        FROM public.tch_invitation
        WHERE email = NEW.email AND accepted_at IS NULL
        LIMIT 1;

        -- Mark invitation as accepted
        IF is_invited THEN
          UPDATE public.tch_invitation SET accepted_at = now() WHERE email = NEW.email;
        END IF;

        -- Create profile
        INSERT INTO public.tch_profile (id, email, role, status, password_set)
        VALUES (
          NEW.id,
          NEW.email,
          invited_role,
          CASE WHEN is_invited THEN 'approved' ELSE 'pending' END,
          CASE WHEN is_invited THEN FALSE ELSE TRUE END
        )
        ON CONFLICT (id) DO NOTHING;

        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE TRIGGER on_auth_user_synced
        AFTER INSERT OR UPDATE ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.tch_sync_user_profile();
    `);

    // 3. Seed existing 3 users (as approved)
    await queryRunner.query(`
      INSERT INTO tch_profile (id, email, role, status) VALUES
        ('659afca2-ad2f-47b1-98f3-47d3160e174c', 'admin@theculturehub.co.in', 'admin', 'approved'),
        ('5bb31b81-1296-4fca-9bb6-02e39501a730', 'arzoo@theculturehub.co.in', 'member', 'approved'),
        ('acbb1017-03e0-45a4-9b56-b9df0e6497fa', 'mayank@theculturehub.co.in', 'member', 'approved')
      ON CONFLICT (id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS on_auth_user_synced ON auth.users`);
    
    // Drop trigger functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.tch_sync_user_profile()`);
    
    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS tch_invitation`);
    await queryRunner.query(`DROP TABLE IF EXISTS tch_profile`);
  }
}
