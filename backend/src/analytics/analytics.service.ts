// Derived summaries over CommercialDeal — the single source of truth. Ported
// verbatim from the retired Django aggregation module; payload shapes must
// match the frontend types in frontend/lib/api.ts.

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { D, Decimal, frac4, money } from '../common/decimal';
import {
  MONTHS_FY_ORDER, MONTH_NAME, QUARTERS, billingPeriod, creatorSplits,
  fiscalYearOf, fyLabel, monthKey, quarterKey,
} from '../common/fy';
import { CommercialDeal } from '../entities';

type MoneyMap = Map<string, Decimal>;

const zeroBlock = () => ({
  byMonth: new Map<string, Decimal>() as MoneyMap,
  byQuarter: new Map<string, Decimal>() as MoneyMap,
  total: new Decimal(0),
});

const bump = (m: MoneyMap, k: string, v: Decimal) => m.set(k, (m.get(k) ?? new Decimal(0)).add(v));

const plainMoney = (m: MoneyMap) =>
  Object.fromEntries([...m.entries()].map(([k, v]) => [k, money(v)]));

function counter(items: string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  // Python's Counter.most_common: count desc, insertion order for ties.
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

@Injectable()
export class AnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async allDeals(): Promise<CommercialDeal[]> {
    return this.dataSource.getRepository(CommercialDeal).find({
      relations: ['creator', 'campaign', 'creatorShares', 'creatorShares.creator'],
      order: { id: 'ASC' },
    });
  }

  private monthsMeta(fyStart: number, withYear: boolean) {
    return MONTHS_FY_ORDER.map((m) => {
      const y = m >= 4 ? fyStart : fyStart + 1;
      const key = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
      return { key, label: withYear ? `${MONTH_NAME[m]} ${y}` : MONTH_NAME[m] };
    });
  }

  private inFy(periodISO: string, fyStart: number): boolean {
    return fiscalYearOf(periodISO) === fyStart;
  }

  async overview(fyStart: number, creatorName = ''): Promise<Record<string, unknown>> {
    const deals = await this.allDeals();

    const quartersMeta = [
      { key: 'Q1', label: 'Q1 (Apr-Jun)' },
      { key: 'Q2', label: 'Q2 (Jul-Sep)' },
      { key: 'Q3', label: 'Q3 (Oct-Dec)' },
      { key: 'Q4', label: 'Q4 (Jan-Mar)' },
    ];

    interface Row {
      campaignId: number | null;
      name: string;
      brand: string;
      status: string;
      creatorNames: Set<string>;
      dealCount: number;
      byMonth: MoneyMap;
      byQuarter: MoneyMap;
      total: Decimal;
      profit: Decimal;
    }
    const rows = new Map<string, Row>();
    const emw = zeroBlock();
    const profits = zeroBlock();
    const totals = zeroBlock();
    const notInvoiced = { count: 0, totalFee: new Decimal(0), profit: new Decimal(0) };

    for (const deal of deals) {
      // Scope to one creator's share when filtering; the whole deal otherwise.
      let dealFee: Decimal;
      let dealProfit: Decimal;
      if (creatorName) {
        const matches = creatorSplits(deal).filter((c) => c.name === creatorName);
        if (!matches.length) continue;
        dealFee = matches.reduce((s, c) => s.add(c.fee), new Decimal(0));
        dealProfit = matches.reduce((s, c) => s.add(c.profit), new Decimal(0));
      } else {
        dealFee = D(deal.totalFee);
        dealProfit = D(deal.agencyFeeInr);
      }

      const period = billingPeriod(deal);
      if (period === null) {
        notInvoiced.count += 1;
        notInvoiced.totalFee = notInvoiced.totalFee.add(dealFee);
        notInvoiced.profit = notInvoiced.profit.add(dealProfit);
        continue;
      }
      if (!this.inFy(period, fyStart)) continue;

      const mk = monthKey(period);
      const qk = quarterKey(period);
      const be = (deal.billingEntity || '').toUpperCase();
      const isEmw = be.includes('EMW') || be.includes('ELEMENTS MEDIAWORK');

      const rowKey = deal.campaignId === null ? 'none' : String(deal.campaignId);
      let row = rows.get(rowKey);
      if (!row) {
        row = {
          campaignId: deal.campaignId === null ? null : Number(deal.campaignId),
          name: deal.campaignId && deal.campaign ? deal.campaign.name : '(No Campaign)',
          brand: deal.campaignId && deal.campaign ? deal.campaign.brand : '',
          status: deal.campaignId && deal.campaign ? deal.campaign.status : '',
          creatorNames: new Set<string>(),
          dealCount: 0,
          byMonth: new Map(),
          byQuarter: new Map(),
          total: new Decimal(0),
          profit: new Decimal(0),
        };
        rows.set(rowKey, row);
      }
      row.dealCount += 1;
      bump(row.byMonth, mk, dealFee);
      bump(row.byQuarter, qk, dealFee);
      row.total = row.total.add(dealFee);
      row.profit = row.profit.add(dealProfit);
      for (const c of creatorSplits(deal)) {
        if (c.name) row.creatorNames.add(c.name);
      }

      bump(totals.byMonth, mk, dealFee);
      bump(totals.byQuarter, qk, dealFee);
      totals.total = totals.total.add(dealFee);
      bump(profits.byMonth, mk, dealProfit);
      bump(profits.byQuarter, qk, dealProfit);
      profits.total = profits.total.add(dealProfit);
      if (isEmw) {
        bump(emw.byMonth, mk, dealFee);
        bump(emw.byQuarter, qk, dealFee);
        emw.total = emw.total.add(dealFee);
      }
    }

    const pctOf = (num: Decimal, denom: Decimal) =>
      denom.isZero() ? new Decimal(0) : num.div(denom);
    const pctMap = (num: MoneyMap, denom: MoneyMap) =>
      Object.fromEntries(
        [...denom.keys()].map((k) => [
          k,
          frac4(pctOf(num.get(k) ?? new Decimal(0), denom.get(k)!)),
        ]),
      );

    const payloadRows = [...rows.values()]
      .map((r) => ({
        campaign_id: r.campaignId,
        name: r.name,
        brand: r.brand,
        status: r.status,
        creators: [...r.creatorNames].sort(),
        deal_count: r.dealCount,
        by_month: plainMoney(r.byMonth),
        by_quarter: plainMoney(r.byQuarter),
        total: money(r.total),
        profit: money(r.profit),
      }))
      .sort((a, b) => D(b.total).cmp(D(a.total)));

    // Campaign counts include every campaign with a deal in this FY by either
    // lens — billed OR confirmed — so ongoing campaigns without invoices yet
    // still tally as Active instead of vanishing.
    const campaignStatusInFy = new Map<string, string>();
    for (const deal of deals) {
      if (deal.campaignId === null || !deal.campaign) continue;
      if (creatorName && !creatorSplits(deal).some((c) => c.name === creatorName)) continue;
      const period = billingPeriod(deal);
      const conf = deal.confirmationDate;
      const inFy =
        (period !== null && this.inFy(period, fyStart)) ||
        (conf !== null && fiscalYearOf(conf) === fyStart);
      if (inFy) campaignStatusInFy.set(String(deal.campaignId), deal.campaign.status);
    }
    const campaignCounts: Record<string, number> = { Active: 0, Over: 0 };
    for (const status of campaignStatusInFy.values()) {
      if (status in campaignCounts) campaignCounts[status] += 1;
    }

    return {
      fy: fyLabel(fyStart),
      fy_start: fyStart,
      months: this.monthsMeta(fyStart, true),
      quarters: quartersMeta,
      campaign_counts: campaignCounts,
      total_campaigns: campaignStatusInFy.size,
      rows: payloadRows,
      totals: {
        by_month: plainMoney(totals.byMonth),
        by_quarter: plainMoney(totals.byQuarter),
        total: money(totals.total),
      },
      emw_billing: {
        by_month: plainMoney(emw.byMonth),
        by_quarter: plainMoney(emw.byQuarter),
        total: money(emw.total),
      },
      profits: {
        by_month: plainMoney(profits.byMonth),
        by_quarter: plainMoney(profits.byQuarter),
        total: money(profits.total),
      },
      emw_pct: {
        by_month: pctMap(emw.byMonth, totals.byMonth),
        by_quarter: pctMap(emw.byQuarter, totals.byQuarter),
        total: frac4(pctOf(emw.total, totals.total)),
      },
      profit_pct: {
        by_month: pctMap(profits.byMonth, totals.byMonth),
        by_quarter: pctMap(profits.byQuarter, totals.byQuarter),
        total: frac4(pctOf(profits.total, totals.total)),
      },
      // FY-independent: deals with no E-Invoice No yet (awaiting invoicing).
      not_invoiced: {
        count: notInvoiced.count,
        total_fee: money(notInvoiced.totalFee),
        profit: money(notInvoiced.profit),
      },
    };
  }

  async entitySummary(
    fyStart: number,
    entityFilter = '',
    quarter = '',
    month = '',
  ): Promise<Record<string, unknown>> {
    const deals = await this.allDeals();

    let quarterMonths: Set<number> | null = null;
    if (quarter) {
      for (const [qk, qm] of QUARTERS) {
        if (qk === quarter) quarterMonths = new Set(qm);
      }
    }
    const targetMonth = month ? Number(month) : null;
    const ef = entityFilter.toLowerCase();

    interface EntityAgg {
      entity: string;
      dealCount: number;
      totalBilling: Decimal;
      totalProfit: Decimal;
      campaignNames: string[];
      creatorNames: string[];
      brands: string[];
    }
    const entities = new Map<string, EntityAgg>();
    for (const deal of deals) {
      const period = billingPeriod(deal);
      if (period === null || !this.inFy(period, fyStart)) continue;
      const periodMonth = Number(period.slice(5, 7));
      if (quarterMonths && !quarterMonths.has(periodMonth)) continue;
      if (targetMonth !== null && periodMonth !== targetMonth) continue;
      if (ef && !(deal.billingEntity || '').toLowerCase().includes(ef)) continue;
      const be = (deal.billingEntity || '').trim() || '(No Entity)';
      let e = entities.get(be);
      if (!e) {
        e = {
          entity: be,
          dealCount: 0,
          totalBilling: new Decimal(0),
          totalProfit: new Decimal(0),
          campaignNames: [],
          creatorNames: [],
          brands: [],
        };
        entities.set(be, e);
      }
      e.dealCount += 1;
      e.totalBilling = e.totalBilling.add(D(deal.totalFee));
      e.totalProfit = e.totalProfit.add(D(deal.agencyFeeInr));
      if (deal.campaignId && deal.campaign) e.campaignNames.push(deal.campaign.name);
      for (const c of creatorSplits(deal)) {
        if (c.name) e.creatorNames.push(c.name);
      }
      if (deal.brand) e.brands.push(deal.brand);
    }

    const rows = [...entities.values()]
      .map((data) => {
        const campaigns = [...new Set(data.campaignNames)].sort();
        const creators = [...new Set(data.creatorNames)].sort();
        return {
          entity: data.entity,
          deal_count: data.dealCount,
          total_billing: money(data.totalBilling),
          total_profit: money(data.totalProfit),
          campaign_count: campaigns.length,
          campaigns,
          creator_count: creators.length,
          creators,
          top_brands: counter(data.brands).slice(0, 5).map(([b]) => b),
        };
      })
      .sort((a, b) => D(b.total_billing).cmp(D(a.total_billing)));

    const grandBilling = rows.reduce((s, r) => s.add(D(r.total_billing)), new Decimal(0));
    const grandProfit = rows.reduce((s, r) => s.add(D(r.total_profit)), new Decimal(0));

    return {
      fy: fyLabel(fyStart),
      fy_start: fyStart,
      entity_filter: entityFilter,
      quarter,
      month,
      entities: rows,
      grand_total_billing: money(grandBilling),
      grand_total_profit: money(grandProfit),
    };
  }

  async creatorInsights(fyStart: number): Promise<Record<string, unknown>> {
    const deals = await this.allDeals();

    interface Agg {
      creatorId: number | null;
      creatorName: string;
      relationship: string;
      category: string;
      opsManager: string;
      totalCount: number;
      inboundCount: number;
      outboundCount: number;
      markupCount: number;
      totalBilling: Decimal;
      totalProfit: Decimal;
      totalCreatorFee: Decimal;
      firstDate: string | null;
      lastDate: string | null;
      brands: string[];
      deliverables: string[];
      campaigns: string[];
      billingEntities: string[];
      byMonth: MoneyMap;
      paidCount: number;
      overCount: number;
    }
    const agg = new Map<string, Agg>();
    for (const d of deals) {
      const period = billingPeriod(d);
      if (period === null || !this.inFy(period, fyStart)) continue;
      const mk = monthKey(period);

      for (const c of creatorSplits(d)) {
        const key = c.creatorId ? `id:${c.creatorId}` : `raw:${c.name}`;
        let a = agg.get(key);
        if (!a) {
          a = {
            creatorId: c.creatorId,
            creatorName: c.name,
            relationship: c.relationship,
            category: c.category,
            opsManager: c.opsManager,
            totalCount: 0,
            inboundCount: 0,
            outboundCount: 0,
            markupCount: 0,
            totalBilling: new Decimal(0),
            totalProfit: new Decimal(0),
            totalCreatorFee: new Decimal(0),
            firstDate: null,
            lastDate: null,
            brands: [],
            deliverables: [],
            campaigns: [],
            billingEntities: [],
            byMonth: new Map(),
            paidCount: 0,
            overCount: 0,
          };
          agg.set(key, a);
        }

        a.totalCount += 1;
        a.totalBilling = a.totalBilling.add(c.fee);
        a.totalProfit = a.totalProfit.add(c.profit);
        a.totalCreatorFee = a.totalCreatorFee.add(c.creatorFee);
        if (d.direction === 'Inbound') a.inboundCount += 1;
        else if (d.direction === 'Outbound') a.outboundCount += 1;
        else a.markupCount += 1;

        if (d.confirmationDate) {
          if (a.firstDate === null || d.confirmationDate < a.firstDate) {
            a.firstDate = d.confirmationDate;
          }
          if (a.lastDate === null || d.confirmationDate > a.lastDate) {
            a.lastDate = d.confirmationDate;
          }
        }
        bump(a.byMonth, mk, c.fee);

        if (d.brand) a.brands.push(d.brand);
        if (d.deliverables) a.deliverables.push(d.deliverables);
        if (d.campaignId && d.campaign) a.campaigns.push(d.campaign.name);
        if (d.billingEntity) a.billingEntities.push(d.billingEntity);
        if (d.paymentReceived === 'Y') a.paidCount += 1;
        if (d.campaignOver === 'Y') a.overCount += 1;
      }
    }

    const results = [...agg.values()]
      .map((v) => {
        const brandCounts = counter(v.brands);
        const deliverableCounts = counter(v.deliverables);
        const entityCounts = counter(v.billingEntities);
        const billing = v.totalBilling;
        const avgDeal = v.totalCount ? billing.div(v.totalCount) : new Decimal(0);
        const margin = billing.isZero() ? new Decimal(0) : v.totalProfit.div(billing);
        const monthsActive = [...v.byMonth.values()].filter((x) => x.gt(0)).length;
        return {
          creator_id: v.creatorId,
          creator_name: v.creatorName,
          relationship: v.relationship,
          category: v.category,
          ops_manager: v.opsManager,
          total_count: v.totalCount,
          inbound_count: v.inboundCount,
          outbound_count: v.outboundCount,
          markup_count: v.markupCount,
          total_billing: money(billing),
          total_profit: money(v.totalProfit),
          total_creator_fee: money(v.totalCreatorFee),
          avg_deal_size: money(avgDeal),
          profit_margin: frac4(margin),
          first_date: v.firstDate,
          last_date: v.lastDate,
          months_active: monthsActive,
          brand_count: new Set(v.brands).size,
          top_brands: brandCounts.slice(0, 5).map(([b]) => b),
          repeat_brands: brandCounts.filter(([, c]) => c > 1).map(([b, c]) => `${b} (${c})`),
          common_deliverable: deliverableCounts[0]?.[0] ?? '',
          top_billing_entity: entityCounts[0]?.[0] ?? '',
          paid_count: v.paidCount,
          over_count: v.overCount,
          by_month: plainMoney(v.byMonth),
        };
      })
      .sort((a, b) => D(b.total_billing).cmp(D(a.total_billing)));

    return {
      fy: fyLabel(fyStart),
      fy_start: fyStart,
      months: this.monthsMeta(fyStart, false),
      creators: results,
      grand_total_billing: money(
        results.reduce((s, r) => s.add(D(r.total_billing)), new Decimal(0)),
      ),
      grand_total_profit: money(
        results.reduce((s, r) => s.add(D(r.total_profit)), new Decimal(0)),
      ),
      grand_total_deals: results.reduce((s, r) => s + r.total_count, 0),
      creator_count: results.length,
    };
  }

  async quarterlyExclusives(fyStart: number): Promise<Array<Record<string, unknown>>> {
    const deals = await this.allDeals();

    interface QAgg {
      creatorId: number | null;
      creatorName: string;
      quarter: string;
      inboundCount: number;
      inboundAmount: Decimal;
      inboundCreatorFee: Decimal;
      inboundTchProfit: Decimal;
      outboundCount: number;
      outboundAmount: Decimal;
      outboundCreatorFee: Decimal;
      outboundTchProfit: Decimal;
      brands: string[];
      deliverables: string[];
    }
    const agg = new Map<string, QAgg>();
    for (const d of deals) {
      const period = billingPeriod(d);
      if (period === null || !this.inFy(period, fyStart)) continue;
      const qk = quarterKey(period);
      for (const c of creatorSplits(d)) {
        if (c.relationship !== 'Exclusive') continue;
        const key = `${c.creatorId}|${c.name}|${qk}`;
        let a = agg.get(key);
        if (!a) {
          a = {
            creatorId: c.creatorId,
            creatorName: c.name,
            quarter: qk,
            inboundCount: 0,
            inboundAmount: new Decimal(0),
            inboundCreatorFee: new Decimal(0),
            inboundTchProfit: new Decimal(0),
            outboundCount: 0,
            outboundAmount: new Decimal(0),
            outboundCreatorFee: new Decimal(0),
            outboundTchProfit: new Decimal(0),
            brands: [],
            deliverables: [],
          };
          agg.set(key, a);
        }
        if (d.direction === 'Inbound') {
          a.inboundCount += 1;
          a.inboundAmount = a.inboundAmount.add(c.fee);
          a.inboundCreatorFee = a.inboundCreatorFee.add(c.creatorFee);
          a.inboundTchProfit = a.inboundTchProfit.add(c.profit);
        } else {
          a.outboundCount += 1;
          a.outboundAmount = a.outboundAmount.add(c.fee);
          a.outboundCreatorFee = a.outboundCreatorFee.add(c.creatorFee);
          a.outboundTchProfit = a.outboundTchProfit.add(c.profit);
        }
        if (d.brand) a.brands.push(d.brand);
        if (d.deliverables) a.deliverables.push(d.deliverables);
      }
    }

    const qRank: Record<string, number> = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
    return [...agg.values()]
      .map((v) => {
        const brandCounts = counter(v.brands);
        const deliverableCounts = counter(v.deliverables);
        return {
          creator_id: v.creatorId,
          creator_name: v.creatorName,
          quarter: v.quarter,
          inbound_count: v.inboundCount,
          inbound_amount: money(v.inboundAmount),
          inbound_creator_fee: money(v.inboundCreatorFee),
          inbound_tch_profit: money(v.inboundTchProfit),
          outbound_count: v.outboundCount,
          outbound_amount: money(v.outboundAmount),
          outbound_creator_fee: money(v.outboundCreatorFee),
          outbound_tch_profit: money(v.outboundTchProfit),
          top_brands: brandCounts.slice(0, 5).map(([b]) => b),
          repeat_brands: brandCounts.filter(([, c]) => c > 1).map(([b, c]) => `${b} (${c})`),
          common_deliverable: deliverableCounts[0]?.[0] ?? '',
        };
      })
      .sort(
        (a, b) =>
          a.creator_name.localeCompare(b.creator_name) ||
          (qRank[a.quarter] ?? 9) - (qRank[b.quarter] ?? 9),
      );
  }
}
