import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DataSource } from 'typeorm';
import { env } from '../env';
import { Profile } from '../entities/profile.entity';
import { SKIP_AUTH_KEY } from './skip-auth.decorator';

type Jwks = ReturnType<typeof createRemoteJWKSet>;

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private jwks: Jwks | null = null;

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  private getJwks(): Jwks {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(
        new URL(`${env.supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`),
      );
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSkipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!env.supabaseUrl && !env.supabaseJwtSecret) {
      // In local dev without auth, we simulate a mock admin user
      const req = context.switchToHttp().getRequest<Request>();
      (req as Request & { user?: unknown }).user = {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'dev@theculturehub.co.in',
        role: 'admin',
        status: 'approved',
      };
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedException({ detail: 'Authentication credentials were not provided.' });
    }
    const token = header.slice('Bearer '.length).trim();
    try {
      const { payload } = env.supabaseJwtSecret
        ? await jwtVerify(token, new TextEncoder().encode(env.supabaseJwtSecret), {
            audience: 'authenticated',
            algorithms: ['HS256'],
          })
        : await jwtVerify(token, this.getJwks(), {
            audience: 'authenticated',
            algorithms: ['ES256', 'RS256'],
          });

      const userId = payload.sub ?? '';
      const email = (payload as { email?: string }).email ?? '';

      // Look up profile in database
      const profileRepo = this.dataSource.getRepository(Profile);
      const profile = await profileRepo.findOneBy({ id: userId });

      const user = {
        id: userId,
        email: email,
        role: profile ? profile.role : 'member',
        status: profile ? profile.status : 'unknown',
        passwordSet: profile ? (profile.passwordSet ?? true) : true,
      };

      (req as Request & { user?: unknown }).user = user;

      // If it is a @SkipAuth route, allow passing even if pending/rejected
      if (isSkipAuth) {
        return true;
      }

      // Otherwise, only approved users can pass
      if (!profile || profile.status !== 'approved') {
        throw new UnauthorizedException({ detail: 'Access denied.' });
      }

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        detail: `Invalid or expired token: ${(err as Error).message}`,
      });
    }
  }
}
