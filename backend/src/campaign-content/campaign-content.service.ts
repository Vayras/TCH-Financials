import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { CampaignContentPolicy } from './campaign-content.policy';
import { blankBrief, CampaignActor, campaignId, invalid, object, validateBrief, version } from './campaign-content.model';

@Injectable()
export class CampaignContentService {
  private policy = new CampaignContentPolicy();
  constructor(@InjectDataSource() private readonly db: DataSource) {}
  private async locked<T>(actor: CampaignActor,id: string, action: 'edit'|'share'|'manage', fn: (m: EntityManager,row: any) => Promise<T>) {
    campaignId(id);
    return this.db.transaction(async m => {
      if (!(await m.query('SELECT id FROM tch_campaign WHERE id=$1 FOR UPDATE',[id])).length) throw new NotFoundException();
      await this.policy.requireAgency(m,actor,id,action);
      await m.query('INSERT INTO tch_campaign_brief(campaign_id,draft) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING',[id,JSON.stringify(blankBrief())]);
      const [row] = await m.query('SELECT * FROM tch_campaign_brief WHERE campaign_id=$1 FOR UPDATE',[id]);
      return fn(m,row);
    });
  }
  private async audit(m: EntityManager,actor: CampaignActor,id: string,action: string) {
    await m.query(`INSERT INTO tch_audit_log(request_id,actor_id,actor_email,actor_role,method,path,resource_id,field_names,response_status)
      VALUES($1,$2,'',$3,'POST',$4,$5,$6::jsonb,200)`,[randomUUID(),actor.id,actor.role,`/campaigns/${id}/brief/${action}`,id,JSON.stringify([action])]);
  }
  private async agency(m: EntityManager,actor: CampaignActor,id: string) {
    const capabilities = await this.policy.requireAgency(m,actor,id,'read');
    const [campaign] = await m.query('SELECT id::text,name,brand FROM tch_campaign WHERE id=$1',[id]);
    const [row] = await m.query(`SELECT b.version,b.draft,b.updated_at,r.id AS shared_revision_id,r.draft_version AS shared_version,r.shared_at
      FROM tch_campaign_brief b LEFT JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id WHERE b.campaign_id=$1`,[id]);
    const [count] = await m.query('SELECT count(*)::int AS n FROM tch_campaign_brief_creator WHERE campaign_id=$1',[id]);
    return {campaign,version:0,draft:blankBrief(),shared_version:null,shared_revision_id:null,shared_at:null,...row,capabilities,recipient_count:count.n};
  }
  getAgencyBrief(actor: CampaignActor,id: string) { return this.agency(this.db.manager,actor,id); }
  async saveDraft(actor: CampaignActor,id: string,body: unknown) {
    const b = object(body,['version','content']), expected=version(b.version), content=validateBrief(b.content,'draft');
    return this.locked(actor,id,'edit',async(m,row) => {
      if (row.version !== expected) throw new ConflictException('This draft changed. Reload before saving.');
      const [equal] = await m.query('SELECT draft=$2::jsonb AS same FROM tch_campaign_brief WHERE campaign_id=$1',[id,JSON.stringify(content)]);
      if (!equal.same) await m.query('UPDATE tch_campaign_brief SET draft=$2::jsonb,version=version+1,updated_by=$3,updated_at=now() WHERE campaign_id=$1',[id,JSON.stringify(content),actor.id]);
      return this.agency(m,actor,id);
    });
  }
  async share(actor: CampaignActor,id: string,body: unknown) {
    const b=object(body,['version']),expected=version(b.version);
    return this.locked(actor,id,'share',async(m,row) => {
      if (row.version !== expected) throw new ConflictException('Save or reload the latest draft before sharing.');
      const content=validateBrief(row.draft,'share');
      const [eligible]=await m.query(`SELECT 1 FROM tch_campaign_brief_creator a JOIN tch_profile p ON p.creator_id=a.creator_id AND p.role='creator' AND p.status='approved' WHERE a.campaign_id=$1 LIMIT 1`,[id]);
      if (!eligible) invalid('creator_ids','Assign at least one creator with an approved portal account.');
      await m.query(`INSERT INTO tch_campaign_brief_revision(id,campaign_id,draft_version,content,shared_by) VALUES($1,$2,$3,$4::jsonb,$5) ON CONFLICT(campaign_id,draft_version) DO NOTHING`,[randomUUID(),id,expected,JSON.stringify(content),actor.id]);
      const [revision]=await m.query('SELECT id,draft_version,shared_at FROM tch_campaign_brief_revision WHERE campaign_id=$1 AND draft_version=$2',[id,expected]);
      if (row.shared_revision_id !== revision.id) {
        await m.query('UPDATE tch_campaign_brief SET shared_revision_id=$2 WHERE campaign_id=$1',[id,revision.id]);
        await this.audit(m,actor,id,'share');
      }
      return revision;
    });
  }
  async getAssignments(actor: CampaignActor,id: string) {
    await this.policy.requireAgency(this.db.manager,actor,id,'manage');
    return this.assignments(this.db.manager,id);
  }
  private async assignments(m: EntityManager,id: string) {
    const [row]=await m.query('SELECT assignment_version FROM tch_campaign_brief WHERE campaign_id=$1',[id]);
    const members=await m.query('SELECT a.user_id::text,a.can_publish,p.email,p.display_name FROM tch_campaign_brief_member a JOIN tch_profile p ON p.id=a.user_id WHERE campaign_id=$1 ORDER BY p.email',[id]);
    const creators=await m.query('SELECT a.creator_id::text,c.name FROM tch_campaign_brief_creator a JOIN tch_creator c ON c.id=a.creator_id WHERE campaign_id=$1 ORDER BY c.name',[id]);
    return {version:row?.assignment_version ?? 0,members,creators};
  }
  async setAssignments(actor: CampaignActor,id: string,body: unknown) {
    const b=object(body,['version','members','creator_ids']),expected=version(b.version);
    if (!Array.isArray(b.members) || b.members.length>100 || !Array.isArray(b.creator_ids) || b.creator_ids.length>100) invalid('assignments','Choose up to 100 members and creators.');
    const members=b.members.map(v => {
      const member=object(v,['user_id','can_publish']);
      if (typeof member.user_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(member.user_id) || typeof member.can_publish !== 'boolean') invalid('members','Invalid member.');
      return {user_id:member.user_id,can_publish:member.can_publish};
    });
    const creators=b.creator_ids.map(v => {if(typeof v!=='string') invalid('creator_ids','Creator IDs must be strings.');return campaignId(v);});
    if (new Set(members.map(v=>v.user_id)).size!==members.length || new Set(creators).size!==creators.length) invalid('assignments','Duplicate assignments.');
    return this.locked(actor,id,'manage',async(m,row) => {
      if (row.assignment_version!==expected) throw new ConflictException('Assignments changed. Reload before saving.');
      for (const member of members) if (!(await m.query("SELECT id FROM tch_profile WHERE id=$1 AND role='tch_member' AND status='approved'",[member.user_id])).length) invalid('members','Choose approved members only.');
      for (const creator of creators) if (!(await m.query("SELECT id FROM tch_profile WHERE creator_id=$1 AND role='creator' AND status='approved' LIMIT 1",[creator])).length) invalid('creator_ids','Choose creators with approved portal accounts.');
      await m.query('DELETE FROM tch_campaign_brief_member WHERE campaign_id=$1',[id]);
      await m.query('DELETE FROM tch_campaign_brief_creator WHERE campaign_id=$1',[id]);
      for (const member of members) await m.query('INSERT INTO tch_campaign_brief_member(campaign_id,user_id,can_publish,assigned_by) VALUES($1,$2,$3,$4)',[id,member.user_id,member.can_publish,actor.id]);
      for (const creator of creators) await m.query('INSERT INTO tch_campaign_brief_creator(campaign_id,creator_id,assigned_by) VALUES($1,$2,$3)',[id,creator,actor.id]);
      await m.query('UPDATE tch_campaign_brief SET assignment_version=assignment_version+1 WHERE campaign_id=$1',[id]);
      await this.audit(m,actor,id,'assignments');
      return this.assignments(m,id);
    });
  }
  async assignmentOptions(actor: CampaignActor,id: string,search: string,page: number,pageSize: number) {
    await this.policy.requireAgency(this.db.manager,actor,id,'manage');
    const term=`%${search.slice(0,100)}%`,offset=(page-1)*pageSize;
    const members=await this.db.query("SELECT id::text AS user_id,email,display_name FROM tch_profile WHERE role='tch_member' AND status='approved' AND (email ILIKE $1 OR display_name ILIKE $1) ORDER BY email LIMIT $2 OFFSET $3",[term,pageSize+1,offset]);
    const creators=await this.db.query(`SELECT c.id::text AS creator_id,c.name,jsonb_agg(jsonb_build_object('email',p.email,'user_id',p.id)) AS profiles FROM tch_creator c JOIN tch_profile p ON p.creator_id=c.id AND p.role='creator' AND p.status='approved' WHERE c.name ILIKE $1 OR p.email ILIKE $1 GROUP BY c.id,c.name ORDER BY c.name,c.id LIMIT $2 OFFSET $3`,[term,pageSize+1,offset]);
    return {members:members.slice(0,pageSize),creators:creators.slice(0,pageSize),has_more:members.length>pageSize || creators.length>pageSize,page};
  }
  async listVersions(actor: CampaignActor,id: string,page: number,pageSize: number) {
    await this.policy.requireAgency(this.db.manager,actor,id,'read');
    return {items:await this.db.query('SELECT id,draft_version,shared_at,shared_by FROM tch_campaign_brief_revision WHERE campaign_id=$1 ORDER BY draft_version DESC LIMIT $2 OFFSET $3',[id,pageSize,(page-1)*pageSize]),page};
  }
  async getVersion(actor: CampaignActor,id: string,revisionId: string) {
    await this.policy.requireAgency(this.db.manager,actor,id,'read');
    if (!/^[0-9a-f-]{36}$/i.test(revisionId)) throw new NotFoundException();
    const [row]=await this.db.query('SELECT id,draft_version,shared_at,content FROM tch_campaign_brief_revision WHERE campaign_id=$1 AND id=$2',[id,revisionId]);
    if(!row) throw new NotFoundException();return row;
  }
  async listCreatorBriefs(actor: CampaignActor,page: number,pageSize: number) {
    const creator=await this.policy.requireCreator(this.db.manager,actor);
    const items=await this.db.query(`SELECT c.id::text,c.name,c.brand,r.draft_version AS shared_version,r.shared_at FROM tch_campaign_brief_creator a JOIN tch_campaign c ON c.id=a.campaign_id JOIN tch_campaign_brief b ON b.campaign_id=c.id JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id WHERE a.creator_id=$1 ORDER BY r.shared_at DESC,c.id LIMIT $2 OFFSET $3`,[creator,pageSize+1,(page-1)*pageSize]);
    return {items:items.slice(0,pageSize),has_more:items.length>pageSize,page};
  }
  async getCreatorBrief(actor: CampaignActor,id: string) {
    campaignId(id);const creator=await this.policy.requireCreator(this.db.manager,actor);
    const [row]=await this.db.query(`SELECT c.id::text,c.name,c.brand,r.id AS shared_revision_id,r.draft_version AS shared_version,r.shared_at,r.content FROM tch_campaign_brief_creator a JOIN tch_campaign c ON c.id=a.campaign_id JOIN tch_campaign_brief b ON b.campaign_id=c.id JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id WHERE a.creator_id=$1 AND c.id=$2`,[creator,id]);
    if(!row) throw new NotFoundException();return row;
  }
}
