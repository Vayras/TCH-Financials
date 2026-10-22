import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CampaignActor } from './campaign-content.model';
import { CampaignAIService } from './campaign-ai.service';

@ApiTags('Campaign AI ideas')
@Roles('creator')
@Controller('campaigns/:id/ai-ideas')
export class CampaignAIController {
  constructor(private readonly service: CampaignAIService) {}

  @Post('generate')
  @Roles('creator')
  @Header('Cache-Control', 'private, no-store')
  async generate(
    @Req() r: { user: CampaignActor },
    @Param('id') id: string,
    @Body() body: { reference_ids?: string[] },
    @Headers('idempotency-key') key?: string,
  ) {
    if (
      !key ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)
    ) {
      throw new BadRequestException({ detail: 'A valid Idempotency-Key UUID is required.' });
    }
    return this.service.generateIdeas(r.user, id, body, key);
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
    @Param('ideaId') ideaId: string,
  ) {
    return this.service.expandIdea(r.user, id, ideaId);
  }
}
