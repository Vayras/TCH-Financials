import { BadRequestException } from '@nestjs/common';
export type CampaignActor = { id: string; role: string; creatorId?: string | null };
export type BriefContent = {
  schema_version: 1; objective: string; product_context: string; audience: string;
  mandatory_messages: string[]; no_mandatory_messages: boolean; creative_direction: string;
  prohibited_claims: string[]; call_to_action: string; disclosure: string; tags: string[]; languages: string[];
  deliverables: { id: string; platform: 'instagram' | 'youtube' | 'linkedin' | 'other'; format: string; quantity: number; specifications: string; due_date: string }[];
  references: { label: string; url: string }[];
};
export function blankBrief(): BriefContent {
  return {schema_version: 1, objective: '', product_context: '', audience: '', mandatory_messages: [], no_mandatory_messages: false, creative_direction: '', prohibited_claims: [], call_to_action: '', disclosure: '', tags: [], languages: [], deliverables: [], references: []};
}
export function invalid(field: string, detail: string): never { throw new BadRequestException({detail, field}); }
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('body', 'Expected an object.');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(k => !keys.includes(k))) invalid('body', 'Unexpected field.');
  return row;
}
export function version(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid('version', 'A non-negative integer version is required.');
  return value;
}
export function campaignId(value: string): string {
  if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) invalid('id', 'Invalid campaign ID.');
  return value;
}
export function validateBrief(value: unknown, mode: 'draft' | 'share'): BriefContent {
  if (Buffer.byteLength(JSON.stringify(value) ?? '') > 65536) invalid('content', 'Brief exceeds 64 KB.');
  const row = object(value, Object.keys(blankBrief()));
  const str = (v: unknown, field: string, max: number) => {
    if (typeof v !== 'string' || v.length > max) invalid(field, `${field} must be text of at most ${max} characters.`);
    return v.trim();
  };
  const list = (v: unknown, field: string, max: number): unknown[] => {
    if (!Array.isArray(v) || v.length > max) invalid(field, `${field} must have at most ${max} entries.`);
    return v;
  };
  if (row.schema_version !== 1 || typeof row.no_mandatory_messages !== 'boolean') invalid('content', 'Invalid brief format.');
  const result = blankBrief();
  for (const key of ['objective', 'product_context', 'creative_direction'] as const) result[key] = str(row[key], key, 4000);
  for (const key of ['audience', 'call_to_action', 'disclosure'] as const) result[key] = str(row[key], key, 2000);
  for (const key of ['mandatory_messages', 'prohibited_claims', 'tags', 'languages'] as const) {
    result[key] = list(row[key], key, key === 'tags' ? 30 : key === 'languages' ? 10 : 20).map(v => str(v, key, key === 'tags' ? 100 : key === 'languages' ? 80 : 500)).filter(Boolean);
  }
  result.no_mandatory_messages = row.no_mandatory_messages;
  result.deliverables = list(row.deliverables, 'deliverables', 20).map(v => {
    const d = object(v, ['id','platform','format','quantity','specifications','due_date']);
    if (typeof d.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id)) invalid('deliverables', 'Invalid deliverable ID.');
    if (!['instagram','youtube','linkedin','other'].includes(String(d.platform))) invalid('deliverables', 'Choose a platform.');
    if (typeof d.quantity !== 'number' || !Number.isInteger(d.quantity) || d.quantity < 1 || d.quantity > 100) invalid('deliverables', 'Quantity must be 1–100.');
    const date = str(d.due_date, 'due_date', 10);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) invalid('due_date', 'Enter a valid date.');
    return {id: d.id.toLowerCase(), platform: d.platform as BriefContent['deliverables'][number]['platform'], format: str(d.format,'format',100), quantity: d.quantity, specifications: str(d.specifications,'specifications',2000), due_date: date};
  });
  if (new Set(result.deliverables.map(d => d.id)).size !== result.deliverables.length) invalid('deliverables', 'Duplicate deliverable ID.');
  result.references = list(row.references, 'references', 10).map(v => {
    const r = object(v, ['label','url']), url = str(r.url, 'url',2048);
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(); }
    catch { invalid('references','Reference links must be HTTPS URLs without credentials.'); }
    return {label: str(r.label,'label',150),url};
  });
  if (result.no_mandatory_messages && result.mandatory_messages.length) invalid('mandatory_messages','Choose mandatory messages or explicitly none, not both.');
  if (mode === 'share' && (!result.objective || !result.product_context || !result.deliverables.length || result.deliverables.some(d => !d.format || !d.due_date) || (!result.no_mandatory_messages && !result.mandatory_messages.length))) invalid('content','Add an objective, product context, dated deliverables and mandatory messages (or select none) before sharing.');
  return result;
}
