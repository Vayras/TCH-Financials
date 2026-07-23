import { Controller, Get, Post, Delete, Body, Param, BadRequestException, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import { sendInviteEmail } from '../common/mail';
import { Profile } from '../entities/profile.entity';
import { Invitation } from '../entities/invitation.entity';
import { Roles } from '../auth/roles.decorator';

@Roles('admin')
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
  // getUserByEmail() does not exist in the Supabase JS SDK. We query auth.users
  // directly using the existing TypeORM DataSource connection (service-role creds).
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
    const profiles = await profileRepo.find({ order: { createdAt: 'DESC' } });
    const invitations = await invitationRepo.find({ order: { createdAt: 'DESC' } });
    return { profiles, invitations };
  }

  @Post(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { role: 'admin' | 'member' }, @Req() req: any) {
    const { role } = body;
    if (!role || (role !== 'admin' && role !== 'member')) {
      throw new BadRequestException('Role must be either admin or member.');
    }
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');

    if (profile.id === req.user?.id) {
      throw new BadRequestException('You cannot change your own role.');
    }

    profile.role = role;
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

  // ─── Revoke Access: blocks an approved user immediately ──────────────────────
  // Sets status = 'rejected' AND deletes their refresh tokens so their current
  // JWT cannot be renewed. The user is blocked on their next page load.
  @Post(':id/revoke')
  async revokeAccess(@Param('id') id: string, @Req() req: any) {
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');

    // Safety guards — cannot revoke admins or yourself
    if (profile.role === 'admin') {
      throw new BadRequestException('Cannot revoke access for admin accounts.');
    }
    if (profile.id === req.user?.id) {
      throw new BadRequestException('You cannot revoke your own access.');
    }

    profile.status = 'rejected';
    await profileRepo.save(profile);

    // Immediately invalidate all active sessions by wiping refresh tokens
    await this.revokeRefreshTokens(profile.id);

    return { success: true, profile };
  }

  // ─── Delete User: permanently removes from our DB + Supabase auth ────────────
  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id });
    if (!profile) throw new BadRequestException('User profile not found.');

    // Safety guards — cannot delete admins or yourself
    if (profile.role === 'admin') {
      throw new BadRequestException('Cannot delete admin accounts. Revoke admin role first.');
    }
    if (profile.id === req.user?.id) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    // Delete from Supabase auth (this invalidates all sessions permanently)
    if (this.supabaseAdmin) {
      const { error } = await this.supabaseAdmin.auth.admin.deleteUser(profile.id);
      if (error) {
        throw new BadRequestException(`Failed to delete Supabase auth user: ${error.message}`);
      }
    }

    // Delete profile from our DB
    await profileRepo.remove(profile);
    return { success: true };
  }

  // ─── Cancel Invitation: removes invite + associated unconfirmed auth user ─────
  @Delete('invitations/:id')
  async deleteInvitation(@Param('id') id: string) {
    const invitationRepo = this.dataSource.getRepository(Invitation);
    const invitation = await invitationRepo.findOneBy({ id });
    if (!invitation) throw new BadRequestException('Invitation not found.');

    // If the invitation hasn't been accepted yet, also remove the skeleton auth user
    // that Supabase created via generateLink when the invite was sent.
    // We use raw SQL (not the broken listUsers pagination approach) to find the auth user.
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
  async inviteUser(@Body() body: { email: string; role: 'admin' | 'member' }) {
    const { email, role } = body;
    if (!email || !role) throw new BadRequestException('Email and role are required.');

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
