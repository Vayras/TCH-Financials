import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import { AppModule } from './app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // The frontend calls everything under /api with trailing slashes
  // (next.config has trailingSlash: true); Express's non-strict routing
  // accepts both forms, so no redirect dance is needed.
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });

  // Uploaded creator documents, same URL layout Django's MEDIA_URL used.
  app.use('/media', express.static(env.mediaRoot));

  await app.listen(env.port);
  console.log(`TCH Financials API listening on :${env.port} (prefix /api)`);
}

void bootstrap();
