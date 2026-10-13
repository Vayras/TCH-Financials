import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {validateConcept} from '../src/campaign-content/content-concept.model';
test('concepts allow incomplete drafts but bound inputs and require actionable submissions',()=>{
 const content={title:'Morning routine',hook:'A fresh start',outline:'Show routine',script:'',cta:'Explore',requirements:''};
 assert.equal(validateConcept(content,true).title,'Morning routine');
 assert.throws(()=>validateConcept({...content,hook:''},true));
 assert.throws(()=>validateConcept({...content,internal_note:'secret'},false));
 assert.throws(()=>validateConcept({...content,title:'x'.repeat(201)},false));
});

import {ContentConceptService} from '../src/campaign-content/content-concept.service';
import {DataSource} from 'typeorm';
test('discussion metadata preserves shared submitted feedback filtering for creators',async()=>{
 const cid='11111111-1111-4111-8111-111111111111';
 const feedbackCalls:unknown[][]=[];
 const manager={query:async(sql:string,params:unknown[])=>{
  if(sql.startsWith('SELECT id,role,status')) return [{id:cid,role:'creator',status:'approved',creator_id:'2'}];
  if(sql.startsWith('SELECT 1 FROM tch_campaign_brief_creator')) return [{}];
  if(sql.startsWith('SELECT * FROM tch_content_concept')) return [{creator_id:'2'}];
  if(sql.includes('FROM tch_content_concept_feedback')) {
   assert.match(sql,/p.id=f.author_id/);
   assert.match(sql,/f.visibility='shared'/);
   assert.match(sql,/r.submitted_at IS NOT NULL/);
   feedbackCalls.push(params);return [];
  }
  return [];
 }};
 const db={transaction:async(fn:(m:typeof manager)=>Promise<unknown>)=>fn(manager)};
 const service=new ContentConceptService(db as unknown as DataSource);
 await service.history({id:cid,role:'creator',creatorId:'2'},'3',cid);
 assert.deepEqual(feedbackCalls,[[cid,false,true,0]]);
});
