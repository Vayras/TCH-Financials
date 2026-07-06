// Supabase JWT auth. The frontend signs users in with Supabase Auth (GoTrue)
// and sends the session's access token as `Authorization: Bearer <jwt>`. We
// verify the signature against the project's public JWKS (ES256/RS256) — or
// HS256 with SUPABASE_JWT_SECRET for projects on the legacy symmetric scheme.
// When neither SUPABASE_URL nor the secret is configured, the API runs open
// (bare local dev), mirroring the frontend's isSupabaseConfigured() behavior.

import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../env';

type Jwks = ReturnType<typeof createRemoteJWKSet>;

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private jwks: Jwks | null = null;

  private getJwks(): Jwks {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(
        new URL(`${env.supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`),
      );
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!env.supabaseUrl && !env.supabaseJwtSecret) return true;

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
      (req as Request & { user?: unknown }).user = {
        id: payload.sub ?? '',
        email: (payload as { email?: string }).email ?? '',
        claims: payload,
      };
      return true;
    } catch (err) {
      throw new UnauthorizedException({
        detail: `Invalid or expired token: ${(err as Error).message}`,
      });
    }
  }
}
