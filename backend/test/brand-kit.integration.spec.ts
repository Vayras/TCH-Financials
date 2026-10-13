import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AddCreatorSocialImports1753100000000 } from '../src/migrations/1753100000000-add-creator-social-imports';
import { AddCreatorBrandKits1753200000000 } from '../src/migrations/1753200000000-add-creator-brand-kits';
import { BrandKitService } from '../src/creator-social/brand-kit.service';
import { blankDraft } from '../src/creator-social/brand-kit.model';

const url=process.env.SOCIAL_TEST_DATABASE_URL;
test('brand-kit lifecycle: ownership, concurrent saves, frozen revisions and unpublishing',{skip:!url},async()=>{
  assert.ok(['127.0.0.1','localhost'].includes(new URL(url!).hostname));
  const schema=`kit_test_${randomUUID().replace(/-/g,'')}`;
  const admin=await new DataSource({type:'postgres',url}).initialize();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db=await new DataSource({type:'postgres',url,extra:{options:`-c search_path=${schema}`}}).initialize();
  try{
    await db.query('CREATE TABLE tch_creator(id bigint PRIMARY KEY)');await db.query('INSERT INTO tch_creator VALUES(1),(2)');
    const runner=db.createQueryRunner();await runner.connect();
    await new AddCreatorSocialImports1753100000000().up(runner);
    const migration=new AddCreatorBrandKits1753200000000();await migration.up(runner);await migration.down(runner);await migration.up(runner);await runner.release();
    const service=new BrandKitService(db),actor={id:randomUUID(),role:'creator',creatorId:'1'},other={id:randomUUID(),role:'creator',creatorId:'2'};
    const account=randomUUID(),job=randomUUID(),snapshot=randomUUID();
    await db.query("INSERT INTO tch_creator_social_account(id,creator_id,username,profile_url) VALUES($1,1,'test','https://instagram.com/test/')",[account]);
    await db.query("INSERT INTO tch_creator_social_import(id,account_id,requested_by,idempotency_key,dataset_id,state) VALUES($1,$2,$3,$4,'gd_test','succeeded')",[job,account,actor.id,randomUUID()]);
    await db.query(`INSERT INTO tch_creator_social_snapshot(id,account_id,import_id,schema_version,profile,posts,coverage) VALUES($1,$2,$3,1,$4,$5,'{}')`,[snapshot,account,job,JSON.stringify({followers:100}),JSON.stringify([{platform_post_id:'123',caption:'Example',likes:0,comments:null}])]);
    const draft=blankDraft();draft.profile.display_name='Example Creator';draft.profile.biography='Approved biography';draft.snapshot_ids=[snapshot];draft.featured_posts=[{snapshot_id:snapshot,post_id:'123'}];
    await assert.rejects(service.save(other,{version:0,draft}),{status:400});
    assert.equal((await service.get(other)).version,0);
    const saved=await service.save(actor,{version:0,draft});
    await assert.rejects(service.published(saved.slug),{status:404});
    const published=await service.publish(actor,saved.version);
    const publicV1=await service.published(saved.slug);
    assert.equal(publicV1.content.socials[0].followers,100);assert.equal(publicV1.content.posts[0].likes,0);
    assert.ok(!('creator_id' in publicV1));
    const outcomes=await Promise.allSettled([service.save(actor,{version:1,draft:{...draft,profile:{...draft.profile,biography:'Changed privately'}}}),service.save(actor,{version:1,draft})]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
    assert.equal((await service.published(saved.slug)).revision,publicV1.revision);
    assert.equal((await service.published(saved.slug)).content.profile.biography,'Approved biography');
    const current=await service.get(actor);await service.publish(actor,current.version);
    assert.notEqual((await service.published(saved.slug)).revision,published.published_revision);
    await service.unpublish(actor,current.version);await assert.rejects(service.published(saved.slug),{status:404});
    await service.publish(actor,current.version);await db.query('DELETE FROM tch_creator WHERE id=1');
    await assert.rejects(service.published(saved.slug),{status:404});
  }finally{await db.destroy();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.destroy();}
});
