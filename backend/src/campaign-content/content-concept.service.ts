import {ConflictException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {DataSource, EntityManager} from 'typeorm';
import {randomUUID} from 'crypto';
import {CampaignActor, campaignId, invalid, object, version} from './campaign-content.model';
import {CampaignContentPolicy} from './campaign-content.policy';
import {conceptFields, uuid, validateConcept} from './content-concept.model';

@Injectable()
export class ContentConceptService {
 constructor(private readonly db:DataSource) {}
 private policy=new CampaignContentPolicy();
 private async access(m:EntityManager,a:CampaignActor,id:string) {
  campaignId(id);
  if(a.role==='creator') {
   const creator=await this.policy.requireCreator(m,a);
   if(!(await m.query('SELECT 1 FROM tch_campaign_brief_creator WHERE campaign_id=$1 AND creator_id=$2',[id,creator])).length) throw new NotFoundException();
   return {creator,can_approve:false};
  }
  const p=await this.policy.requireAgency(m,a,id,'read');
  return {creator:null,can_approve:p.can_share};
 }
 async list(a:CampaignActor,id:string,page=1) {
  return this.db.transaction(async m=>{
   const access=await this.access(m,a,id);
   const [brief]=await m.query('SELECT shared_revision_id FROM tch_campaign_brief WHERE campaign_id=$1',[id]);
   const items=await m.query(`SELECT c.id,c.creator_id,c.state,c.version,c.updated_at,r.id AS revision_id,r.content,r.brief_revision_id,
    r.brief_revision_id IS DISTINCT FROM $3::uuid AS stale_brief
    FROM tch_content_concept c JOIN tch_content_concept_revision r ON r.id=CASE WHEN $2::bigint IS NULL THEN c.submitted_revision ELSE c.current_revision END
    WHERE c.campaign_id=$1 AND ($2::bigint IS NULL OR c.creator_id=$2) ORDER BY c.updated_at DESC,c.id LIMIT 21 OFFSET $4`,[id,access.creator,brief?.shared_revision_id,(page-1)*20]);
   return {...access,brief_revision_id:brief?.shared_revision_id??null,items:items.slice(0,20),has_more:items.length>20};
  });
 }
 private async locked(a:CampaignActor,id:string,fn:(m:EntityManager,access:{creator:string|null;can_approve:boolean},brief:string)=>Promise<unknown>) {
  return this.db.transaction(async m=>{
   campaignId(id); await m.query('SELECT id FROM tch_campaign WHERE id=$1 FOR UPDATE',[id]);
   const access=await this.access(m,a,id);
   const [b]=await m.query('SELECT shared_revision_id FROM tch_campaign_brief WHERE campaign_id=$1',[id]);
   if(!b?.shared_revision_id) throw new ConflictException('Share a campaign brief first.');
   return fn(m,access,b.shared_revision_id);
  });
 }
 private async concept(m:EntityManager,id:string,cid:string,creator:string|null) {
  const [c]=await m.query('SELECT * FROM tch_content_concept WHERE id=$1 AND campaign_id=$2 FOR UPDATE',[uuid(cid),id]);
  if(!c || (creator && String(c.creator_id)!==creator)) throw new NotFoundException();
  return c;
 }
 async save(a:CampaignActor,id:string,body:unknown,cid?:string) {
  const b=object(body,['version','content','brief_revision_id']); const content=validateConcept(b.content); const expected=version(b.version); const briefId=uuid(b.brief_revision_id);
  return this.locked(a,id,async(m,access,brief)=>{
   if(!access.creator) throw new ForbiddenException();
   if(brief!==briefId) throw new ConflictException('The brief changed. Read the latest brief before saving.');
   let c;
   if(cid) {c=await this.concept(m,id,cid,access.creator); if(c.version!==expected) throw new ConflictException('This concept changed. Reload before editing.');}
   else {if(expected!==0) invalid('version','New concepts require version 0.'); cid=randomUUID(); await m.query('INSERT INTO tch_content_concept(id,campaign_id,creator_id) VALUES($1,$2,$3)',[cid,id,access.creator]);}
   const revision=randomUUID();
   await m.query('INSERT INTO tch_content_concept_revision(id,concept_id,campaign_id,brief_revision_id,content,created_by) VALUES($1,$2,$3,$4,$5,$6)',[revision,cid,id,brief,JSON.stringify(content),a.id]);
   await m.query("UPDATE tch_content_concept SET current_revision=$2,state='draft',version=$3,updated_at=now() WHERE id=$1",[cid,revision,expected+1]);
   return {id:cid,revision_id:revision,version:expected+1};
  });
 }
 async action(a:CampaignActor,id:string,cid:string,body:unknown) {
  const b=object(body,['version','revision_id','action','message']);const expected=version(b.version),revision=uuid(b.revision_id);
  if(!['submit','approved','changes_requested'].includes(String(b.action))) invalid('action','Invalid action.');
  if(b.message!==undefined&&(typeof b.message!=='string'||b.message.length>4000)) invalid('message','Use at most 4000 characters.');
  if(b.action==='changes_requested'&&!String(b.message??'').trim()) invalid('message','Explain the changes needed.');
  return this.locked(a,id,async(m,access,brief)=>{
   const c=await this.concept(m,id,cid,access.creator);
   if(c.version!==expected) throw new ConflictException('This concept changed. Reload before continuing.');
   const [r]=await m.query('SELECT * FROM tch_content_concept_revision WHERE concept_id=$1 AND id=$2',[cid,revision]);
   if(!r) throw new NotFoundException();
   if(b.action==='submit') {
    if(!access.creator) throw new ForbiddenException();
    if(c.current_revision!==revision||c.state!=='draft'||r.submitted_at) throw new ConflictException('Save a new draft before submitting.');
    if(r.brief_revision_id!==brief) throw new ConflictException('Read the updated brief and save a new draft before submitting.');
    validateConcept(r.content,true);
    await m.query('UPDATE tch_content_concept_revision SET submitted_at=now() WHERE id=$1',[revision]);
    await m.query("UPDATE tch_content_concept SET submitted_revision=$2,state='submitted',version=version+1,updated_at=now() WHERE id=$1",[cid,revision]);
   } else {
    if(access.creator) throw new ForbiddenException();
    if(b.action==='approved'&&!access.can_approve) throw new ForbiddenException();
    if(c.submitted_revision!==revision||c.state!=='submitted') throw new ConflictException('This submission is no longer awaiting review.');
    if(b.action==='approved'&&r.brief_revision_id!==brief) throw new ConflictException('The brief changed. Request an updated concept.');
    await m.query('INSERT INTO tch_content_concept_review(id,concept_id,revision_id,decision,message,author_id) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),cid,revision,b.action,b.message??'',a.id]);
    await m.query("UPDATE tch_content_concept SET state=$2,approved_revision=CASE WHEN $2='approved' THEN $3::uuid ELSE approved_revision END,version=version+1,updated_at=now() WHERE id=$1",[cid,b.action,revision]);
   }
   await m.query("INSERT INTO tch_audit_log(request_id,actor_id,actor_email,actor_role,method,path,resource_id,field_names,response_status) VALUES($1,$2,'',$3,'POST',$4,$5,$6,200)",[randomUUID(),a.id,a.role,`/campaigns/${id}/concepts/${cid}`,cid,JSON.stringify([b.action,revision])]);
   return {version:expected+1};
  });
 }
 async history(a:CampaignActor,id:string,cid:string,page=1) {
  return this.db.transaction(async m=>{
   const access=await this.access(m,a,id);await this.concept(m,id,cid,access.creator);
   const revisions=await m.query('SELECT id,content,created_at,submitted_at FROM tch_content_concept_revision WHERE concept_id=$1 AND ($2::boolean OR submitted_at IS NOT NULL) ORDER BY created_at DESC,id LIMIT 21 OFFSET $3',[cid,Boolean(access.creator),(page-1)*20]);
   const reviews=await m.query('SELECT revision_id,decision,message,created_at FROM tch_content_concept_review WHERE concept_id=$1 AND revision_id=ANY($2::uuid[])',[cid,revisions.slice(0,20).map((r:{id:string})=>r.id)]);
   const comments=await m.query("SELECT f.id,f.revision_id,f.section,f.message,f.visibility,f.created_at FROM tch_content_concept_feedback f JOIN tch_content_concept_revision r ON r.id=f.revision_id WHERE f.concept_id=$1 AND ($2::boolean OR f.visibility='shared') AND ($3::boolean OR r.submitted_at IS NOT NULL) ORDER BY f.created_at DESC,f.id LIMIT 21 OFFSET $4",[cid,!access.creator,Boolean(access.creator),(page-1)*20]);
   return {revisions:revisions.slice(0,20),reviews,comments:comments.slice(0,20),has_more:revisions.length>20||comments.length>20};
  });
 }
 async comment(a:CampaignActor,id:string,cid:string,body:unknown) {
  const b=object(body,['revision_id','section','message','visibility']);const revision=uuid(b.revision_id);
  if(!['general',...conceptFields].includes(String(b.section))||!['shared','internal'].includes(String(b.visibility))) invalid('section','Choose a section and visibility.');
  if(typeof b.message!=='string'||!b.message.trim()||b.message.length>4000) invalid('message','Enter a comment of at most 4000 characters.');
  return this.locked(a,id,async(m,access)=>{
   await this.concept(m,id,cid,access.creator);
   if(access.creator&&b.visibility!=='shared') throw new ForbiddenException();
   const [r]=await m.query('SELECT submitted_at FROM tch_content_concept_revision WHERE concept_id=$1 AND id=$2',[cid,revision]);
   if(!r||(!access.creator&&!r.submitted_at)) throw new NotFoundException();
   await m.query('INSERT INTO tch_content_concept_feedback(id,concept_id,revision_id,section,message,visibility,author_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),cid,revision,b.section,String(b.message).trim(),b.visibility,a.id]);
   return {saved:true};
  });
 }
}
