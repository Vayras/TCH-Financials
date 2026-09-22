import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CampaignActor, campaignId } from './campaign-content.model';

export class CampaignContentPolicy {
  async profile(m: EntityManager, actor: CampaignActor) {
    if (!actor?.id) throw new UnauthorizedException();
    const [profile] = await m.query('SELECT id,role,status,creator_id,email FROM tch_profile WHERE id=$1',[actor.id]);
    if (!profile || profile.status !== 'approved' || profile.role !== actor.role) throw new ForbiddenException('Select an approved account linked to a profile.');
    return profile;
  }
  async requireAgency(m: EntityManager, actor: CampaignActor, id: string, action: 'read'|'edit'|'share'|'manage') {
    campaignId(id);
    const profile = await this.profile(m,actor);
    if (!['super_admin','tch_member'].includes(profile.role)) throw new ForbiddenException();
    if (!(await m.query('SELECT id FROM tch_campaign WHERE id=$1',[id])).length) throw new NotFoundException();
    const admin = profile.role === 'super_admin';
    const [member] = admin ? [] : await m.query('SELECT can_publish FROM tch_campaign_brief_member WHERE campaign_id=$1 AND user_id=$2',[id,actor.id]);
    if (!admin && !member) throw new NotFoundException();
    if (!admin && (action === 'manage' || (action === 'share' && !member.can_publish))) throw new ForbiddenException();
    return {can_edit:true,can_share:admin || Boolean(member?.can_publish),can_manage_assignments:admin};
  }
  async requireCreator(m: EntityManager, actor: CampaignActor) {
    const profile = await this.profile(m,actor);
    if (profile.role !== 'creator' || !profile.creator_id || String(profile.creator_id) !== String(actor.creatorId)) throw new ForbiddenException();
    return String(profile.creator_id);
  }
}
