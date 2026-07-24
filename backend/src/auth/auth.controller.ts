import { Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { SkipAuth } from './skip-auth.decorator';
import { Throttle } from '@nestjs/throttler';
import { Profile } from '../entities/profile.entity';

import { Invitation } from '../entities/invitation.entity';

@Controller('auth')
export class AuthController {
  constructor(private dataSource: DataSource) {}

  @SkipAuth()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Get('me')
  async getMe(@Req() req: Request & { user?: any }) {
    const user = req.user;
    if (!user || user.status === 'unknown') {
      return { status: 'unknown', role: 'member', passwordSet: true };
    }
    return {
      status: user.status,
      role: user.role,
      email: user.email,
      passwordSet: user.passwordSet ?? true,
    };
  }

  @Post('complete-password-setup')
  async completePasswordSetup(@Req() req: Request & { user?: any }) {
    const userId = req.user?.id;
    const email = req.user?.email;
    if (!userId) return { success: false };

    const profileRepo = this.dataSource.getRepository(Profile);
    const invitationRepo = this.dataSource.getRepository(Invitation);

    let profile = await profileRepo.findOneBy({ id: userId });

    // Look up invitation if email is present
    let invitedRole: 'admin' | 'member' = 'member';
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
        passwordSet: true,
      });
      await profileRepo.save(profile);
    }

    return { success: true };
  }
}
