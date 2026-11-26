import { MigrationInterface, QueryRunner } from 'typeorm';

// Follow-up to HardenUserManagement1792200000000. An invitee whose
// invitation had expired fell through to the self-signup branch and got a
// profile with password_set = true, although invitees never choose a
// password. After approval the guard never sent them to /set-password and
// they could not sign in.
export class FixExpiredInviteProvisioning1792300000000 implements MigrationInterface {
  name = 'FixExpiredInviteProvisioning1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
          -- Users created through an invite link (auth.users.invited_at) have
          -- never chosen a password, even when their invitation has expired.
          NOT is_invited AND NEW.invited_at IS NULL,
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
      'Irreversible: the previous trigger body created invitees without a password requirement.',
    );
  }
}
