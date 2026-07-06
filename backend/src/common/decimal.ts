import Decimal from 'decimal.js';

export { Decimal };

export const D = (v: string | number | null | undefined): Decimal => {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  try {
    return new Decimal(String(v));
  } catch {
    return new Decimal(0);
  }
};

// Accept both fractional (0.15) and human percent (15) inputs.
export function normalisePct(value: unknown): string {
  const pct = D(value as string);
  return (pct.gt(1) ? pct.div(100) : pct).toFixed(4);
}

// Money on the wire is a string with two decimals (numeric(14,2)).
export const money = (v: Decimal | string | number): string => D(v as string).toFixed(2);

// Percentages/fractions render with four decimals, like DRF's "%.4f".
export const frac4 = (v: Decimal | string | number): string => D(v as string).toFixed(4);

// Mirrors the Django serializer's "in (None, '')" required-field test.
export const isBlank = (v: unknown): boolean => v === null || v === undefined || v === '';
