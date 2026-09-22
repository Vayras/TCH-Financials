import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import { blankDraft, publicContent, validateDraft } from '../src/creator-social/brand-kit.model';
import { PublicBrandKitController, BrandKitController } from '../src/creator-social/brand-kit.controller';
import { RolesGuard } from '../src/auth/roles.guard';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';

test('brand-kit draft validation bounds content and rejects invalid snapshot/post selections', () => {
  const draft=blankDraft();
  assert.deepEqual(validateDraft(draft),draft);
  assert.throws(()=>validateDraft({...draft,featured_posts:[{snapshot_id:randomUUID(),post_id:'123'}]}));
  assert.throws(()=>validateDraft({...draft,profile:{...draft.profile,contact_email:'bad email'}}));
  assert.throws(()=>validateDraft({...draft,profile:{...draft.profile,biography:'x'.repeat(5001)}}));
});

test('public serialization excludes provider/internal fields, private finance and unsafe URLs', () => {
  const id=randomUUID(),draft=blankDraft();draft.snapshot_ids=[id];draft.featured_posts=[{snapshot_id:id,post_id:'123'}];
  const content=publicContent(draft,[{id,account_id:randomUUID(),username:'test',profile_url:'https://instagram.com/test/',collected_at:new Date(),profile:{followers:0,provider_avg_engagement:0.42,biography:'not approved',email:'private@test.com'},posts:[{platform_post_id:'123',likes:0,comments:null,caption:'Selected post',url:'javascript:alert(1)',image_url:'https://evil.test/tracker'}]}]);
  assert.equal(content.socials[0].followers,0);assert.equal(content.posts[0].comments,null);
  assert.equal(content.posts[0].url,null);assert.equal(content.posts[0].image_url,null);
  assert.ok(!JSON.stringify(content).includes('private@test.com'));assert.ok(!JSON.stringify(content).includes('provider_avg_engagement'));assert.ok(!JSON.stringify(content).includes('not approved'));
});

test('only the explicit published GET bypasses authentication; creator draft remains protected', async () => {
  const reflector=new Reflector();
  const context=(controller: typeof PublicBrandKitController | typeof BrandKitController)=>({getClass:()=>controller,getHandler:()=>controller.prototype.get,switchToHttp:()=>({getRequest:()=>({})})});
  const auth=new SupabaseAuthGuard(reflector,{getRepository:()=>{throw new Error('Public GET must not query auth');}} as never);
  assert.equal(await auth.canActivate(context(PublicBrandKitController) as never),true);
  const roles=new RolesGuard(reflector);
  assert.equal(roles.canActivate(context(PublicBrandKitController) as never),true);
  assert.throws(()=>roles.canActivate(context(BrandKitController) as never));
});
