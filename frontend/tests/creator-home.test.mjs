import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const context={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/creator-portal/home-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
test('creator attention links to requested concepts and only the next seven days',()=>{
 const items=context.exports.homeAttention([{id:'3',name:'Glow',concepts:[{id:'abc',state:'changes_requested',title:'Routine'},{id:'def',state:'approved'}],deliverables:[{id:'old',due_date:'2026-10-08'},{id:'now',due_date:'2026-10-09',quantity:1,format:'Reel'},{id:'last',due_date:'2026-10-16',quantity:1,format:'Story'},{id:'far',due_date:'2026-10-17'}]}],'2026-10-09');
 assert.equal(items.length,3);assert.match(items[0].href,/view=feedback&concept=abc/);assert.equal(items[1].date,'2026-10-09');assert.equal(items[2].date,'2026-10-16');
});
