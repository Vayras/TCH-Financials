import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { env } from './env';
import { requestContext, structuredLog } from './common/observability';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // The frontend calls everything under /api with trailing slashes
  // (next.config has trailingSlash: true); Express's non-strict routing
  // accepts both forms, so no redirect dance is needed.
  app.setGlobalPrefix('api');
  app.use(requestContext);
  const allowedOrigins = new Set([env.appUrl, ...env.corsOrigins]);
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({ statusCode: 403, message: 'Origin is not allowed.' });
      return;
    }
    next();
  });
  app.enableCors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
  });

  await app.listen(env.port);
  structuredLog('info', 'application_started', { port: env.port, prefix: '/api', app_env: env.appEnv });
}

void bootstrap();
