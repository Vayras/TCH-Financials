import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/alerts/flow.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
test('alert actions use source records and urgency ordering preserves source order for ties',()=>{
 const {alertDestination,orderedAlerts}=context.exports;
 assert.equal(alertDestination({meta:{creator_id:2}}),'/creators/2');
 assert.equal(alertDestination({meta:{creator_id:2,deal_id:3}}),'/commercial/3');
 assert.equal(alertDestination({meta:{deal_id:-1,brand:'A & B'}}),'/commercial?q=A%20%26%20B');
 const rows=['low','med','high','med'].map((severity,index)=>({item:{severity,key:index},category:'docs'}));
 assert.equal(orderedAlerts(rows).map(row=>row.item.key).join(','),'2,1,3,0');
 assert.equal(rows[0].item.key,0);
});
