import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CreatorsController} from '../src/resources/creators.controller';

test('agency kit view exposes published revisions only',async()=>{
 let row:any;
 const source:any={getRepository:()=>({findOneBy:async()=>({id:'2'})}),query:async(sql:string,params:any[])=>{assert.match(sql,/r.id=k.published_revision/);assert.deepEqual(params,['2']);return row?[row]:[];}};
 const controller=new CreatorsController(source);
 assert.deepEqual(await controller.brandKit('2'),{status:'not_started',kit:null});
 row={slug:'creator-0123456789abcdef',revision:null,content:null,published_at:null};
 assert.deepEqual(await controller.brandKit('2'),{status:'private_draft',kit:null});
 row={...row,revision:'published-id',content:{profile:{display_name:'Published profile'}},published_at:'2026-10-09'};
 assert.deepEqual(await controller.brandKit('2'),{status:'published',kit:row});
 await assert.rejects(()=>controller.brandKit('invalid'));
});
