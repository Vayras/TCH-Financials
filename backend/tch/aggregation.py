"""Aggregation logic that derives Current Overview and Quarterly Exclusives
from the CommercialDeal table — the single source of truth."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Iterable

from .models import CommercialDeal


# Indian fiscal year: April -> March.
MONTHS_FY_ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
MONTH_NAME = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
}
QUARTERS = [
    ('Q1', [4, 5, 6]),
    ('Q2', [7, 8, 9]),
    ('Q3', [10, 11, 12]),
    ('Q4', [1, 2, 3]),
]
BUCKET_ORDER = ['Exclusive', 'Dropping', 'Friend', 'NonTCH']
BUCKET_LABEL = {
    'Exclusive': 'Current Exclusives',
    'Dropping': 'Dropping out soon',
    'Friend': 'Friends',
    'NonTCH': 'Non TCH',
}


def fiscal_year_of(d: date) -> int:
    """Return the FY-start calendar year. April 2026 -> 2026; Feb 2027 -> 2026."""
    return d.year if d.month >= 4 else d.year - 1


def fy_label(fy_start: int) -> str:
    return f"FY {fy_start % 100}-{(fy_start + 1) % 100}"


def _bucket_for(deal: CommercialDeal) -> str:
    if deal.creator_id:
        return deal.creator.relationship or 'Friend'
    return 'NonTCH'


def _zero() -> Decimal:
    return Decimal('0')


def overview(fy_start: int) -> dict:
    """Return the entire Current Overview payload for a fiscal year.

    Structure:
      {
        "fy": "FY 26-27",
        "months": [{ "key": "2026-04", "label": "April 2026" }, ...],
        "quarters": [{ "key": "Q1", "label": "Q1 (Apr-Jun)" }, ...],
        "rows": {
          "Exclusive": {"label": "...", "by_month": {"2026-04": 12345.00, ...},
                        "by_quarter": {...}, "total": 12345.00},
          ...
        },
        "totals": { "by_month": {...}, "by_quarter": {...}, "total": ... },
        "emw_billing": { ... by_month, by_quarter, total ... },
        "profits":     { ... by_month, by_quarter, total ... },
        "reimbursements": { ... },
        "emw_pct":     { by_month, by_quarter, total }   # fractions 0..1
        "profit_pct":  { by_month, by_quarter, total }
      }
    """
    start = date(fy_start, 4, 1)
    end = date(fy_start + 1, 4, 1)

    deals = (
        CommercialDeal.objects
        .select_related('creator')
        .filter(confirmation_date__gte=start, confirmation_date__lt=end)
    )

    # month key = "YYYY-MM"; quarter key = "Q1".."Q4"
    def month_key(d: date) -> str:
        return f"{d.year:04d}-{d.month:02d}"

    def quarter_key(d: date) -> str:
        for qk, months in QUARTERS:
            if d.month in months:
                return qk
        return ''

    months_meta = []
    for m in MONTHS_FY_ORDER:
        y = fy_start if m >= 4 else fy_start + 1
        months_meta.append({'key': f"{y:04d}-{m:02d}", 'label': f"{MONTH_NAME[m]} {y}"})

    quarters_meta = [
        {'key': 'Q1', 'label': 'Q1 (Apr-Jun)'},
        {'key': 'Q2', 'label': 'Q2 (Jul-Sep)'},
        {'key': 'Q3', 'label': 'Q3 (Oct-Dec)'},
        {'key': 'Q4', 'label': 'Q4 (Jan-Mar)'},
    ]

    rows = {
        b: {
            'label': BUCKET_LABEL[b],
            'by_month': defaultdict(_zero),
            'by_quarter': defaultdict(_zero),
            'total': Decimal('0'),
        }
        for b in BUCKET_ORDER
    }
    emw = {'by_month': defaultdict(_zero), 'by_quarter': defaultdict(_zero), 'total': Decimal('0')}
    profits = {'by_month': defaultdict(_zero), 'by_quarter': defaultdict(_zero), 'total': Decimal('0')}
    totals = {'by_month': defaultdict(_zero), 'by_quarter': defaultdict(_zero), 'total': Decimal('0')}

    for deal in deals:
        if not deal.confirmation_date:
            continue
        bucket = _bucket_for(deal)
        mk = month_key(deal.confirmation_date)
        qk = quarter_key(deal.confirmation_date)
        fee = deal.total_fee or Decimal('0')
        profit = deal.agency_fee_inr or Decimal('0')

        rows[bucket]['by_month'][mk] += fee
        rows[bucket]['by_quarter'][qk] += fee
        rows[bucket]['total'] += fee
        totals['by_month'][mk] += fee
        totals['by_quarter'][qk] += fee
        totals['total'] += fee
        profits['by_month'][mk] += profit
        profits['by_quarter'][qk] += profit
        profits['total'] += profit
        if deal.billing_entity:
            be = deal.billing_entity.upper()
            if 'EMW' in be or 'ELEMENTS MEDIAWORK' in be:
                emw['by_month'][mk] += fee
                emw['by_quarter'][qk] += fee
                emw['total'] += fee

    def pct_of(num, denom) -> Decimal:
        return (num / denom) if denom else Decimal('0')

    emw_pct = {
        'by_month': {k: pct_of(emw['by_month'][k], totals['by_month'][k]) for k in totals['by_month']},
        'by_quarter': {k: pct_of(emw['by_quarter'][k], totals['by_quarter'][k]) for k in totals['by_quarter']},
        'total': pct_of(emw['total'], totals['total']),
    }
    profit_pct = {
        'by_month': {k: pct_of(profits['by_month'][k], totals['by_month'][k]) for k in totals['by_month']},
        'by_quarter': {k: pct_of(profits['by_quarter'][k], totals['by_quarter'][k]) for k in totals['by_quarter']},
        'total': pct_of(profits['total'], totals['total']),
    }

    def plain(d):
        return {k: str(v) for k, v in d.items()}

    payload_rows = {}
    for b in BUCKET_ORDER:
        r = rows[b]
        payload_rows[b] = {
            'label': r['label'],
            'by_month': plain(r['by_month']),
            'by_quarter': plain(r['by_quarter']),
            'total': str(r['total']),
        }

    return {
        'fy': fy_label(fy_start),
        'fy_start': fy_start,
        'months': months_meta,
        'quarters': quarters_meta,
        'bucket_order': BUCKET_ORDER,
        'rows': payload_rows,
        'totals': {
            'by_month': plain(totals['by_month']),
            'by_quarter': plain(totals['by_quarter']),
            'total': str(totals['total']),
        },
        'emw_billing': {
            'by_month': plain(emw['by_month']),
            'by_quarter': plain(emw['by_quarter']),
            'total': str(emw['total']),
        },
        'profits': {
            'by_month': plain(profits['by_month']),
            'by_quarter': plain(profits['by_quarter']),
            'total': str(profits['total']),
        },
        'emw_pct': {
            'by_month': {k: f"{float(v):.4f}" for k, v in emw_pct['by_month'].items()},
            'by_quarter': {k: f"{float(v):.4f}" for k, v in emw_pct['by_quarter'].items()},
            'total': f"{float(emw_pct['total']):.4f}",
        },
        'profit_pct': {
            'by_month': {k: f"{float(v):.4f}" for k, v in profit_pct['by_month'].items()},
            'by_quarter': {k: f"{float(v):.4f}" for k, v in profit_pct['by_quarter'].items()},
            'total': f"{float(profit_pct['total']):.4f}",
        },
    }


def entity_summary(fy_start: int, entity_filter: str = '') -> dict:
    """Summarise billing grouped by billing_entity for a fiscal year.
    If entity_filter is given, restrict to rows whose billing_entity contains that string."""
    start = date(fy_start, 4, 1)
    end = date(fy_start + 1, 4, 1)

    deals = (
        CommercialDeal.objects
        .select_related('creator')
        .filter(confirmation_date__gte=start, confirmation_date__lt=end)
    )
    if entity_filter:
        deals = deals.filter(billing_entity__icontains=entity_filter)

    from collections import Counter

    entities: dict[str, dict] = {}
    for deal in deals:
        be = (deal.billing_entity or '').strip() or '(No Entity)'
        if be not in entities:
            entities[be] = {
                'entity': be,
                'deal_count': 0,
                'total_billing': Decimal('0'),
                'total_profit': Decimal('0'),
                'creator_names': [],
                'brands': [],
            }
        e = entities[be]
        e['deal_count'] += 1
        e['total_billing'] += deal.total_fee or Decimal('0')
        e['total_profit'] += deal.agency_fee_inr or Decimal('0')
        name = deal.creator.name if deal.creator_id else deal.creator_name_raw
        if name:
            e['creator_names'].append(name)
        if deal.brand:
            e['brands'].append(deal.brand)

    rows = []
    for data in entities.values():
        brand_top = [b for b, _ in Counter(data['brands']).most_common(5)]
        creator_list = sorted(set(data['creator_names']))
        rows.append({
            'entity': data['entity'],
            'deal_count': data['deal_count'],
            'total_billing': str(data['total_billing']),
            'total_profit': str(data['total_profit']),
            'creator_count': len(creator_list),
            'creators': creator_list,
            'top_brands': brand_top,
        })

    rows.sort(key=lambda x: Decimal(x['total_billing']), reverse=True)
    grand_billing = sum(Decimal(r['total_billing']) for r in rows)
    grand_profit = sum(Decimal(r['total_profit']) for r in rows)

    return {
        'fy': fy_label(fy_start),
        'fy_start': fy_start,
        'entity_filter': entity_filter,
        'entities': rows,
        'grand_total_billing': str(grand_billing),
        'grand_total_profit': str(grand_profit),
    }


def quarterly_exclusives(fy_start: int) -> list[dict]:
    """Derive the 26-27 Exclusives sheet: per exclusive creator, per quarter,
    inbound/outbound deal counts, invoiced amount, creator fee, top brands, etc."""
    start = date(fy_start, 4, 1)
    end = date(fy_start + 1, 4, 1)

    deals = (
        CommercialDeal.objects
        .select_related('creator')
        .filter(
            confirmation_date__gte=start,
            confirmation_date__lt=end,
            creator__relationship='Exclusive',
        )
    )

    # key: (creator_id, creator_name, quarter) -> agg
    agg: dict[tuple, dict] = {}
    for d in deals:
        qk = ''
        for qn, months in QUARTERS:
            if d.confirmation_date.month in months:
                qk = qn
                break
        key = (d.creator_id, d.creator.name, qk)
        a = agg.setdefault(key, {
            'creator_id': d.creator_id,
            'creator_name': d.creator.name,
            'quarter': qk,
            'inbound_count': 0,
            'inbound_amount': Decimal('0'),
            'inbound_creator_fee': Decimal('0'),
            'inbound_tch_profit': Decimal('0'),
            'outbound_count': 0,
            'outbound_amount': Decimal('0'),
            'outbound_creator_fee': Decimal('0'),
            'outbound_tch_profit': Decimal('0'),
            'brands': [],
            'deliverables': [],
            'categories': [],
        })
        if d.direction == 'Inbound':
            a['inbound_count'] += 1
            a['inbound_amount'] += d.total_fee or Decimal('0')
            a['inbound_creator_fee'] += d.creator_fee or Decimal('0')
            a['inbound_tch_profit'] += d.agency_fee_inr or Decimal('0')
        else:
            a['outbound_count'] += 1
            a['outbound_amount'] += d.total_fee or Decimal('0')
            a['outbound_creator_fee'] += d.creator_fee or Decimal('0')
            a['outbound_tch_profit'] += d.agency_fee_inr or Decimal('0')
        if d.brand:
            a['brands'].append(d.brand)
        if d.deliverables:
            a['deliverables'].append(d.deliverables)

    results = []
    for v in agg.values():
        # top brands: frequency sorted
        from collections import Counter
        brand_counts = Counter(v['brands']).most_common()
        deliverable_counts = Counter(v['deliverables']).most_common()
        results.append({
            'creator_id': v['creator_id'],
            'creator_name': v['creator_name'],
            'quarter': v['quarter'],
            'inbound_count': v['inbound_count'],
            'inbound_amount': str(v['inbound_amount']),
            'inbound_creator_fee': str(v['inbound_creator_fee']),
            'inbound_tch_profit': str(v['inbound_tch_profit']),
            'outbound_count': v['outbound_count'],
            'outbound_amount': str(v['outbound_amount']),
            'outbound_creator_fee': str(v['outbound_creator_fee']),
            'outbound_tch_profit': str(v['outbound_tch_profit']),
            'top_brands': [b for b, _ in brand_counts[:5]],
            'repeat_brands': [f"{b} ({c})" for b, c in brand_counts if c > 1],
            'common_deliverable': deliverable_counts[0][0] if deliverable_counts else '',
        })

    q_rank = {'Q1': 0, 'Q2': 1, 'Q3': 2, 'Q4': 3}
    results.sort(key=lambda r: (r['creator_name'], q_rank.get(r['quarter'], 9)))
    return results
