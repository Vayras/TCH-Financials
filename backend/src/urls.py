from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CampaignViewSet, CreatorViewSet, ContractingComplianceViewSet,
    CommercialDealViewSet, EmployeeWeeklyReportViewSet, DropOffViewSet,
    CreatorDocumentViewSet, SocialMediaSnapshotViewSet, EventInviteViewSet,
    overview_view, quarterly_exclusives_view, entity_summary_view,
    creator_insights_view, alerts_view, alerts_dismiss_view, alerts_restore_view,
)

router = DefaultRouter()
router.register(r'campaigns', CampaignViewSet)
router.register(r'creators', CreatorViewSet)
router.register(r'contracting', ContractingComplianceViewSet)
router.register(r'deals', CommercialDealViewSet)
router.register(r'employee-reports', EmployeeWeeklyReportViewSet)
router.register(r'dropoffs', DropOffViewSet)
router.register(r'creator-documents', CreatorDocumentViewSet)
router.register(r'social-snapshots', SocialMediaSnapshotViewSet)
router.register(r'event-invites', EventInviteViewSet)

urlpatterns = [
    path('overview/', overview_view),
    path('exclusives/quarterly/', quarterly_exclusives_view),
    path('entity-summary/', entity_summary_view),
    path('creator-insights/', creator_insights_view),
    path('alerts/', alerts_view),
    path('alerts/dismiss/', alerts_dismiss_view),
    path('alerts/restore/', alerts_restore_view),
    path('', include(router.urls)),
]
