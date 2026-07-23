import { Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { SkipAuth } from './skip-auth.decorator';
import { Throttle } from '@nestjs/throttler';
import { Profile } from '../entities/profile.entity';

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
    if (!userId) return { success: false };

    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = await profileRepo.findOneBy({ id: userId });
    if (profile) {
      profile.passwordSet = true;
      await profileRepo.save(profile);
    }
    return { success: true };
  }
}
