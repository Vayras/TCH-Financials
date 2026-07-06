// Indian fiscal year (April -> March) and billing-period rules, ported from
// the retired Django aggregation module. The frontend re-implements
// billingPeriodOf in lib/deals.ts — keep the two in sync.

import { Decimal, D } from './decimal';
import { CommercialDeal } from '../entities';

export const MONTHS_FY_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
export const MONTH_NAME: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};
export const QUARTERS: Array<[string, number[]]> = [
  ['Q1', [4, 5, 6]],
  ['Q2', [7, 8, 9]],
  ['Q3', [10, 11, 12]],
  ['Q4', [1, 2, 3]],
];

// Return the FY-start calendar year. April 2026 -> 2026; Feb 2027 -> 2026.
export function fiscalYearOf(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m >= 4 ? y : y - 1;
}

export function fyLabel(fyStart: number): string {
  const a = String(fyStart % 100).padStart(2, '0');
  const b = String((fyStart + 1) % 100).padStart(2, '0');
  return `FY ${Number(a)}-${Number(b)}`;
}

const MONTH_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
// e.g. "TCH/2526/Dec01" -> fy token "2526", month token "Dec"
const INVOICE_RE = /(\d{2})(\d{2})\s*\/\s*([A-Za-z]{3,9})/;

/**
 * Derive the billing month from an E-Invoice No like 'TCH/2526/Dec01'.
 * The FY token '2526' means FY 2025-26 (fy_start = 2025); Apr-Dec map to the
 * fy_start year, Jan-Mar to fy_start + 1. Returns 'YYYY-MM-01' or null when
 * blank/unparseable (deal not yet invoiced).
 */
export function invoicePeriod(eInvoiceNumber: string | null | undefined): string | null {
  if (!eInvoiceNumber) return null;
  const s = String(eInvoiceNumber).split(/\s+/).join(' ');
  const m = INVOICE_RE.exec(s);
  if (!m) return null;
  const fyStart = 2000 + Number(m[1]);
  const month = MONTH_NUM[m[3].slice(0, 3).toLowerCase()];
  if (!month) return null;
  const year = month >= 4 ? fyStart : fyStart + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

/**
 * The billing month a deal belongs to. The E-Invoice No is authoritative;
 * blank/unparseable falls back to the month of e_invoice_date. Null means the
 * deal isn't invoiced yet and belongs to no fiscal year.
 */
export function billingPeriod(deal: CommercialDeal): string | null {
  const period = invoicePeriod(deal.eInvoiceNumber);
  if (period !== null) return period;
  if (deal.eInvoiceDate) return `${deal.eInvoiceDate.slice(0, 7)}-01`;
  return null;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function quarterKey(iso: string): string {
  const m = Number(iso.slice(5, 7));
  for (const [qk, months] of QUARTERS) {
    if (months.includes(m)) return qk;
  }
  return '';
}

export interface CreatorSplit {
  creatorId: number | null;
  relationship: string;
  name: string;
  category: string;
  opsManager: string;
  fee: Decimal;
  profit: Decimal;
  creatorFee: Decimal;
}

/**
 * Yield each creator's contribution to a deal. With DealCreatorShare rows the
 * billing/profit is split across them; otherwise the whole deal is attributed
 * to the single deal.creator. Raw / outsider names map to 'NonTCH'.
 * Requires deal.creator, deal.creatorShares (+ their creator) to be loaded.
 */
export function creatorSplits(deal: CommercialDeal): CreatorSplit[] {
  const shares = deal.creatorShares ?? [];
  if (shares.length) {
    return shares.map((s) =>
      s.creatorId && s.creator
        ? {
            creatorId: Number(s.creatorId),
            relationship: s.creator.relationship || 'Friend',
            name: s.creator.name,
            category: s.creator.category || '',
            opsManager: s.creator.opsManager || '',
            fee: D(s.totalFee),
            profit: D(s.agencyFeeInr),
            creatorFee: D(s.creatorFee),
          }
        : {
            creatorId: null,
            relationship: 'NonTCH',
            name: (s.creatorNameRaw || '').trim() || '(Unnamed)',
            category: '',
            opsManager: '',
            fee: D(s.totalFee),
            profit: D(s.agencyFeeInr),
            creatorFee: D(s.creatorFee),
          },
    );
  }
  if (deal.creatorId && deal.creator) {
    return [{
      creatorId: Number(deal.creatorId),
      relationship: deal.creator.relationship || 'Friend',
      name: deal.creator.name,
      category: deal.creator.category || '',
      opsManager: deal.creator.opsManager || '',
      fee: D(deal.totalFee),
      profit: D(deal.agencyFeeInr),
      creatorFee: D(deal.creatorFee),
    }];
  }
  return [{
    creatorId: null,
    relationship: 'NonTCH',
    name: (deal.creatorNameRaw || '').trim() || '(Unnamed)',
    category: '',
    opsManager: '',
    fee: D(deal.totalFee),
    profit: D(deal.agencyFeeInr),
    creatorFee: D(deal.creatorFee),
  }];
}
