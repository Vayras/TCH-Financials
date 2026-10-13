import {Body,Controller,Get,Header,Param,Post,Put,Query,Req} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {CampaignActor,invalid} from './campaign-content.model';
import {ContentConceptService} from './content-concept.service';
@ApiTags('Campaign concepts')
@Roles('super_admin','tch_member','creator')
@Controller('campaigns/:id/concepts')
export class ContentConceptController {
 constructor(private readonly service:ContentConceptService) {}
 @Get() @Header('Cache-Control','private, no-store')
 list(@Req() r:{user:CampaignActor},@Param('id') id:string,@Query('page') page='1') {
  if(!/^\d+$/.test(page)||Number(page)<1||Number(page)>100000) invalid('page','Invalid page.');
  return this.service.list(r.user,id,Number(page));
 }
 @Post() @Roles('creator')
 create(@Req() r:{user:CampaignActor},@Param('id') id:string,@Body() b:unknown){return this.service.save(r.user,id,b);}
 @Put(':cid') @Roles('creator')
 save(@Req() r:{user:CampaignActor},@Param('id') id:string,@Param('cid') cid:string,@Body() b:unknown){return this.service.save(r.user,id,b,cid);}
 @Post(':cid/actions')
 action(@Req() r:{user:CampaignActor},@Param('id') id:string,@Param('cid') cid:string,@Body() b:unknown){return this.service.action(r.user,id,cid,b);}
 @Get(':cid/history') @Header('Cache-Control','private, no-store')
 history(@Req() r:{user:CampaignActor},@Param('id') id:string,@Param('cid') cid:string,@Query('page') page='1'){
  if(!/^\d+$/.test(page)||Number(page)<1||Number(page)>100000) invalid('page','Invalid page.');
  return this.service.history(r.user,id,cid,Number(page));
 }
 @Post(':cid/comments')
 comment(@Req() r:{user:CampaignActor},@Param('id') id:string,@Param('cid') cid:string,@Body() b:unknown){return this.service.comment(r.user,id,cid,b);}
}
