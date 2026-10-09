import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertReportingWeek,EmployeeReportsController} from '../src/resources/simple-resources.controllers';
test('weekly reporting rejects invalid or non-Thursday dates',()=>{
 assertReportingWeek('2026-10-15');for(const date of ['2026-10-09','2026-02-30','bad'])assert.throws(()=>assertReportingWeek(date));
});
test('weekly notes require approved members and detect concurrent changes',async()=>{
 const db:any={query:async(sql:string)=>sql.includes('SELECT id,display_name')?[{id:'member'}]:[]};
 const controller=new EmployeeReportsController(db);
 await assert.rejects(()=>controller.note({member_id:'other',week:'2026-10-15',note:'hello',version:0}));
 await assert.rejects(()=>controller.note({member_id:'member',week:'2026-10-15',note:'hello',version:1}),/changed/);
});
