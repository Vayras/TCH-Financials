import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/employees/report-totals.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
test('weekly figures exclude older deals and count each active campaign once',()=>{
 const r=context.exports.reportTotals([{confirmed_this_week:true,active_now:true,campaign_id:'1',total_fee:'100.25',agency_fee_inr:'20.05'},{confirmed_this_week:false,active_now:true,campaign_id:'1',total_fee:'900',agency_fee_inr:'200'},{confirmed_this_week:true,active_now:false,campaign_id:'2',total_fee:'50',agency_fee_inr:'10'}]);
 assert.equal(r.confirmed,2);assert.equal(r.bookings,150.25);assert.equal(r.margin,30.05);assert.equal(r.active,1);
});
