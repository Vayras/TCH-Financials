import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { env } from './env';

export function createApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('TCH Financials API')
    .setVersion('1.0')
    .setDescription('All registered backend routes. Use Authorize with your Supabase access token. Role and creator-ownership checks still apply. Some legacy endpoints use untyped request/response objects, so their schemas are incomplete. Creator imports require the database migration and a configured worker.')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addSecurityRequirements('bearer');
  if (env.appEnv === 'development' && !env.supabaseUrl && !env.supabaseJwtSecret) {
    config.addApiKey({ type: 'apiKey', in: 'header', name: 'x-tch-dev-user', description: 'Local mock auth only: email of an approved development account. Leave empty for the default development admin.' }, 'development-user')
      .addSecurityRequirements('development-user');
  }
  return SwaggerModule.createDocument(app, config.build());
}

export function setupSwagger(app: INestApplication) {
  if (!env.swaggerEnabled) return;
  SwaggerModule.setup('api/docs', app, () => createApiDocument(app), {
    jsonDocumentUrl: '/api/docs-json',
    swaggerOptions: { persistAuthorization: false, filter: true, docExpansion: 'none', tagsSorter: 'alpha' },
    customSiteTitle: 'TCH API Docs',
  });
}
