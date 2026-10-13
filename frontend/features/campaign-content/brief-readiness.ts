import type {BriefContent} from './types';

// Guidance only: the server remains authoritative for validation and portal eligibility.
export function briefRequirements(content: BriefContent) {
 return [
  {section:'overview',label:'Campaign objective',complete:Boolean(content.objective.trim())},
  {section:'overview',label:'Product context',complete:Boolean(content.product_context.trim())},
  {section:'deliverables',label:'Deliverables with format and due date',complete:content.deliverables.length>0&&content.deliverables.every(d=>Boolean(d.format.trim()&&d.due_date))},
  {section:'guardrails',label:'Mandatory messages, or explicitly none',complete:content.no_mandatory_messages?!content.mandatory_messages.some(m=>m.trim()):content.mandatory_messages.some(m=>m.trim())},
 ] as const;
}
