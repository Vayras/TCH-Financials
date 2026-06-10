from datetime import date

from django.db.models import Count
from rest_framework import viewsets, filters
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
from .aggregation import overview, quarterly_exclusives, entity_summary, creator_insights, fiscal_year_of, alerts


class CreatorViewSet(viewsets.ModelViewSet):
    queryset = Creator.objects.all()
    serializer_class = CreatorSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'category']


class ContractingComplianceViewSet(viewsets.ModelViewSet):
    queryset = ContractingCompliance.objects.select_related('creator').all()
    serializer_class = ContractingComplianceSerializer


class CampaignViewSet(viewsets.ModelViewSet):
    queryset = Campaign.objects.annotate(deal_count=Count('deals')).all()
    serializer_class = CampaignSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'brand']


class CommercialDealViewSet(viewsets.ModelViewSet):
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


class EmployeeWeeklyReportViewSet(viewsets.ModelViewSet):
    queryset = EmployeeWeeklyReport.objects.all()
    serializer_class = EmployeeWeeklyReportSerializer


class DropOffViewSet(viewsets.ModelViewSet):
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


class SocialMediaSnapshotViewSet(viewsets.ModelViewSet):
    queryset = SocialMediaSnapshot.objects.select_related('creator').all()
    serializer_class = SocialMediaSnapshotSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        creator = self.request.query_params.get('creator')
        if creator:
            qs = qs.filter(creator_id=creator)
        return qs


class EventInviteViewSet(viewsets.ModelViewSet):
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
