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
  @Get('import-status') importStatus() {
    return this.service.importStatus();
  }
  @Get()
  list(@Req() req: CreatorRequest) {
    return this.service.list(req.user);
  }
  @Post()
  @ApiOperation({ summary: 'Link an Instagram account without triggering a collection' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username'],
      properties: {
        username: {
          type: 'string',
          example: 'creator_handle',
          description: 'Instagram username or HTTPS profile URL',
        },
      },
    },
  })
  connect(@Req() req: CreatorRequest, @Body() body: { username?: unknown }) {
    return this.service.connect(req.user, body?.username);
  }
  @Post('create-kit')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Create a kit from an Instagram username: profile plus up to 12 recent posts',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username'],
      properties: { username: { type: 'string' } },
    },
  })
  async createKit(
    @Req() req: CreatorRequest,
    @Body() body: { username?: unknown },
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.createKit(req.user, body?.username, key);
  }
  @Get(':id/snapshot')
  snapshot(
    @Req() req: CreatorRequest,
    @Param('id') id: string,
    @Query('snapshot_id') snapshotId?: string,
  ) {
    return this.service.snapshot(req.user, id, snapshotId);
  }
  @Post(':id/refresh')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Refresh the saved profile and recent posts through the configured provider',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  refresh(
    @Req() req: CreatorRequest,
    @Param('id') id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.refresh(req.user, id, key);
  }
  @Get(':id/imports/:jobId')
  job(@Req() req: CreatorRequest, @Param('id') id: string, @Param('jobId') jobId: string) {
    return this.service.job(req.user, id, jobId);
  }
}
