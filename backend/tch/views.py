from datetime import date

from django.db import transaction
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import (
    AlertDismissal, Campaign, Creator, ContractingCompliance, CommercialDeal,
    EmployeeWeeklyReport, DropOff, CreatorDocument, SocialMediaSnapshot, EventInvite,
)
from .serializers import (
    CampaignSerializer, CreatorSerializer, ContractingComplianceSerializer,
    CommercialDealSerializer, EmployeeWeeklyReportSerializer, DropOffSerializer,
    CreatorDocumentSerializer, SocialMediaSnapshotSerializer, EventInviteSerializer,
)
from .aggregation import (
    overview, quarterly_exclusives, entity_summary, creator_insights,
    fiscal_year_of, alerts, billing_period,
)


class OptimisticLockMixin:
    """Optimistic locking for versioned models.

    Clients echo back the `version` they loaded; if another save happened in
    between, the row's version no longer matches and we answer 409 Conflict
    (including the current server state) instead of overwriting that edit.
    The row is locked (SELECT ... FOR UPDATE) for the duration of the check +
    save so two simultaneous submits serialize and the loser reliably sees
    the conflict.
    """

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        client_version = request.data.get('version')
        if client_version is None:
            return Response(
                {'detail': 'version is required when updating this record.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            client_version = int(client_version)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'version must be an integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            instance = self._get_locked_object()
            if instance.version != client_version:
                return Response(
                    {
                        'detail': (
                            'Someone else updated this record while you were '
                            'editing. Your change was NOT saved — reload to '
                            'see the latest values, then re-apply your edit.'
                        ),
                        'code': 'version_conflict',
                        'current': self.get_serializer(instance).data,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            serializer.save(version=instance.version + 1)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    def _get_locked_object(self):
        # of=('self',) keeps the FOR UPDATE off select_related outer joins,
        # which Postgres rejects on the nullable side.
        queryset = self.filter_queryset(self.get_queryset()).select_for_update(of=('self',))
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        obj = get_object_or_404(queryset, **{self.lookup_field: self.kwargs[lookup_url_kwarg]})
        self.check_object_permissions(self.request, obj)
        return obj


class CreatorViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = Creator.objects.all()
    serializer_class = CreatorSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'category']


class ContractingComplianceViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = ContractingCompliance.objects.select_related('creator').all()
    serializer_class = ContractingComplianceSerializer


class CampaignViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = Campaign.objects.annotate(deal_count=Count('deals')).all()
    serializer_class = CampaignSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'brand']


class CommercialDealViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = (
        CommercialDeal.objects
        .select_related('creator', 'campaign')
        .prefetch_related('creator_shares__creator')
        .all()
    )
    serializer_class = CommercialDealSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['creator__name', 'creator_name_raw', 'brand', 'campaign__name', 'ro_number']

    def get_queryset(self):
        qs = super().get_queryset()
        campaign = self.request.query_params.get('campaign')
        if campaign:
            qs = qs.filter(campaign_id=campaign)
        return qs

    def list(self, request, *args, **kwargs):
        """List deals, optionally scoped to one fiscal year (?fy=2025).

        A deal belongs to the FY when either lens places it there: its
        billing period (E-Invoice No token with e_invoice_date fallback —
        the Overview's rule) or its confirmation date. The union is what the
        Campaign page needs to show invoiced vs confirmed billing side by
        side and to support both tracking lenses from one payload. The
        billing period lives inside a free-text field, so the filter runs in
        Python; it still cuts the serialized payload to the year actually
        shown. Deals with no date on either lens are always included: the UI
        surfaces them for backfill instead of hiding them.
        """
        fy = request.query_params.get('fy')
        try:
            fy_start = int(fy) if fy else None
        except ValueError:
            fy_start = None
        queryset = self.filter_queryset(self.get_queryset())
        if fy_start is not None:
            def in_fy(d):
                period = billing_period(d)
                confirmed = d.confirmation_date
                if period is None and confirmed is None:
                    return True
                return (
                    (period is not None and fiscal_year_of(period) == fy_start)
                    or (confirmed is not None and fiscal_year_of(confirmed) == fy_start)
                )
            rows = [d for d in queryset if in_fy(d)]
        else:
            rows = queryset
        serializer = self.get_serializer(rows, many=True)
        return Response(serializer.data)


class EmployeeWeeklyReportViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = EmployeeWeeklyReport.objects.all()
    serializer_class = EmployeeWeeklyReportSerializer


class DropOffViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = DropOff.objects.select_related('creator').all()
    serializer_class = DropOffSerializer


class CreatorDocumentViewSet(viewsets.ModelViewSet):
    queryset = CreatorDocument.objects.select_related('creator').all()
    serializer_class = CreatorDocumentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        qs = super().get_queryset()
        creator = self.request.query_params.get('creator')
        if creator:
            qs = qs.filter(creator_id=creator)
        return qs


class SocialMediaSnapshotViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = SocialMediaSnapshot.objects.select_related('creator').all()
    serializer_class = SocialMediaSnapshotSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        creator = self.request.query_params.get('creator')
        if creator:
            qs = qs.filter(creator_id=creator)
        return qs


class EventInviteViewSet(OptimisticLockMixin, viewsets.ModelViewSet):
    queryset = EventInvite.objects.select_related('creator').all()
    serializer_class = EventInviteSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        creator = self.request.query_params.get('creator')
        if creator:
            qs = qs.filter(creator_id=creator)
        return qs


@api_view(['GET'])
def overview_view(request):
    fy = request.GET.get('fy')
    fy_start = int(fy) if fy else fiscal_year_of(date.today())
    return Response(overview(fy_start))


@api_view(['GET'])
def quarterly_exclusives_view(request):
    fy = request.GET.get('fy')
    fy_start = int(fy) if fy else fiscal_year_of(date.today())
    return Response({'fy_start': fy_start, 'rows': quarterly_exclusives(fy_start)})


@api_view(['GET'])
def entity_summary_view(request):
    fy = request.GET.get('fy')
    fy_start = int(fy) if fy else fiscal_year_of(date.today())
    entity_filter = request.GET.get('entity', '')
    quarter = request.GET.get('quarter', '')
    month = request.GET.get('month', '')
    return Response(entity_summary(fy_start, entity_filter, quarter, month))


@api_view(['GET'])
def creator_insights_view(request):
    fy = request.GET.get('fy')
    fy_start = int(fy) if fy else fiscal_year_of(date.today())
    return Response(creator_insights(fy_start))


@api_view(['GET'])
def alerts_view(request):
    return Response(alerts())


@api_view(['POST'])
def alerts_dismiss_view(request):
    """Dismiss ('clear') alerts by their stable keys: {"keys": [...]}."""
    keys = request.data.get('keys')
    if not isinstance(keys, list) or not all(isinstance(k, str) and k for k in keys):
        return Response({'detail': 'keys must be a non-empty list of strings'}, status=400)
    AlertDismissal.objects.bulk_create(
        [AlertDismissal(key=k) for k in set(keys)], ignore_conflicts=True
    )
    return Response({'dismissed': len(set(keys))})


@api_view(['POST'])
def alerts_restore_view(request):
    """Bring back every dismissed alert."""
    deleted, _ = AlertDismissal.objects.all().delete()
    return Response({'restored': deleted})
