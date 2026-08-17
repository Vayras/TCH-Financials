import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';

export function strictDecimal(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; scale?: number } = {},
): Decimal {
  if (value === null || value === undefined || value === '') {
    throw new BadRequestException({ [field]: ['A numeric value is required.'] });
  }
  let parsed: Decimal;
  try {
    parsed = new Decimal(String(value));
  } catch {
    throw new BadRequestException({ [field]: ['Enter a valid number.'] });
  }
  if (!parsed.isFinite()) {
    throw new BadRequestException({ [field]: ['Enter a finite number.'] });
  }
  if (options.min !== undefined && parsed.lt(options.min)) {
    throw new BadRequestException({ [field]: [`Must be at least ${options.min}.`] });
  }
  if (options.max !== undefined && parsed.gt(options.max)) {
    throw new BadRequestException({ [field]: [`Must be at most ${options.max}.`] });
  }
  if (options.scale !== undefined && parsed.decimalPlaces() > options.scale) {
    throw new BadRequestException({ [field]: [`Use no more than ${options.scale} decimal places.`] });
  }
  return parsed;
}

export function optionalMoney(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return strictDecimal(value === '' || value === null ? 0 : value, field, { min: 0, scale: 2 }).toFixed(2);
}

export function optionalDate(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new BadRequestException({ [field]: ['Use YYYY-MM-DD format.'] });
  }
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BadRequestException({ [field]: ['Enter a real calendar date.'] });
  }
  return text;
}

export function optionalEnum(value: unknown, field: string, allowed: readonly string[]): string | undefined {
  if (value === undefined) return undefined;
  const text = String(value);
  if (!allowed.includes(text)) {
    throw new BadRequestException({ [field]: [`Use one of: ${allowed.map((v) => v || '(blank)').join(', ')}.`] });
  }
  return text;
}

export function requiredText(value: unknown, field: string, maxLength: number): string {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestException({ [field]: ['This field is required.'] });
  if (text.length > maxLength) {
    throw new BadRequestException({ [field]: [`Use at most ${maxLength} characters.`] });
  }
  return text;
}

