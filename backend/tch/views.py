from datetime import date

from rest_framework import viewsets, filters
from rest_framework.decorators import api_view
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response

from .models import (
    Creator, ContractingCompliance, CommercialDeal, EmployeeWeeklyReport,
    DropOff, CreatorDocument,
)
from .serializers import (
    CreatorSerializer, ContractingComplianceSerializer,
    CommercialDealSerializer, EmployeeWeeklyReportSerializer, DropOffSerializer,
    CreatorDocumentSerializer,
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


class CommercialDealViewSet(viewsets.ModelViewSet):
    queryset = (
        CommercialDeal.objects
        .select_related('creator')
        .prefetch_related('creator_shares__creator')
        .all()
    )
    serializer_class = CommercialDealSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['creator__name', 'creator_name_raw', 'brand', 'campaign', 'ro_number']


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
    return Response(entity_summary(fy_start, entity_filter))


@api_view(['GET'])
def creator_insights_view(request):
    fy = request.GET.get('fy')
    fy_start = int(fy) if fy else fiscal_year_of(date.today())
    return Response(creator_insights(fy_start))


@api_view(['GET'])
def alerts_view(request):
    return Response(alerts())
