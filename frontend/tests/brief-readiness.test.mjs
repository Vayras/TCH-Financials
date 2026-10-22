import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../features/campaign-content/brief-readiness.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const complete={objective:'Launch',product_context:'Product',deliverables:[{format:'Reel',due_date:'2026-10-15'}],mandatory_messages:['Mention brand'],no_mandatory_messages:false};
const ready=content=>context.exports.briefRequirements(content).every(item=>item.complete);
test('sharing guidance catches missing requirements and conflicting message choices',()=>{
 assert.equal(ready(complete),true);
 for(const change of [{objective:' '},{product_context:''},{deliverables:[]},{deliverables:[{format:' ',due_date:'2026-10-15'}]},{deliverables:[{format:'Reel',due_date:''}]},{mandatory_messages:[' ']},{no_mandatory_messages:true}])assert.equal(ready({...complete,...change}),false);
 assert.equal(ready({...complete,mandatory_messages:[],no_mandatory_messages:true}),true);
});
