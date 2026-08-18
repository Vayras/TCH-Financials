import { Controller, Get, Post, Patch, Req, Body, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { SkipAuth } from './skip-auth.decorator';
import { Throttle } from '@nestjs/throttler';
import { Profile, type AppRole } from '../entities/profile.entity';
import { Invitation } from '../entities/invitation.entity';
import { Creator } from '../entities/creator.entity';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private dataSource: DataSource) {}

  @SkipAuth()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Get('me')
  async getMe(@Req() req: Request & { user?: any }) {
    const user = req.user;
    if (!user || user.status === 'unknown') {
      return { status: 'unknown', role: 'tch_member', passwordSet: true, displayName: '', creatorId: null };
    }

    // Fetch displayName from profile if available
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id: user.id });

    return {
      status: user.status,
      role: user.role,
      email: user.email,
      passwordSet: user.passwordSet ?? true,
      displayName: profile?.displayName || '',
      creatorId: profile?.creatorId ?? null,
    };
  }

  @SkipAuth()
  @Post('signup-profile')
  async signupProfile(
    @Body() body: { userId: string; email: string; displayName: string; role: 'creator' | 'tch_member' }
  ) {
    const { userId, email, displayName, role } = body;
    if (!userId || !email || !role) {
      throw new BadRequestException('userId, email, and role are required.');
    }
    if (role !== 'creator' && role !== 'tch_member') {
      throw new BadRequestException('Only creator or tch_member roles can register.');
    }

    const profileRepo = this.dataSource.getRepository(Profile);
    const creatorRepo = this.dataSource.getRepository(Creator);

    // Verify profile doesn't already exist
    const existing = await profileRepo.findOneBy({ id: userId });
    if (existing) {
      return { success: true, profile: existing };
    }

    // Check if there is an existing creator by email to auto-link
    let creatorId: string | null = null;
    const cleanEmail = email.toLowerCase().trim();
    if (role === 'creator') {
      const matchedCreator = await creatorRepo.findOneBy({ email: cleanEmail });
      if (matchedCreator) {
        creatorId = matchedCreator.id;
        // Update creator status to active
        matchedCreator.portalStatus = 'active';
        await creatorRepo.save(matchedCreator);
      }
    }

    const profile = profileRepo.create({
      id: userId,
      email: cleanEmail,
      displayName: displayName || '',
      role,
      status: 'pending',
      passwordSet: true,
      creatorId,
    });

    await profileRepo.save(profile);
    return { success: true, profile };
  }

  @Post('complete-password-setup')
  @Roles('super_admin', 'accounts', 'tch_member', 'creator')
  async completePasswordSetup(@Req() req: Request & { user?: any }) {
    const userId = req.user?.id;
    const email = req.user?.email;
    if (!userId) return { success: false };

    const profileRepo = this.dataSource.getRepository(Profile);
    const invitationRepo = this.dataSource.getRepository(Invitation);

    let profile = await profileRepo.findOneBy({ id: userId });

    // Look up invitation if email is present
    let invitedRole: AppRole = 'tch_member';
    if (email) {
      const invitation = await invitationRepo.findOneBy({ email: email.toLowerCase().trim() });
      if (invitation) {
        invitedRole = invitation.role;
        invitation.acceptedAt = new Date();
        await invitationRepo.save(invitation);
      }
    }

    if (profile) {
      profile.passwordSet = true;
      if (profile.status !== 'approved') {
        profile.status = 'approved';
      }
      await profileRepo.save(profile);
    } else if (email) {
      profile = profileRepo.create({
        id: userId,
        email: email.toLowerCase().trim(),
        role: invitedRole,
        status: 'approved',
        passwordSet: false,
      });
      await profileRepo.save(profile);
    }

    return { success: true };
  }

  @Patch('profile')
  @Roles('super_admin', 'accounts', 'tch_member', 'creator')
  async updateProfile(
    @Req() req: Request & { user?: any },
    @Body() body: { displayName?: string; avatarUrl?: string }
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('Not authenticated.');
    }

    const profileRepo = this.dataSource.getRepository(Profile);
    let profile = await profileRepo.findOneBy({ id: userId });
    if (!profile) {
      throw new BadRequestException('Profile not found.');
    }

    if (body.displayName !== undefined) {
      profile.displayName = body.displayName.trim();
    }
    if (body.avatarUrl !== undefined) {
      profile.avatarUrl = body.avatarUrl.trim();
    }

    await profileRepo.save(profile);
    return { success: true, profile };
  }
}
