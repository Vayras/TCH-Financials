import { Body, Controller, Get, Header, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CampaignContentService } from './campaign-content.service';
import { CampaignActor, invalid } from './campaign-content.model';
type ActorRequest = {user:CampaignActor};
function pagination(page='1',size='20') {
  if(!/^\d+$/.test(page)||!/^\d+$/.test(size)||Number(page)<1||Number(page)>100000||Number(size)<1||Number(size)>50) invalid('page','Use a positive page and page_size between 1 and 50.');
  return [Number(page),Number(size)] as const;
}
@ApiTags('Campaign briefs')
@Roles('super_admin','tch_member')
@Controller('campaigns/:id/brief')
export class CampaignContentController {
  constructor(private readonly service:CampaignContentService) {}
  @Get() @Header('Cache-Control','private, no-store')
  get(@Req() r:ActorRequest,@Param('id') id:string) {return this.service.getAgencyBrief(r.user,id);}
  @Put() @Header('Cache-Control','private, no-store')
  @ApiOperation({summary:'Save an agency-only draft; stale versions return 409'})
  @ApiBody({schema:{type:'object',required:['version','content'],properties:{version:{type:'integer',minimum:0},content:{type:'object',description:'Version 1 structured brief; sharing requires objective, product context, messages and dated deliverables.'}}}})
  save(@Req() r:ActorRequest,@Param('id') id:string,@Body() body:unknown) {return this.service.saveDraft(r.user,id,body);}
  @Post('share') @Header('Cache-Control','private, no-store')
  @ApiOperation({summary:'Share the exact saved version with assigned creators; publisher permission required'})
  @ApiBody({schema:{type:'object',required:['version'],properties:{version:{type:'integer',minimum:0}}}})
  share(@Req() r:ActorRequest,@Param('id') id:string,@Body() body:unknown) {return this.service.share(r.user,id,body);}
  @Get('versions') @Header('Cache-Control','private, no-store')
  versions(@Req() r:ActorRequest,@Param('id') id:string,@Query('page') page?:string,@Query('page_size') size?:string) {return this.service.listVersions(r.user,id,...pagination(page,size));}
  @Get('versions/:revisionId') @Header('Cache-Control','private, no-store')
  revision(@Req() r:ActorRequest,@Param('id') id:string,@Param('revisionId') revision:string) {return this.service.getVersion(r.user,id,revision);}
  @Get('assignments') @Roles('super_admin') @Header('Cache-Control','private, no-store')
  assignments(@Req() r:ActorRequest,@Param('id') id:string) {return this.service.getAssignments(r.user,id);}
  @Put('assignments') @Roles('super_admin') @Header('Cache-Control','private, no-store')
  @ApiBody({schema:{type:'object',required:['version','members','creator_ids'],properties:{version:{type:'integer'},members:{type:'array',items:{type:'object',properties:{user_id:{type:'string',format:'uuid'},can_publish:{type:'boolean'}}}},creator_ids:{type:'array',items:{type:'string'}}}}})
  setAssignments(@Req() r:ActorRequest,@Param('id') id:string,@Body() body:unknown) {return this.service.setAssignments(r.user,id,body);}
  @Get('assignment-options') @Roles('super_admin') @Header('Cache-Control','private, no-store')
  options(@Req() r:ActorRequest,@Param('id') id:string,@Query('search') search='',@Query('page') page?:string,@Query('page_size') size?:string) {return this.service.assignmentOptions(r.user,id,search,...pagination(page,size));}
}
@ApiTags('Creator campaign briefs')
@Roles('creator')
@Controller('creator-portal/campaign-briefs')
export class CreatorCampaignBriefController {
  constructor(private readonly service:CampaignContentService) {}
  @Get() @Header('Cache-Control','private, no-store')
  list(@Req() r:ActorRequest,@Query('page') page?:string,@Query('page_size') size?:string) {return this.service.listCreatorBriefs(r.user,...pagination(page,size));}
  @Get(':id') @Header('Cache-Control','private, no-store')
  get(@Req() r:ActorRequest,@Param('id') id:string) {return this.service.getCreatorBrief(r.user,id);}
}
