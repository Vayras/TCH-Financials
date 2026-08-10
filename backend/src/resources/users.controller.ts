import { Controller, Get, Post, Delete, Body, Param, BadRequestException, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import { sendInviteEmail } from '../common/mail';
import { Profile, type AppRole } from '../entities/profile.entity';
import { Invitation } from '../entities/invitation.entity';
import { Roles } from '../auth/roles.decorator';

// Roles that can self-select at sign-up — admins cannot be self-assigned
const SELF_SELECTABLE_ROLES: AppRole[] = ['creator', 'tch_member'];
const ALL_ROLES: AppRole[] = ['super_admin', 'accounts', 'tch_member', 'creator'];

@Roles('super_admin', 'accounts')
@Controller('admin/users')
export class UsersController {
  private supabaseAdmin: SupabaseClient | null = null;

  constructor(private dataSource: DataSource) {
    if (env.supabaseUrl && env.supabaseServiceRoleKey) {
      this.supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  // ─── Helper: look up Supabase auth.users.id by email via direct DB query ───
  private async getAuthUserIdByEmail(email: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase().trim()],
    );
    return (rows[0]?.id as string) ?? null;
  }

  // ─── Helper: delete a user's refresh tokens to immediately invalidate sessions ─
  private async revokeRefreshTokens(userId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM auth.refresh_tokens WHERE user_id = $1`,
      [userId],
    );
  }

  @Get()
  async listUsers() {
    const profileRepo = this.dataSource.getRepository(Profile);
    const invitationRepo = this.dataSource.getRepository(Invitation);

    const profiles = await profileRepo.createQueryBuilder('profile')
      .where("profile.role != 'creator'")
      .orderBy('profile.createdAt', 'DESC')
      .getMany();

    const invitations = await invitationRepo.createQueryBuilder('invitation')
      .where("invitation.role != 'creator'")
      .orderBy('invitation.createdAt', 'DESC')
      .getMany();

    return { profiles, invitations };
  }

  // ─── Update Role: only super_admin can assign super_admin or accounts roles ──
  @Roles('super_admin')
  @Post(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { role: AppRole; creatorId?: string }, @Req() req: any) {
    const { role, creatorId } = body;
    if (!role || !ALL_ROLES.includes(role)) {
      throw new BadRequestException(`Role must be one of: ${ALL_ROLES.join(', ')}.`);
    }

    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');

    if (profile.id === req.user?.id) {
      throw new BadRequestException('You cannot change your own role.');
    }

    profile.role = role;

    // When assigning creator role, optionally link to tch_creator record
    if (role === 'creator' && creatorId) {
      profile.creatorId = String(creatorId);
    } else if (role !== 'creator') {
      // Clear creator link if role changes away from creator
      profile.creatorId = null;
    }

    await profileRepo.save(profile);
    return { success: true, profile };
  }

  @Post(':id/approve')
  async approveUser(@Param('id') id: string) {
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');
    profile.status = 'approved';
    await profileRepo.save(profile);
    return { success: true, profile };
  }

  @Post(':id/reject')
  async rejectUser(@Param('id') id: string) {
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');
    profile.status = 'rejected';
    await profileRepo.save(profile);
    return { success: true, profile };
  }

  // ─── Revoke Access ────────────────────────────────────────────────────────────
  @Post(':id/revoke')
  async revokeAccess(@Param('id') id: string, @Req() req: any) {
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');

    // Cannot revoke super_admins or yourself
    if (profile.role === 'super_admin') {
      throw new BadRequestException('Cannot revoke access for super admin accounts.');
    }
    if (profile.id === req.user?.id) {
      throw new BadRequestException('You cannot revoke your own access.');
    }

    profile.status = 'rejected';
    await profileRepo.save(profile);

    await this.revokeRefreshTokens(profile.id);

    return { success: true, profile };
  }

  // ─── Delete User ──────────────────────────────────────────────────────────────
  @Roles('super_admin')
  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');

    if (profile.role === 'super_admin') {
      throw new BadRequestException('Cannot delete super admin accounts. Revoke role first.');
    }
    if (profile.id === req.user?.id) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    if (this.supabaseAdmin) {
      const { error } = await this.supabaseAdmin.auth.admin.deleteUser(profile.id);
      if (error) {
        throw new BadRequestException(`Failed to delete Supabase auth user: ${error.message}`);
      }
    }

    await profileRepo.remove(profile);
    return { success: true };
  }

  // ─── Cancel Invitation ────────────────────────────────────────────────────────
  @Delete('invitations/:id')
  async deleteInvitation(@Param('id') id: string) {
    const invitationRepo = this.dataSource.getRepository(Invitation);
    const invitation = await invitationRepo.findOneBy({ id });
    if (!invitation) throw new BadRequestException('Invitation not found.');

    if (!invitation.acceptedAt && this.supabaseAdmin) {
      const authUserId = await this.getAuthUserIdByEmail(invitation.email);
      if (authUserId) {
        await this.supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
    }

    await invitationRepo.remove(invitation);
    return { success: true };
  }

  // ─── Invite User ──────────────────────────────────────────────────────────────
  @Post('invite')
  async inviteUser(@Body() body: { email: string; role: AppRole }) {
    const { email, role } = body;
    if (!email || !role) throw new BadRequestException('Email and role are required.');
    if (!ALL_ROLES.includes(role)) {
      throw new BadRequestException(`Role must be one of: ${ALL_ROLES.join(', ')}.`);
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) throw new BadRequestException('Email is invalid.');

    const profileRepo = this.dataSource.getRepository(Profile);
    const existingProfile = await profileRepo.findOneBy({ email: trimmedEmail });
    if (existingProfile) {
      throw new BadRequestException('User with this email already has a profile.');
    }

    const invitationRepo = this.dataSource.getRepository(Invitation);
    let invitation = await invitationRepo.findOneBy({ email: trimmedEmail });

    if (invitation && invitation.acceptedAt === null) {
      invitation.role = role;
      await invitationRepo.save(invitation);
    } else {
      invitation = invitationRepo.create({ email: trimmedEmail, role });
      await invitationRepo.save(invitation);
    }

    if (this.supabaseAdmin) {
      const redirectTo = `${env.appUrl}/auth/callback`;
      const { data, error } = await this.supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: trimmedEmail,
        options: { redirectTo },
      });
      if (error) throw new BadRequestException(`Supabase invitation failed: ${error.message}`);

      const inviteUrl = data.properties?.action_link;
      if (!inviteUrl) {
        throw new BadRequestException('Supabase invitation failed: no action link returned.');
      }

      try {
        await sendInviteEmail({ to: trimmedEmail, inviteUrl });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        throw new BadRequestException(`Failed to send invite email: ${message}`);
      }
    } else {
      console.log(`[DEV] Simulating invite to: ${trimmedEmail} with role: ${role}`);
    }

    return { success: true, invitation };
  }
}
