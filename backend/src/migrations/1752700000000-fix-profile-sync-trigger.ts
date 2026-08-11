import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixProfileSyncTrigger1752700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.tch_sync_user_profile()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
      DECLARE
        invited_role VARCHAR(20);
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

        -- Fallback role resolution if no invite exists
        IF invited_role IS NULL THEN
          invited_role := COALESCE(NEW.raw_user_meta_data->>'role', 'tch_member');
        END IF;

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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Keep function intact on rollback to avoid breaking database integrity
  }
}
