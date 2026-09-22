import { Module } from '@nestjs/common';
import { CampaignContentController, CreatorCampaignBriefController } from './campaign-content.controller';
import { CampaignContentService } from './campaign-content.service';
import { ContentConceptController } from './content-concept.controller';
import { ContentConceptService } from './content-concept.service';
import { CampaignAIController } from './campaign-ai.controller';
import { CampaignAIService } from './campaign-ai.service';

@Module({
  controllers: [
    CampaignContentController,
    CreatorCampaignBriefController,
    ContentConceptController,
    CampaignAIController,
  ],
  providers: [
    CampaignContentService,
    ContentConceptService,
    CampaignAIService,
  ],
})
export class CampaignContentModule {}

