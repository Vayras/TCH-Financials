import {invalid,object} from './campaign-content.model';
export const conceptFields=['title','hook','outline','script','cta','requirements'] as const;
export type ConceptContent=Record<typeof conceptFields[number],string>;
export function validateConcept(value:unknown,submission=false):ConceptContent {
 const row=object(value,[...conceptFields]);
 const result={} as ConceptContent;
 for(const field of conceptFields){
  const limit=field==='title'?200:field==='script'?12000:4000;
  if(typeof row[field]!=='string'||(row[field] as string).length>limit) invalid(field,`${field} must be text of at most ${limit} characters.`);
  result[field]=(row[field] as string).trim();
 }
 if(submission&&(!result.title||!result.hook||!result.outline)) invalid('content','Add a title, opening hook and outline before submitting.');
 return result;
}
export function uuid(value:unknown):string {
 if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) invalid('id','Invalid identifier.');
 return value;
}
