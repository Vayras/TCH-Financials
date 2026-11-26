import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenUserManagement1792200000000 implements MigrationInterface {
  name = 'HardenUserManagement1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.tch_invitation
      ADD COLUMN IF NOT EXISTS expires_at timestamptz
    `);
    await queryRunner.query(`
      UPDATE public.tch_invitation
      SET expires_at = created_at + interval '7 days'
      WHERE expires_at IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE public.tch_invitation
      ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days'),
      ALTER COLUMN expires_at SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE public.tch_profile
      ADD CONSTRAINT chk_tch_profile_role
      CHECK (role IN ('super_admin', 'accounts', 'tch_member', 'creator'))
    `);
    await queryRunner.query(`
      ALTER TABLE public.tch_invitation
      ADD CONSTRAINT chk_tch_invitation_role
      CHECK (role IN ('super_admin', 'accounts', 'tch_member', 'creator'))
    `);

    // The application uses its trusted PostgreSQL connection. Browser Supabase
    // clients must not read or modify profiles and invitations through PostgREST.
    await queryRunner.query(`ALTER TABLE public.tch_profile ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE public.tch_invitation ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(
      `REVOKE ALL ON TABLE public.tch_profile, public.tch_invitation FROM PUBLIC`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON TABLE public.tch_profile, public.tch_invitation FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON TABLE public.tch_profile, public.tch_invitation FROM authenticated;
        END IF;
      END $$;
    `);

    // SECURITY DEFINER is required because the trigger runs on auth.users.
    // Keep its search path fixed and derive privileged roles only from a valid,
    // unexpired invitation written by the trusted application.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.tch_sync_user_profile()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog
      AS $$
      DECLARE
        invited_role text;
        requested_role text;
        is_invited boolean := false;
        existing_id uuid;
        linked_creator_id bigint;
      BEGIN
        IF NEW.email_confirmed_at IS NULL AND NEW.confirmed_at IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT id INTO existing_id
        FROM public.tch_profile
        WHERE id = NEW.id
        LIMIT 1;
        IF existing_id IS NOT NULL THEN
          RETURN NEW;
        END IF;

        UPDATE public.tch_invitation
        SET accepted_at = pg_catalog.now()
        WHERE id = (
            SELECT id
            FROM public.tch_invitation
            WHERE pg_catalog.lower(email) = pg_catalog.lower(NEW.email)
              AND accepted_at IS NULL
              AND expires_at > pg_catalog.now()
              AND role IN ('super_admin', 'accounts', 'tch_member', 'creator')
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          )
          AND accepted_at IS NULL
          AND expires_at > pg_catalog.now()
          AND role IN ('super_admin', 'accounts', 'tch_member', 'creator')
        RETURNING role INTO invited_role;
        is_invited := FOUND;

        IF NOT is_invited THEN
          requested_role := NEW.raw_user_meta_data ->> 'role';
          IF requested_role IN ('creator', 'tch_member') THEN
            invited_role := requested_role;
          ELSE
            invited_role := 'tch_member';
          END IF;
        END IF;

        IF invited_role = 'creator' THEN
          SELECT id INTO linked_creator_id
          FROM public.tch_creator
          WHERE email <> '' AND pg_catalog.lower(email) = pg_catalog.lower(NEW.email)
          LIMIT 1;

          IF linked_creator_id IS NOT NULL THEN
            UPDATE public.tch_creator
            SET portal_status = 'active'
            WHERE id = linked_creator_id;
          END IF;
        END IF;

        INSERT INTO public.tch_profile
          (id, email, role, status, password_set, display_name, creator_id)
        VALUES (
          NEW.id,
          pg_catalog.lower(NEW.email),
          invited_role,
          CASE WHEN is_invited THEN 'approved' ELSE 'pending' END,
          NOT is_invited,
          pg_catalog.left(COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''), 100),
          linked_creator_id
        )
        ON CONFLICT (id) DO NOTHING;

        RETURN NEW;
      END;
      $$;
    `);
    await queryRunner.query(`
      REVOKE ALL ON FUNCTION public.tch_sync_user_profile() FROM PUBLIC
    `);
  }

  public async down(): Promise<void> {
    throw new Error(
      'This security migration is intentionally irreversible; reverting it would restore unsafe role provisioning and public table access.',
    );
  }
}
