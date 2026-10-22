import { Module } from '@nestjs/common';
import { CreatorSocialController } from './creator-social.controller';
import { CreatorSocialService } from './creator-social.service';
import { BrandKitController, PublicBrandKitController } from './brand-kit.controller';
import { BrandKitService } from './brand-kit.service';

@Module({
  controllers: [CreatorSocialController, BrandKitController, PublicBrandKitController],
  providers: [CreatorSocialService, BrandKitService],
})
export class CreatorSocialModule {}
