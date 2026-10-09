import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CreatorSocialService, SocialActor } from './creator-social.service';

type CreatorRequest = Request & { user: SocialActor };

@Roles('creator')
@ApiTags('Creator social accounts')
@Controller('creator-portal/social-accounts')
export class CreatorSocialController {
  constructor(private readonly service: CreatorSocialService) {}
  @Get()
  list(@Req() req: CreatorRequest) { return this.service.list(req.user); }
  @Post()
  @ApiOperation({ summary: 'Link an Instagram account without triggering a collection' })
  @ApiBody({ schema: { type: 'object', required: ['username'], properties: { username: { type: 'string', example: 'creator_handle', description: 'Instagram username or HTTPS profile URL' } } } })
  connect(@Req() req: CreatorRequest, @Body() body: { username?: unknown }) {
    return this.service.connect(req.user, body?.username);
  }
  @Post('create-kit')
  @HttpCode(202)
  @ApiOperation({ summary: 'Create a kit from an Instagram username: profile plus up to 30 recent posts' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: { type: 'object', required: ['username'], properties: { username: { type: 'string' } } } })
  async createKit(@Req() req: CreatorRequest, @Body() body: { username?: unknown }, @Headers('idempotency-key') key?: string) {
    const account = await this.service.connect(req.user, body?.username);
    return this.service.refresh(req.user, account.id, key, 'kit');
  }
  @Post(':id/update-insights')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  updateInsights(@Req() req: CreatorRequest, @Param('id') id: string, @Headers('idempotency-key') key?: string) {
    return this.service.refresh(req.user, id, key, 'update');
  }
  @Post(':id/load-more')
  @HttpCode(202)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  loadMore(@Req() req: CreatorRequest, @Param('id') id: string, @Headers('idempotency-key') key?: string) {
    return this.service.refresh(req.user, id, key, 'more');
  }
  @Get(':id/snapshot')
  snapshot(@Req() req: CreatorRequest, @Param('id') id: string, @Query('snapshot_id') snapshotId?: string) { return this.service.snapshot(req.user, id, snapshotId); }
  @Post(':id/refresh')
  @HttpCode(202)
  @ApiOperation({ summary: 'Request an initial import or manual refresh', description: 'Creator only. Enqueues a potentially billable collection when imports are enabled. Reuse the same UUID when retrying the same request.' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  refresh(@Req() req: CreatorRequest, @Param('id') id: string, @Headers('idempotency-key') key?: string) {
    return this.service.refresh(req.user, id, key);
  }
  @Get(':id/imports/:jobId')
  job(@Req() req: CreatorRequest, @Param('id') id: string, @Param('jobId') jobId: string) {
    return this.service.job(req.user, id, jobId);
  }
}

@Roles('super_admin')
@ApiTags('Social import operations')
@Controller('creator-social-imports')
export class SocialImportOperationsController {
  constructor(private readonly service: CreatorSocialService) {}
  @Post(':id/reconcile')
  @HttpCode(202)
  @ApiOperation({ summary: 'Resume an unresolved import using an existing provider snapshot', description: 'Super admin only. Does not trigger a new collection.' })
  @ApiBody({ schema: { type: 'object', required: ['provider_snapshot_id'], properties: { provider_snapshot_id: { type: 'string', example: 's_existing_snapshot' } } } })
  reconcile(@Param('id') id: string, @Body() body: { provider_snapshot_id?: unknown }) {
    return this.service.reconcile(id, body?.provider_snapshot_id);
  }
}
