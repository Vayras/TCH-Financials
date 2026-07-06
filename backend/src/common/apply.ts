import { BadRequestException } from '@nestjs/common';

// Copy the payload's snake_case keys onto the entity's camelCase props —
// only the keys actually present, so PATCH stays a partial merge like DRF's.
export function applyMapped(
  row: Record<string, unknown>,
  body: Record<string, unknown>,
  map: Record<string, string>,
): void {
  for (const [wire, prop] of Object.entries(map)) {
    if (wire in body) row[prop] = body[wire];
  }
}

// Translate Postgres unique-constraint violations into a 400 like DRF did,
// instead of a bare 500.
export function rethrowUnique(err: unknown, field: string): never {
  if ((err as { code?: string })?.code === '23505') {
    throw new BadRequestException({ [field]: [`${field} must be unique.`] });
  }
  throw err;
}
