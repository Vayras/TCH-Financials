import { Body, Controller, Get, Header, Param, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { PublicRoute } from '../auth/public.decorator';
import { SocialActor } from './creator-social.service';
import { BrandKitService } from './brand-kit.service';

@Roles('creator')
@ApiTags('Creator brand kit')
@Controller('creator-portal/brand-kit')
export class BrandKitController {
  constructor(private readonly service: BrandKitService) {}
  @Get() get(@Req() req: { user: SocialActor }) { return this.service.get(req.user); }
  @Put() save(@Req() req: { user: SocialActor }, @Body() body: { version?: unknown; draft?: unknown }) { return this.service.save(req.user, body); }
  @Post('publish') publish(@Req() req: { user: SocialActor }, @Body() body: { version?: unknown }) { return this.service.publish(req.user, body?.version); }
  @Post('unpublish') unpublish(@Req() req: { user: SocialActor }, @Body() body: { version?: unknown }) { return this.service.unpublish(req.user, body?.version); }
}

@ApiTags('Published brand kits')
@Controller('public/brand-kits')
export class PublicBrandKitController {
  constructor(private readonly service: BrandKitService) {}
  @Get(':slug')
  @PublicRoute()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read only the explicitly published brand kit', security: [] })
  get(@Param('slug') slug: string) { return this.service.published(slug); }
}
