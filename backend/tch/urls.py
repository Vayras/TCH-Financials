from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CreatorViewSet, ContractingComplianceViewSet,
    CommercialDealViewSet, EmployeeWeeklyReportViewSet, DropOffViewSet,
    CreatorDocumentViewSet,
    overview_view, quarterly_exclusives_view, entity_summary_view,
    creator_insights_view, alerts_view,
)

router = DefaultRouter()
router.register(r'creators', CreatorViewSet)
router.register(r'contracting', ContractingComplianceViewSet)
router.register(r'deals', CommercialDealViewSet)
router.register(r'employee-reports', EmployeeWeeklyReportViewSet)
router.register(r'dropoffs', DropOffViewSet)
router.register(r'creator-documents', CreatorDocumentViewSet)

urlpatterns = [
    path('overview/', overview_view),
    path('exclusives/quarterly/', quarterly_exclusives_view),
    path('entity-summary/', entity_summary_view),
    path('creator-insights/', creator_insights_view),
    path('alerts/', alerts_view),
    path('', include(router.urls)),
]
