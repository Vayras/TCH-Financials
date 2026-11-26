import {
  Controller,
  Get,
  Post,
  Patch,
  Req,
  Body,
  BadRequestException,
  UnauthorizedException,
  Header,
} from '@nestjs/common';
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
  @Header('Cache-Control', 'private, no-store')
  async getMe(@Req() req: Request & { user?: any }) {
    const user = req.user;
    if (!user || user.status === 'unknown') {
      return {
        status: 'unknown',
        role: 'tch_member',
        passwordSet: true,
        displayName: '',
        creatorId: null,
      };
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
  @Header('Cache-Control', 'private, no-store')
  async signupProfile(
    @Req() req: Request & { user?: any },
    @Body()
    body: {
      displayName?: unknown;
      role?: unknown;
    },
  ) {
    const userId = req.user?.id;
    const email = req.user?.email;
    const role = body?.role;
    const displayName = body?.displayName ?? '';
    if (!userId || typeof email !== 'string' || !email.trim())
      throw new UnauthorizedException('A verified account is required.');
    if (role !== 'creator' && role !== 'tch_member') {
      throw new BadRequestException('Only creator or tch_member roles can register.');
    }
    if (typeof displayName !== 'string' || displayName.length > 100) {
      throw new BadRequestException('Display name must be text of at most 100 characters.');
    }

    const profileRepo = this.dataSource.getRepository(Profile);
    const creatorRepo = this.dataSource.getRepository(Creator);

    // Verify profile doesn't already exist
    const existing = await profileRepo.findOneBy({ id: userId });
    if (existing) {
      return {
        success: true,
        profile: {
          id: existing.id,
          email: existing.email,
          role: existing.role,
          status: existing.status,
        },
      };
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
    const profile = await this.dataSource.getRepository(Profile).findOneBy({ id: userId });
    if (!profile || profile.status !== 'approved' || profile.email !== email?.toLowerCase().trim()) {
      throw new UnauthorizedException('An approved profile is required to complete password setup.');
    }

    profile.passwordSet = true;
    await profileRepo.save(profile);

    return { success: true };
  }

  @Patch('profile')
  @Roles('super_admin', 'accounts', 'tch_member', 'creator')
  @Header('Cache-Control', 'private, no-store')
  async updateProfile(
    @Req() req: Request & { user?: any },
    @Body() body: { displayName?: string; avatarUrl?: string },
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
