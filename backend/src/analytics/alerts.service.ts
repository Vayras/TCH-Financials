// Alerts — formula-derived signals from the same source-of-truth tables,
// ported from the retired Django aggregation module.

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual } from 'typeorm';
import {
  addDays, daysBetween, nextWednesdayOnOrAfter, safeDate, todayISO,
} from '../common/dates';
import { D, Decimal } from '../common/decimal';
import { QUARTERS, creatorSplits, fiscalYearOf } from '../common/fy';
import {
  AlertDismissal, ContractingCompliance, Creator, CreatorDocument, DealDocument,
} from '../entities';
import { AnalyticsService } from './analytics.service';

// Creator payment cycle -> days added to the invoice date before the
// Wednesday clearing run.
const CYCLE_DAYS: Record<string, number> = {
  '': 0, Immediate: 0, Net15: 15, Net30: 30, Net45: 45, Net60: 60,
};

// Thresholds (calendar days)
const INACTIVE_CREATOR_DAYS = 45; // Exclusive/Friend with no deal in this many days
const INVOICE_OVERDUE_DAYS = 30; // campaign_over='Y' but invoice_received != 'Y'
const PAYMENT_OVERDUE_DAYS = 30; // invoice_received='Y' but payment_received != 'Y'
const BRAND_DORMANT_DAYS = 90; // brand had deals, none in this window
const BRAND_HOT_WINDOW_DAYS = 60; // 3+ deals to same brand within this window
const RENEWAL_DUE_DAYS = 30; // contracting.renewal_date within this window
const QOQ_DROP_PCT = 0.2; // 20% drop quarter-over-quarter

// Hard-coded seasonal calendar (recurring Indian retail / cultural moments).
const SEASONAL_MOMENTS: Array<[number, number, string]> = [
  [1, 26, 'Republic Day'],
  [3, 14, 'Holi'],
  [3, 31, 'FY End'],
  [8, 15, 'Independence Day'],
  [10, 2, 'Gandhi Jayanti'],
  [11, 1, 'Diwali (approx)'],
  [12, 25, 'Christmas'],
  [12, 31, 'Year End'],
];

interface AlertItem {
  kind: string;
  severity: 'high' | 'med' | 'low';
  title: string;
  detail: string;
  action: string;
  meta: Record<string, string | number | boolean | null>;
  key?: string;
}

function nextOccurrence(today: string, month: number, day: number): string {
  const year = Number(today.slice(0, 4));
  let candidate = safeDate(year, month, day);
  if (candidate < today) candidate = safeDate(year + 1, month, day);
  return candidate;
}

/**
 * Stable identity of an alert across recomputes, used for dismissals. Built
 * from the alert kind plus whatever in its meta pins down the underlying
 * fact — never the title, which embeds moving parts like age in days.
 */
export function alertKey(item: AlertItem): string {
  const meta = item.meta ?? {};
  const kind = item.kind;
  let ident: string;
  if (
    kind === 'invoice_overdue' || kind === 'payment_overdue' ||
    kind === 'upload_invoice' || kind === 'clear_payment'
  ) {
    ident = `deal:${meta.deal_id}`;
  } else if (['inactive_creator', 'missing_documents', 'renewal_due'].includes(kind)) {
    ident = `creator:${meta.creator_id}`;
  } else if (kind === 'billing_drop') {
    ident = `creator:${meta.creator_id}:${meta.quarter}`;
  } else if (kind === 'brand_dormant' || kind === 'brand_hot') {
    ident = `brand:${meta.brand}`;
  } else if (kind === 'seasonal') {
    ident = `date:${meta.date}`;
  } else {
    ident = item.title ?? '';
  }
  return `${kind}|${ident}`;
}

@Injectable()
export class AlertsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly analytics: AnalyticsService,
  ) {}

  async compute(today: string = todayISO()): Promise<Record<string, unknown>> {
    const deals = await this.analytics.allDeals();

    // ---- Urgent ----
    const urgent: AlertItem[] = [];

    // (a) Inactive Exclusive/Friend creators
    const lastDealByCreator = new Map<number, string>();
    for (const d of deals) {
      if (!d.confirmationDate) continue;
      for (const c of creatorSplits(d)) {
        if (!c.creatorId) continue;
        const prev = lastDealByCreator.get(c.creatorId);
        if (!prev || d.confirmationDate > prev) {
          lastDealByCreator.set(c.creatorId, d.confirmationDate);
        }
      }
    }
    const activeCreators = await this.dataSource.getRepository(Creator).find({
      where: [{ relationship: 'Exclusive' }, { relationship: 'Friend' }],
    });
    for (const c of activeCreators) {
      const last = lastDealByCreator.get(Number(c.id));
      if (!last) {
        // No deal ever — only flag if creator joined more than threshold ago
        const anchor = c.doj || (c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : null);
        if (anchor && daysBetween(anchor, today) >= INACTIVE_CREATOR_DAYS) {
          const age = daysBetween(anchor, today);
          urgent.push({
            kind: 'inactive_creator',
            severity: c.relationship === 'Exclusive' ? 'high' : 'med',
            title: `${c.name} — No deal yet (${age} days since onboarding)`,
            detail: `${c.relationship}. No commercial deal recorded since onboarding.`,
            action: 'Open creator pipeline',
            meta: { creator_id: Number(c.id), age_days: age, relationship: c.relationship },
          });
        }
        continue;
      }
      const age = daysBetween(last, today);
      if (age >= INACTIVE_CREATOR_DAYS) {
        urgent.push({
          kind: 'inactive_creator',
          severity: c.relationship === 'Exclusive' ? 'high' : 'med',
          title: `${c.name} — No deal in ${age} days`,
          detail: `${c.relationship}. Last deal confirmed ${last}.`,
          action: 'Schedule check-in',
          meta: { creator_id: Number(c.id), age_days: age, relationship: c.relationship },
        });
      }
    }

    const campaignName = (d: (typeof deals)[number]) =>
      d.campaignId && d.campaign ? d.campaign.name : '';
    const whoOf = (d: (typeof deals)[number]) =>
      d.creatorId && d.creator ? d.creator.name : d.creatorNameRaw || '(no creator)';

    // (b) Invoice overdue — campaign over but invoice not yet received
    for (const d of deals) {
      if (d.campaignOver === 'Y' && d.invoiceReceived !== 'Y' && d.confirmationDate) {
        const age = daysBetween(d.confirmationDate, today);
        if (age >= INVOICE_OVERDUE_DAYS) {
          const who = whoOf(d);
          const campaign = campaignName(d) || `${d.brand || '(no brand)'} × ${who}`;
          urgent.push({
            kind: 'invoice_overdue',
            severity: age >= 60 ? 'high' : 'med',
            title: `${campaign} — Invoice not raised, ${age} days`,
            detail: `Campaign marked over. Brand ${d.brand || '—'} · ${who}. Total fee ₹ ${d.totalFee}. Billing entity: ${d.billingEntity || '—'}.`,
            action: 'Raise invoice',
            meta: {
              deal_id: Number(d.id),
              campaign_id: d.campaignId === null ? null : Number(d.campaignId),
              campaign: campaignName(d),
              age_days: age,
              brand: d.brand,
            },
          });
        }
      }
    }

    // (c) Payment overdue — invoice raised but payment not received
    for (const d of deals) {
      if (d.invoiceReceived === 'Y' && d.paymentReceived !== 'Y') {
        const anchor = d.eInvoiceDate || d.confirmationDate;
        if (!anchor) continue;
        const age = daysBetween(anchor, today);
        if (age >= PAYMENT_OVERDUE_DAYS) {
          const who = whoOf(d);
          const campaign = campaignName(d) || d.brand || '(no brand)';
          urgent.push({
            kind: 'payment_overdue',
            severity: age >= 60 ? 'high' : 'med',
            title: `${campaign} — Payment overdue, ${age} days`,
            detail: `Brand ${d.brand || '—'} · ${who}. ₹ ${d.totalFee} via ${d.billingEntity || '—'}. Invoice dated ${anchor}.`,
            action: 'Escalate to finance',
            meta: {
              deal_id: Number(d.id),
              campaign_id: d.campaignId === null ? null : Number(d.campaignId),
              campaign: campaignName(d),
              age_days: age,
              brand: d.brand,
            },
          });
        }
      }
    }

    // (d) Contract renewal due
    const cutoff = addDays(today, RENEWAL_DUE_DAYS);
    const contracts = await this.dataSource.getRepository(ContractingCompliance).find({
      where: { renewalDate: LessThanOrEqual(cutoff) }, // NULLs never satisfy <=
      relations: ['creator'],
    });
    for (const cc of contracts) {
      if (!cc.renewalDate || cc.renewalDate > cutoff) continue;
      const daysTo = daysBetween(today, cc.renewalDate);
      urgent.push({
        kind: 'renewal_due',
        severity: daysTo <= 14 ? 'high' : 'med',
        title: `${cc.creator?.name} — Renewal ${daysTo < 0 ? 'overdue' : `in ${daysTo} days`}`,
        detail: `Renewal date ${cc.renewalDate}. ${cc.renewalNote || ''}`.trim(),
        action: 'Draft renewal',
        meta: { creator_id: Number(cc.creatorId), days_to: daysTo },
      });
    }

    // ---- BD Opportunities ----
    const bd: AlertItem[] = [];
    const brandDates = new Map<string, string[]>();
    const brandCreators = new Map<string, Set<string>>();
    const brandBilling = new Map<string, Decimal>();
    for (const d of deals) {
      if (!d.brand || !d.confirmationDate) continue;
      brandDates.set(d.brand, [...(brandDates.get(d.brand) ?? []), d.confirmationDate]);
      const creators = brandCreators.get(d.brand) ?? new Set<string>();
      for (const c of creatorSplits(d)) {
        if (c.name) creators.add(c.name);
      }
      brandCreators.set(d.brand, creators);
      brandBilling.set(d.brand, (brandBilling.get(d.brand) ?? new Decimal(0)).add(D(d.totalFee)));
    }

    for (const [brand, dates] of brandDates) {
      const last = dates.reduce((a, b) => (a > b ? a : b));
      const age = daysBetween(last, today);
      // Dormant: had at least one deal historically, none in last 90d
      if (age >= BRAND_DORMANT_DAYS) {
        const months = Math.round(age / 30);
        bd.push({
          kind: 'brand_dormant',
          severity: 'med',
          title: `${brand} — Dormant for ${months} months`,
          detail: `Last deal ${last}. Lifetime billing ₹ ${brandBilling.get(brand)}. ${brandCreators.get(brand)!.size} creator(s) worked with this brand.`,
          action: 'Craft re-engagement pitch',
          meta: { brand, age_days: age },
        });
      }
      // Hot: 3+ deals in trailing 60d
      const recent = dates.filter((d) => daysBetween(d, today) <= BRAND_HOT_WINDOW_DAYS);
      if (recent.length >= 3) {
        bd.push({
          kind: 'brand_hot',
          severity: 'low',
          title: `${brand} — ${recent.length} active collabs in last ${BRAND_HOT_WINDOW_DAYS}d`,
          detail: `Creators on this brand: ${[...brandCreators.get(brand)!].sort().slice(0, 5).join(', ')}.`,
          action: 'Pitch more creators',
          meta: { brand, recent_count: recent.length },
        });
      }
    }

    // ---- Creator Health: QoQ billing drop for exclusives ----
    const health: AlertItem[] = [];
    const fyNow = fiscalYearOf(today);
    const todayMonth = Number(today.slice(5, 7));
    let curQIdx = QUARTERS.findIndex(([, months]) => months.includes(todayMonth));
    if (curQIdx < 0) curQIdx = 0;

    const qAgg = new Map<string, { billing: Decimal; name: string }>();
    for (const d of deals) {
      if (!d.confirmationDate) continue;
      const fy = fiscalYearOf(d.confirmationDate);
      const m = Number(d.confirmationDate.slice(5, 7));
      const qk = QUARTERS.find(([, months]) => months.includes(m))?.[0] ?? 'Q1';
      for (const c of creatorSplits(d)) {
        if (c.relationship !== 'Exclusive' || !c.creatorId) continue;
        const key = `${c.creatorId}|${qk}|${fy}`;
        const a = qAgg.get(key) ?? { billing: new Decimal(0), name: c.name };
        a.billing = a.billing.add(c.fee);
        qAgg.set(key, a);
      }
    }

    const curQk = QUARTERS[curQIdx][0];
    const [prevQk, prevFy] =
      curQIdx === 0 ? [QUARTERS[3][0], fyNow - 1] : [QUARTERS[curQIdx - 1][0], fyNow];

    const pick = (qk: string, fy: number) => {
      const out = new Map<number, { billing: Decimal; name: string }>();
      for (const [key, v] of qAgg) {
        const [cid, k, f] = key.split('|');
        if (k === qk && Number(f) === fy) out.set(Number(cid), v);
      }
      return out;
    };
    const curByCreator = pick(curQk, fyNow);
    const prevByCreator = pick(prevQk, prevFy);

    for (const [cid, prev] of prevByCreator) {
      const cur = curByCreator.get(cid);
      const prevBill = prev.billing;
      const curBill = cur ? cur.billing : new Decimal(0);
      if (prevBill.lte(0)) continue;
      const drop = prevBill.minus(curBill).div(prevBill);
      if (drop.gte(QOQ_DROP_PCT)) {
        const dropPct = Math.trunc(drop.mul(100).toNumber());
        health.push({
          kind: 'billing_drop',
          severity: dropPct >= 50 ? 'high' : 'med',
          title: `${prev.name} — Billing dropped ${dropPct}% QoQ`,
          detail: `${prevQk}: ₹ ${prevBill}. ${curQk}: ₹ ${curBill}.`,
          action: 'Review pipeline',
          // quarter makes the dismissal key per-quarter, so a dismissed drop
          // alert can fire again next quarter.
          meta: { creator_id: cid, drop_pct: dropPct, quarter: `${fyNow}-${curQk}` },
        });
      }
    }

    // ---- Documents missing ----
    const docs: AlertItem[] = [];
    const withDocs = new Set(
      (await this.dataSource.getRepository(CreatorDocument).find({ select: ['creatorId'] })).map(
        (d) => Number(d.creatorId),
      ),
    );
    for (const c of activeCreators) {
      if (withDocs.has(Number(c.id))) continue;
      docs.push({
        kind: 'missing_documents',
        severity: c.relationship === 'Exclusive' ? 'high' : 'med',
        title: `${c.name} — No documents on file`,
        detail: `${c.relationship}. No agreement / KYC document uploaded yet.`,
        action: 'Upload documents',
        meta: { creator_id: Number(c.id), relationship: c.relationship },
      });
    }

    // ---- Payments: upload invoices / clear payment ----
    const payments: AlertItem[] = [];
    const dealDocs = await this.dataSource.getRepository(DealDocument).find();
    const docsByDeal = new Map<number, { hasClient: boolean; hasCreator: boolean }>();
    for (const dd of dealDocs) {
      const key = Number(dd.dealId);
      const entry = docsByDeal.get(key) ?? { hasClient: false, hasCreator: false };
      if (dd.docType === 'ClientInvoice') entry.hasClient = true;
      if (dd.docType === 'CreatorInvoice') entry.hasCreator = true;
      docsByDeal.set(key, entry);
    }
    const nextWedFromToday = nextWednesdayOnOrAfter(today);

    for (const d of deals) {
      const docState = docsByDeal.get(Number(d.id)) ?? { hasClient: false, hasCreator: false };
      const invoicesIn = d.invoiceReceived === 'Y' || (docState.hasClient && docState.hasCreator);
      const cleared = d.paymentCleared === 'Y' || d.creatorPaymentStatus === 'Paid';
      const who = whoOf(d);

      // (a) Upload invoice — campaign wrapped up but invoices aren't both in.
      if (!cleared && !invoicesIn) {
        const campaignEndDate = d.campaignId !== null ? (d.campaign?.endDate ?? null) : null;
        const campaignEnded = !!campaignEndDate && campaignEndDate < today;
        if (d.campaignOver === 'Y' || campaignEnded) {
          const anchor = d.completedAt || campaignEndDate;
          const overdueDays = anchor ? daysBetween(anchor, today) : 0;
          const missing: 'client' | 'creator' | 'both' =
            !docState.hasClient && !docState.hasCreator
              ? 'both'
              : !docState.hasClient
                ? 'client'
                : 'creator';
          const missingLabel =
            missing === 'both' ? 'client & creator invoices' : `${missing} invoice`;
          payments.push({
            kind: 'upload_invoice',
            severity: anchor && overdueDays > 7 ? 'high' : 'med',
            title: `Upload invoices — ${d.brand || 'No brand'} / ${campaignName(d) || 'No campaign'}`,
            detail: `Missing ${missingLabel}. Creator: ${who}.`,
            action: `TCH POC ${d.tchPoc || 'unassigned'}: upload client & creator invoices in the Payments tab`,
            meta: { deal_id: Number(d.id), tch_poc: d.tchPoc, missing, creator: who },
          });
        }
      }

      // (b) Clear payment — invoices in, campaign over, not yet cleared.
      if (invoicesIn && !cleared && d.campaignOver === 'Y') {
        const base = d.creatorInvoiceDate || d.completedAt || today;
        const cycleDays = CYCLE_DAYS[d.creatorPaymentCycle] ?? 0;
        const due = nextWednesdayOnOrAfter(addDays(base, cycleDays));
        const severity: 'high' | 'med' | 'low' =
          due < today ? 'high' : due <= nextWedFromToday ? 'med' : 'low';
        const amount = D(d.creatorInvoiceAmount).isZero() ? d.creatorFee : d.creatorInvoiceAmount;
        const amountLabel = `₹${Number(amount).toLocaleString('en-IN')}`;
        payments.push({
          kind: 'clear_payment',
          severity,
          title: `Clear payment — ${amountLabel} to ${who}`,
          detail: `Due ${due} (Wednesday cycle). ${d.brand || '(no brand)'} / ${campaignName(d) || '(no campaign)'}.`,
          action:
            'Invoice team: pay this creator in the Wednesday cycle and mark it cleared in the Payments tab',
          meta: { deal_id: Number(d.id), due_date: due, amount: Number(amount), tch_poc: d.tchPoc },
        });
      }
    }

    // ---- Seasonal moments ----
    const seasonal: AlertItem[] = [];
    for (const [m, day, label] of SEASONAL_MOMENTS) {
      const nxt = nextOccurrence(today, m, day);
      const days = daysBetween(today, nxt);
      const weeks = Math.round(days / 7);
      seasonal.push({
        kind: 'seasonal',
        severity: 'low',
        title:
          weeks > 0
            ? `${label} — ${weeks} week${weeks !== 1 ? 's' : ''} away`
            : `${label} — today`,
        detail: `${nxt} (${days} days).`,
        action: 'Plan campaign',
        meta: { date: nxt, days_away: days, weeks_away: weeks },
      });
    }
    seasonal.sort((a, b) => (a.meta.days_away as number) - (b.meta.days_away as number));

    const sevRank: Record<string, number> = { high: 0, med: 1, low: 2 };
    const sortKey = (a: AlertItem, b: AlertItem) =>
      (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) ||
      ((b.meta.age_days as number) || 0) - ((a.meta.age_days as number) || 0);
    urgent.sort(sortKey);
    bd.sort(sortKey);
    health.sort(sortKey);
    docs.sort(
      (a, b) =>
        (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) ||
        a.title.localeCompare(b.title),
    );
    payments.sort(
      (a, b) =>
        (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) ||
        String(a.meta.due_date ?? '').localeCompare(String(b.meta.due_date ?? '')) ||
        a.title.localeCompare(b.title),
    );

    // Stamp stable keys and drop dismissed alerts.
    const dismissed = new Set(
      (await this.dataSource.getRepository(AlertDismissal).find()).map((d) => d.key),
    );
    let dismissedHits = 0;
    const keep = (items: AlertItem[]) =>
      items.filter((it) => {
        it.key = alertKey(it);
        if (dismissed.has(it.key)) {
          dismissedHits += 1;
          return false;
        }
        return true;
      });

    const kept = {
      urgent: keep(urgent),
      bd: keep(bd),
      health: keep(health),
      docs: keep(docs),
      seasonal: keep(seasonal),
      payments: keep(payments),
    };

    return {
      generated_at: today,
      thresholds: {
        inactive_creator_days: INACTIVE_CREATOR_DAYS,
        invoice_overdue_days: INVOICE_OVERDUE_DAYS,
        payment_overdue_days: PAYMENT_OVERDUE_DAYS,
        brand_dormant_days: BRAND_DORMANT_DAYS,
        brand_hot_window_days: BRAND_HOT_WINDOW_DAYS,
        renewal_due_days: RENEWAL_DUE_DAYS,
        qoq_drop_pct: QOQ_DROP_PCT,
      },
      ...kept,
      counts: {
        urgent: kept.urgent.length,
        bd: kept.bd.length,
        health: kept.health.length,
        docs: kept.docs.length,
        seasonal: kept.seasonal.length,
        payments: kept.payments.length,
      },
      dismissed_count: dismissedHits,
    };
  }

  async dismiss(keys: string[]): Promise<number> {
    const unique = [...new Set(keys)];
    await this.dataSource
      .getRepository(AlertDismissal)
      .createQueryBuilder()
      .insert()
      .values(unique.map((key) => ({ key })))
      .orIgnore()
      .execute();
    return unique.length;
  }

  async restore(): Promise<number> {
    const repo = this.dataSource.getRepository(AlertDismissal);
    const n = await repo.count();
    await repo.clear();
    return n;
  }
}
