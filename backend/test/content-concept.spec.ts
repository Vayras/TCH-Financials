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
