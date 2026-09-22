import { Controller, Get, Header, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CampaignActor } from './campaign-content.model';
import { CampaignAIService } from './campaign-ai.service';

@ApiTags('Campaign AI ideas')
@Roles('creator', 'super_admin', 'tch_member')
@Controller('campaigns/:id/ai-ideas')
export class CampaignAIController {
  constructor(private readonly service: CampaignAIService) {}

  @Post('generate')
  @Roles('creator')
  @Header('Cache-Control', 'private, no-store')
  async generate(@Req() r: { user: CampaignActor }, @Param('id') id: string) {
    return this.service.generateIdeas(r.user, id);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() r: { user: CampaignActor }, @Param('id') id: string) {
    return this.service.listIdeas(r.user, id);
  }

  @Post(':ideaId/expand')
  @Roles('creator')
  @Header('Cache-Control', 'private, no-store')
  async expand(
    @Req() r: { user: CampaignActor },
    @Param('id') id: string,
    @Param('ideaId') ideaId: string
  ) {
    return this.service.expandIdea(r.user, id, ideaId);
  }
}

