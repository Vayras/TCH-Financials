"""Aggregation logic that derives Current Overview and Quarterly Exclusives
from the CommercialDeal table — the single source of truth."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable

from .models import CommercialDeal, Creator, ContractingCompliance, CreatorDocument


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


_MONTH_NUM = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
}
# e.g. "TCH/2526/Dec01" -> fy token "2526", month token "Dec"
_INVOICE_RE = re.compile(r'(\d{2})(\d{2})\s*/\s*([A-Za-z]{3,9})')


def invoice_period(e_invoice_number: str | None) -> date | None:
    """Derive the billing month from an E-Invoice No like 'TCH/2526/Dec01'.

    This — not confirmation_date — decides which fiscal year and month a deal
    belongs to. The FY token '2526' means FY 2025-26 (fy_start = 2025); the
    month abbreviation maps Apr-Dec to the fy_start calendar year and Jan-Mar
    to fy_start + 1. Returns the first day of that month (e.g. date(2025, 12, 1)),
    or None when the number is blank or unparseable (deal not yet invoiced).
    """
    if not e_invoice_number:
        return None
    s = ' '.join(str(e_invoice_number).split())  # collapse newlines / stray spaces
    m = _INVOICE_RE.search(s)
    if not m:
        return None
    fy_start = 2000 + int(m.group(1))
    month = _MONTH_NUM.get(m.group(3)[:3].lower())
    if not month:
        return None
    year = fy_start if month >= 4 else fy_start + 1
    return date(year, month, 1)


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

    # FY membership is decided by the E-Invoice No (invoice_period), not
    # confirmation_date — fetch all and bucket in Python. Deals without a
    # parseable invoice number are gathered into a separate "Not yet invoiced"
    # summary (they belong to no FY until invoiced).
    deals = CommercialDeal.objects.select_related('creator').all()

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
    not_invoiced = {'count': 0, 'total_fee': Decimal('0'), 'profit': Decimal('0')}

    for deal in deals:
        fee = deal.total_fee or Decimal('0')
        profit = deal.agency_fee_inr or Decimal('0')

        period = invoice_period(deal.e_invoice_number)
        if period is None:
            # No E-Invoice No yet — belongs to no FY; track separately.
            not_invoiced['count'] += 1
            not_invoiced['total_fee'] += fee
            not_invoiced['profit'] += profit
            continue
        if not (start <= period < end):
            continue

        bucket = _bucket_for(deal)
        mk = month_key(period)
        qk = quarter_key(period)

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
        # FY-independent: deals with no E-Invoice No yet (awaiting invoicing).
        'not_invoiced': {
            'count': not_invoiced['count'],
            'total_fee': str(not_invoiced['total_fee']),
            'profit': str(not_invoiced['profit']),
        },
    }


def entity_summary(fy_start: int, entity_filter: str = '') -> dict:
    """Summarise billing grouped by billing_entity for a fiscal year.
    If entity_filter is given, restrict to rows whose billing_entity contains that string."""
    start = date(fy_start, 4, 1)
    end = date(fy_start + 1, 4, 1)

    # FY membership comes from the E-Invoice No (see invoice_period).
    deals = CommercialDeal.objects.select_related('creator').all()
    ef = entity_filter.lower()

    from collections import Counter

    entities: dict[str, dict] = {}
    for deal in deals:
        period = invoice_period(deal.e_invoice_number)
        if period is None or not (start <= period < end):
            continue
        if ef and ef not in (deal.billing_entity or '').lower():
            continue
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


def creator_insights(fy_start: int) -> dict:
    """Per-creator campaign insights for a fiscal year, across all relationships.

    Returns a list of creator rows, each with lifetime-in-FY metrics:
      - deal counts (total / inbound / outbound / markup)
      - billing / profit / creator-fee totals
      - avg deal size, profit margin
      - first / last confirmation date, months active
      - top brands (with frequency), repeat brands, brand_count
      - common deliverable, deliverable count
      - monthly billing timeline
    """
    from collections import Counter

    start = date(fy_start, 4, 1)
    end = date(fy_start + 1, 4, 1)

    # FY membership comes from the E-Invoice No (see invoice_period).
    deals = CommercialDeal.objects.select_related('creator').all()

    months_meta = []
    for m in MONTHS_FY_ORDER:
        y = fy_start if m >= 4 else fy_start + 1
        months_meta.append({'key': f"{y:04d}-{m:02d}", 'label': MONTH_NAME[m]})

    # key by creator_id when present, else by creator_name_raw fallback
    agg: dict[tuple, dict] = {}
    for d in deals:
        period = invoice_period(d.e_invoice_number)
        if period is None or not (start <= period < end):
            continue
        if d.creator_id:
            key = ('id', d.creator_id)
            name = d.creator.name
            relationship = d.creator.relationship or 'Friend'
            category = d.creator.category or ''
            ops_manager = d.creator.ops_manager or ''
        else:
            raw = (d.creator_name_raw or '').strip() or '(Unnamed)'
            key = ('raw', raw)
            name = raw
            relationship = 'NonTCH'
            category = ''
            ops_manager = ''

        a = agg.setdefault(key, {
            'creator_id': d.creator_id,
            'creator_name': name,
            'relationship': relationship,
            'category': category,
            'ops_manager': ops_manager,
            'total_count': 0,
            'inbound_count': 0,
            'outbound_count': 0,
            'markup_count': 0,
            'total_billing': Decimal('0'),
            'total_profit': Decimal('0'),
            'total_creator_fee': Decimal('0'),
            'first_date': None,
            'last_date': None,
            'brands': [],
            'deliverables': [],
            'campaigns': [],
            'billing_entities': [],
            'by_month': defaultdict(_zero),
            'paid_count': 0,
            'over_count': 0,
        })

        fee = d.total_fee or Decimal('0')
        profit = d.agency_fee_inr or Decimal('0')
        cfee = d.creator_fee or Decimal('0')

        a['total_count'] += 1
        a['total_billing'] += fee
        a['total_profit'] += profit
        a['total_creator_fee'] += cfee

        if d.direction == 'Inbound':
            a['inbound_count'] += 1
        elif d.direction == 'Outbound':
            a['outbound_count'] += 1
        else:
            a['markup_count'] += 1

        # first/last date track when deals were confirmed (relationship
        # activity); the monthly billing timeline follows the invoice month.
        if d.confirmation_date:
            if a['first_date'] is None or d.confirmation_date < a['first_date']:
                a['first_date'] = d.confirmation_date
            if a['last_date'] is None or d.confirmation_date > a['last_date']:
                a['last_date'] = d.confirmation_date
        mk = f"{period.year:04d}-{period.month:02d}"
        a['by_month'][mk] += fee

        if d.brand:
            a['brands'].append(d.brand)
        if d.deliverables:
            a['deliverables'].append(d.deliverables)
        if d.campaign:
            a['campaigns'].append(d.campaign)
        if d.billing_entity:
            a['billing_entities'].append(d.billing_entity)
        if d.payment_received == 'Y':
            a['paid_count'] += 1
        if d.campaign_over == 'Y':
            a['over_count'] += 1

    results = []
    for v in agg.values():
        brand_counts = Counter(v['brands']).most_common()
        deliverable_counts = Counter(v['deliverables']).most_common()
        entity_counts = Counter(v['billing_entities']).most_common()

        billing = v['total_billing']
        avg_deal = (billing / v['total_count']) if v['total_count'] else Decimal('0')
        margin = (v['total_profit'] / billing) if billing else Decimal('0')

        months_active = len([k for k, val in v['by_month'].items() if val > 0])

        results.append({
            'creator_id': v['creator_id'],
            'creator_name': v['creator_name'],
            'relationship': v['relationship'],
            'category': v['category'],
            'ops_manager': v['ops_manager'],
            'total_count': v['total_count'],
            'inbound_count': v['inbound_count'],
            'outbound_count': v['outbound_count'],
            'markup_count': v['markup_count'],
            'total_billing': str(billing),
            'total_profit': str(v['total_profit']),
            'total_creator_fee': str(v['total_creator_fee']),
            'avg_deal_size': str(avg_deal.quantize(Decimal('0.01'))),
            'profit_margin': f"{float(margin):.4f}",
            'first_date': v['first_date'].isoformat() if v['first_date'] else None,
            'last_date': v['last_date'].isoformat() if v['last_date'] else None,
            'months_active': months_active,
            'brand_count': len({b for b in v['brands']}),
            'top_brands': [b for b, _ in brand_counts[:5]],
            'repeat_brands': [f"{b} ({c})" for b, c in brand_counts if c > 1],
            'common_deliverable': deliverable_counts[0][0] if deliverable_counts else '',
            'top_billing_entity': entity_counts[0][0] if entity_counts else '',
            'paid_count': v['paid_count'],
            'over_count': v['over_count'],
            'by_month': {k: str(val) for k, val in v['by_month'].items()},
        })

    results.sort(key=lambda r: Decimal(r['total_billing']), reverse=True)

    grand_billing = sum(Decimal(r['total_billing']) for r in results)
    grand_profit = sum(Decimal(r['total_profit']) for r in results)
    grand_deals = sum(r['total_count'] for r in results)

    return {
        'fy': fy_label(fy_start),
        'fy_start': fy_start,
        'months': months_meta,
        'creators': results,
        'grand_total_billing': str(grand_billing),
        'grand_total_profit': str(grand_profit),
        'grand_total_deals': grand_deals,
        'creator_count': len(results),
    }


def quarterly_exclusives(fy_start: int) -> list[dict]:
    """Derive the 26-27 Exclusives sheet: per exclusive creator, per quarter,
    inbound/outbound deal counts, invoiced amount, creator fee, top brands, etc."""
    start = date(fy_start, 4, 1)
    end = date(fy_start + 1, 4, 1)

    # Relationship is a non-date filter (stays in SQL); FY membership and the
    # quarter come from the E-Invoice No (see invoice_period).
    deals = (
        CommercialDeal.objects
        .select_related('creator')
        .filter(creator__relationship='Exclusive')
    )

    # key: (creator_id, creator_name, quarter) -> agg
    agg: dict[tuple, dict] = {}
    for d in deals:
        period = invoice_period(d.e_invoice_number)
        if period is None or not (start <= period < end):
            continue
        qk = ''
        for qn, months in QUARTERS:
            if period.month in months:
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


# ---------------------------------------------------------------------------
# Alerts — formula-derived signals from the same source-of-truth tables.
# Each alert has: severity, title, detail, action_hint, age_days (optional).
# ---------------------------------------------------------------------------

# Thresholds (calendar days)
INACTIVE_CREATOR_DAYS = 45        # Exclusive/Friend with no deal in this many days
INVOICE_OVERDUE_DAYS = 30         # campaign_over='Y' but invoice_received != 'Y'
PAYMENT_OVERDUE_DAYS = 30         # invoice_received='Y' but payment_received != 'Y'
BRAND_DORMANT_DAYS = 90           # brand had deals, none in this window
BRAND_HOT_WINDOW_DAYS = 60        # 3+ deals to same brand within this window
RENEWAL_DUE_DAYS = 30             # contracting.renewal_date within this window
QOQ_DROP_PCT = Decimal('0.20')    # 20% drop quarter-over-quarter

# Hard-coded seasonal calendar (recurring Indian retail / cultural moments).
# (month, day, label). Years are computed relative to "today".
SEASONAL_MOMENTS = [
    (1, 26, 'Republic Day'),
    (3, 14, 'Holi'),
    (3, 31, 'FY End'),
    (8, 15, 'Independence Day'),
    (10, 2, 'Gandhi Jayanti'),
    (11, 1, 'Diwali (approx)'),
    (12, 25, 'Christmas'),
    (12, 31, 'Year End'),
]


def _days_between(a: date, b: date) -> int:
    return (b - a).days


def _next_occurrence(today: date, month: int, day: int) -> date:
    """Return the next future occurrence of month/day on/after today."""
    try:
        candidate = date(today.year, month, day)
    except ValueError:
        candidate = date(today.year, month, 28)
    if candidate < today:
        try:
            candidate = date(today.year + 1, month, day)
        except ValueError:
            candidate = date(today.year + 1, month, 28)
    return candidate


def alerts(today: date | None = None) -> dict:
    """Compute the four alert boards rendered on the Alerts page.

    Sections (each is a list, sorted by severity then age):
      - urgent           Inactive creators, overdue invoices/payments, renewals due
      - bd               Dormant brands, hot brands (recurring last 60d)
      - health           QoQ billing/margin drops per exclusive creator
      - seasonal         Days until the next of each calendar moment

    Each item shape:
      {
        kind, severity ('high'|'med'|'low'),
        title, detail, action,
        meta: {...} (optional pointers: creator_id, brand, deal_id, weeks_away)
      }
    """
    today = today or date.today()

    deals_qs = (
        CommercialDeal.objects
        .select_related('creator')
        .all()
    )
    # Cache as list — we iterate multiple times.
    deals = list(deals_qs)

    # ---- Urgent ----
    urgent: list[dict] = []

    # (a) Inactive Exclusive/Friend creators
    last_deal_by_creator: dict[int, date] = {}
    for d in deals:
        if not d.creator_id or not d.confirmation_date:
            continue
        prev = last_deal_by_creator.get(d.creator_id)
        if prev is None or d.confirmation_date > prev:
            last_deal_by_creator[d.creator_id] = d.confirmation_date

    active_creators = Creator.objects.filter(relationship__in=['Exclusive', 'Friend'])
    for c in active_creators:
        last = last_deal_by_creator.get(c.id)
        if last is None:
            # No deal ever — only flag if creator joined more than threshold ago
            anchor = c.doj or (c.created_at.date() if c.created_at else None)
            if anchor and _days_between(anchor, today) >= INACTIVE_CREATOR_DAYS:
                age = _days_between(anchor, today)
                urgent.append({
                    'kind': 'inactive_creator',
                    'severity': 'high' if c.relationship == 'Exclusive' else 'med',
                    'title': f"{c.name} — No deal yet ({age} days since onboarding)",
                    'detail': f"{c.relationship}. No commercial deal recorded since onboarding.",
                    'action': 'Open creator pipeline',
                    'meta': {'creator_id': c.id, 'age_days': age, 'relationship': c.relationship},
                })
            continue
        age = _days_between(last, today)
        if age >= INACTIVE_CREATOR_DAYS:
            urgent.append({
                'kind': 'inactive_creator',
                'severity': 'high' if c.relationship == 'Exclusive' else 'med',
                'title': f"{c.name} — No deal in {age} days",
                'detail': f"{c.relationship}. Last deal confirmed {last.isoformat()}.",
                'action': 'Schedule check-in',
                'meta': {'creator_id': c.id, 'age_days': age, 'relationship': c.relationship},
            })

    # (b) Invoice overdue — campaign over but invoice not yet received
    for d in deals:
        if d.campaign_over == 'Y' and d.invoice_received != 'Y' and d.confirmation_date:
            age = _days_between(d.confirmation_date, today)
            if age >= INVOICE_OVERDUE_DAYS:
                who = d.creator.name if d.creator_id else (d.creator_name_raw or '(no creator)')
                brand = d.brand or '(no brand)'
                urgent.append({
                    'kind': 'invoice_overdue',
                    'severity': 'high' if age >= 60 else 'med',
                    'title': f"{brand} × {who} — Invoice not raised, {age} days",
                    'detail': f"Campaign marked over. Total fee ₹ {d.total_fee}. Billing entity: {d.billing_entity or '—'}.",
                    'action': 'Raise invoice',
                    'meta': {'deal_id': d.id, 'age_days': age, 'brand': d.brand},
                })

    # (c) Payment overdue — invoice raised but payment not received
    for d in deals:
        if d.invoice_received == 'Y' and d.payment_received != 'Y':
            anchor = d.e_invoice_date or d.confirmation_date
            if not anchor:
                continue
            age = _days_between(anchor, today)
            if age >= PAYMENT_OVERDUE_DAYS:
                who = d.creator.name if d.creator_id else (d.creator_name_raw or '(no creator)')
                brand = d.brand or '(no brand)'
                urgent.append({
                    'kind': 'payment_overdue',
                    'severity': 'high' if age >= 60 else 'med',
                    'title': f"{brand} invoice overdue — {age} days",
                    'detail': f"{who}. ₹ {d.total_fee} via {d.billing_entity or '—'}. Invoice dated {anchor.isoformat()}.",
                    'action': 'Escalate to finance',
                    'meta': {'deal_id': d.id, 'age_days': age, 'brand': d.brand},
                })

    # (d) Contract renewal due
    cutoff = today + timedelta(days=RENEWAL_DUE_DAYS)
    contracts = (
        ContractingCompliance.objects
        .select_related('creator')
        .filter(renewal_date__isnull=False, renewal_date__lte=cutoff)
    )
    for cc in contracts:
        days_to = _days_between(today, cc.renewal_date)
        urgent.append({
            'kind': 'renewal_due',
            'severity': 'high' if days_to <= 14 else 'med',
            'title': f"{cc.creator.name} — Renewal {'overdue' if days_to < 0 else f'in {days_to} days'}",
            'detail': f"Renewal date {cc.renewal_date.isoformat()}. {cc.renewal_note or ''}".strip(),
            'action': 'Draft renewal',
            'meta': {'creator_id': cc.creator_id, 'days_to': days_to},
        })

    # ---- BD Opportunities ----
    bd: list[dict] = []
    # Per-brand: list of (date, deal) for date-bearing rows
    brand_dates: dict[str, list[date]] = defaultdict(list)
    brand_creators: dict[str, set[str]] = defaultdict(set)
    brand_billing: dict[str, Decimal] = defaultdict(lambda: Decimal('0'))
    for d in deals:
        if not d.brand or not d.confirmation_date:
            continue
        brand_dates[d.brand].append(d.confirmation_date)
        name = d.creator.name if d.creator_id else d.creator_name_raw
        if name:
            brand_creators[d.brand].add(name)
        brand_billing[d.brand] += d.total_fee or Decimal('0')

    for brand, dates in brand_dates.items():
        last = max(dates)
        age = _days_between(last, today)
        # Dormant: had at least one deal historically, none in last 90d
        if age >= BRAND_DORMANT_DAYS:
            months = round(age / 30)
            bd.append({
                'kind': 'brand_dormant',
                'severity': 'med',
                'title': f"{brand} — Dormant for {months} months",
                'detail': f"Last deal {last.isoformat()}. Lifetime billing ₹ {brand_billing[brand]}. {len(brand_creators[brand])} creator(s) worked with this brand.",
                'action': 'Craft re-engagement pitch',
                'meta': {'brand': brand, 'age_days': age},
            })
        # Hot: 3+ deals in trailing 60d
        recent = [d for d in dates if _days_between(d, today) <= BRAND_HOT_WINDOW_DAYS]
        if len(recent) >= 3:
            bd.append({
                'kind': 'brand_hot',
                'severity': 'low',
                'title': f"{brand} — {len(recent)} active collabs in last {BRAND_HOT_WINDOW_DAYS}d",
                'detail': f"Creators on this brand: {', '.join(sorted(brand_creators[brand])[:5])}.",
                'action': 'Pitch more creators',
                'meta': {'brand': brand, 'recent_count': len(recent)},
            })

    # ---- Creator Health: QoQ billing / margin drop ----
    health: list[dict] = []
    # Determine current and previous FY-quarter relative to today.
    fy_now = fiscal_year_of(today)
    cur_q_idx = None
    for i, (_, months_in_q) in enumerate(QUARTERS):
        if today.month in months_in_q:
            cur_q_idx = i
            break
    if cur_q_idx is None:
        cur_q_idx = 0
    # Build (creator_id, q_key) -> (billing, profit, count)
    q_agg: dict[tuple[int, str, int], dict] = {}

    def q_for(d: date) -> tuple[str, int]:
        # Returns (quarter_key, fy_start_year)
        fy = fiscal_year_of(d)
        for qk, months_in_q in QUARTERS:
            if d.month in months_in_q:
                return (qk, fy)
        return ('Q1', fy)

    for d in deals:
        if not d.creator_id or not d.confirmation_date:
            continue
        if d.creator.relationship != 'Exclusive':
            continue
        qk, fy = q_for(d.confirmation_date)
        key = (d.creator_id, qk, fy)
        a = q_agg.setdefault(key, {
            'billing': Decimal('0'),
            'profit': Decimal('0'),
            'count': 0,
            'name': d.creator.name,
        })
        a['billing'] += d.total_fee or Decimal('0')
        a['profit'] += d.agency_fee_inr or Decimal('0')
        a['count'] += 1

    cur_qk = QUARTERS[cur_q_idx][0]
    if cur_q_idx == 0:
        prev_qk, prev_fy = QUARTERS[3][0], fy_now - 1
    else:
        prev_qk, prev_fy = QUARTERS[cur_q_idx - 1][0], fy_now

    # Re-key for compare
    cur_by_creator = {k[0]: v for k, v in q_agg.items() if k[1] == cur_qk and k[2] == fy_now}
    prev_by_creator = {k[0]: v for k, v in q_agg.items() if k[1] == prev_qk and k[2] == prev_fy}

    for cid, prev in prev_by_creator.items():
        cur = cur_by_creator.get(cid)
        prev_bill = prev['billing']
        cur_bill = cur['billing'] if cur else Decimal('0')
        if prev_bill <= 0:
            continue
        drop = (prev_bill - cur_bill) / prev_bill
        if drop >= QOQ_DROP_PCT:
            drop_pct = int(drop * 100)
            health.append({
                'kind': 'billing_drop',
                'severity': 'high' if drop_pct >= 50 else 'med',
                'title': f"{prev['name']} — Billing dropped {drop_pct}% QoQ",
                'detail': f"{prev_qk}: ₹ {prev_bill}. {cur_qk}: ₹ {cur_bill}.",
                'action': 'Review pipeline',
                'meta': {'creator_id': cid, 'drop_pct': drop_pct},
            })

    # ---- Documents missing ----
    # Active creators (Exclusive / Friend) with no document on file yet.
    docs: list[dict] = []
    creators_with_docs = set(
        CreatorDocument.objects.values_list('creator_id', flat=True)
    )
    for c in Creator.objects.filter(relationship__in=['Exclusive', 'Friend']):
        if c.id in creators_with_docs:
            continue
        docs.append({
            'kind': 'missing_documents',
            'severity': 'high' if c.relationship == 'Exclusive' else 'med',
            'title': f"{c.name} — No documents on file",
            'detail': f"{c.relationship}. No agreement / KYC document uploaded yet.",
            'action': 'Upload documents',
            'meta': {'creator_id': c.id, 'relationship': c.relationship},
        })

    # ---- Seasonal moments ----
    seasonal: list[dict] = []
    for m, d_day, label in SEASONAL_MOMENTS:
        nxt = _next_occurrence(today, m, d_day)
        days = _days_between(today, nxt)
        weeks = round(days / 7)
        seasonal.append({
            'kind': 'seasonal',
            'severity': 'low',
            'title': f"{label} — {weeks} week{'s' if weeks != 1 else ''} away" if weeks > 0 else f"{label} — today",
            'detail': f"{nxt.isoformat()} ({days} days).",
            'action': 'Plan campaign',
            'meta': {'date': nxt.isoformat(), 'days_away': days, 'weeks_away': weeks},
        })
    seasonal.sort(key=lambda x: x['meta']['days_away'])

    # Sort the data-driven boards by severity then age.
    sev_rank = {'high': 0, 'med': 1, 'low': 2}
    def sort_key(it: dict) -> tuple:
        return (sev_rank.get(it['severity'], 9), -(it.get('meta', {}).get('age_days') or 0))

    urgent.sort(key=sort_key)
    bd.sort(key=sort_key)
    health.sort(key=sort_key)
    docs.sort(key=lambda it: (sev_rank.get(it['severity'], 9), it['title']))

    return {
        'generated_at': today.isoformat(),
        'thresholds': {
            'inactive_creator_days': INACTIVE_CREATOR_DAYS,
            'invoice_overdue_days': INVOICE_OVERDUE_DAYS,
            'payment_overdue_days': PAYMENT_OVERDUE_DAYS,
            'brand_dormant_days': BRAND_DORMANT_DAYS,
            'brand_hot_window_days': BRAND_HOT_WINDOW_DAYS,
            'renewal_due_days': RENEWAL_DUE_DAYS,
            'qoq_drop_pct': float(QOQ_DROP_PCT),
        },
        'urgent': urgent,
        'bd': bd,
        'health': health,
        'docs': docs,
        'seasonal': seasonal,
        'counts': {
            'urgent': len(urgent),
            'bd': len(bd),
            'health': len(health),
            'docs': len(docs),
            'seasonal': len(seasonal),
        },
    }
