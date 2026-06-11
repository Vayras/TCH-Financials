from decimal import Decimal, InvalidOperation

from rest_framework import serializers
from .models import (
    Campaign, Creator, ContractingCompliance, CommercialDeal, EmployeeWeeklyReport,
    DropOff, CreatorDocument, DealCreatorShare, SocialMediaSnapshot, EventInvite,
)


def normalise_agency_pct(value):
    """Accept both fractional (0.15) and human percent (15) inputs."""
    try:
        pct = Decimal(str(value or '0'))
    except (InvalidOperation, ValueError):
        return value
    return pct / Decimal('100') if pct > 1 else pct


class CreatorDocumentSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.name', read_only=True)

    class Meta:
        model = CreatorDocument
        fields = ['id', 'creator', 'creator_name', 'doc_type', 'label', 'file', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class CreatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Creator
        fields = '__all__'
        # version is echoed back by clients for the optimistic-lock check and
        # bumped server-side; it is never written from the payload directly.
        read_only_fields = ['version']


class CampaignSerializer(serializers.ModelSerializer):
    deal_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            'id', 'name', 'brand', 'status', 'start_date', 'end_date',
            'notes', 'deal_count', 'created_at', 'version',
        ]
        read_only_fields = ['created_at', 'version']

    def get_deal_count(self, obj):
        # Set by the viewset's Count annotation; fall back for fresh instances.
        count = getattr(obj, 'deal_count', None)
        return count if count is not None else obj.deals.count()


class ContractingComplianceSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.name', read_only=True)

    class Meta:
        model = ContractingCompliance
        fields = '__all__'
        read_only_fields = ['version']


class DealCreatorShareSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()
    creator_relationship = serializers.SerializerMethodField()

    class Meta:
        model = DealCreatorShare
        fields = [
            'id', 'creator', 'creator_name', 'creator_relationship', 'creator_name_raw',
            'total_fee', 'agency_fee_pct', 'agency_fee_inr', 'creator_fee',
        ]
        extra_kwargs = {
            'agency_fee_inr': {'required': False},
            'creator_fee': {'required': False},
            'agency_fee_pct': {'required': False},
        }

    def get_creator_name(self, obj):
        return obj.effective_creator_name

    def get_creator_relationship(self, obj):
        return obj.creator.relationship if obj.creator_id else 'NonTCH'

    def validate(self, attrs):
        if not attrs.get('creator'):
            raise serializers.ValidationError({'creator': 'Pick a creator from the master list.'})
        attrs['creator_name_raw'] = ''
        if 'agency_fee_pct' in attrs:
            attrs['agency_fee_pct'] = normalise_agency_pct(attrs['agency_fee_pct'])
        return attrs


class CommercialDealSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()
    creator_relationship = serializers.SerializerMethodField()
    creator_shares = DealCreatorShareSerializer(many=True, required=False)
    # Written as a campaign name string; resolved to a Campaign row (created on
    # first use) in validate(). Reads back as the linked campaign's name.
    campaign = serializers.CharField(max_length=255)
    campaign_id = serializers.SerializerMethodField()
    campaign_status = serializers.SerializerMethodField()

    class Meta:
        model = CommercialDeal
        fields = '__all__'
        read_only_fields = ['version']
        extra_kwargs = {
            'agency_fee_inr': {'required': False},
            'creator_fee': {'required': False},
        }

    def get_creator_name(self, obj):
        return obj.effective_creator_name

    def get_creator_relationship(self, obj):
        return obj.creator.relationship if obj.creator_id else 'NonTCH'

    def get_campaign_id(self, obj):
        return obj.campaign_id

    def get_campaign_status(self, obj):
        return obj.campaign.status if obj.campaign_id else ''

    def validate(self, attrs):
        def value_of(field):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, None) if self.instance else None

        creator = attrs.get('creator') or (self.instance.creator if self.instance else None)
        if not creator:
            raise serializers.ValidationError({'creator': 'Pick a creator from the master list.'})
        attrs['creator_name_raw'] = ''
        if 'agency_fee_pct' in attrs:
            attrs['agency_fee_pct'] = normalise_agency_pct(attrs['agency_fee_pct'])

        required_fields = {
            'confirmation_date': 'Confirmation Date',
            'direction': 'Direction',
            'tch_poc': 'TCH POC',
            'total_fee': 'Total Fee',
            'agency_fee_pct': 'Agency Fee %',
            'agency_fee_inr': 'Agency Fee (INR)',
            'creator_fee': 'Creator Fee',
            'billing_entity': 'Billing Entity',
            'brand': 'Brand',
            'brand_poc': 'Brand POC',
            'campaign': 'Campaign',
            'deliverables': 'Deliverables',
            'ro_number': 'RO Number',
            'campaign_over': 'Campaign Over',
            'invoice_received': 'Invoice Received',
            'payment_cleared': 'Payment Cleared by TCH',
            'e_invoice_number': 'E-Invoice #',
            'payment_received': 'Payment Received by TCH',
        }
        missing = [label for field, label in required_fields.items() if value_of(field) in (None, '')]
        if missing:
            raise serializers.ValidationError({
                'required_fields': f"Please fill required campaign fields: {', '.join(missing)}. Client Invoice and Creator Invoice sections are optional."
            })

        shares = attrs.get('creator_shares')
        if shares is not None:
            for share in shares:
                if not share.get('creator'):
                    raise serializers.ValidationError({'creator_shares': 'Pick every split creator from the master list.'})
                share['creator_name_raw'] = ''
                if 'agency_fee_pct' in share:
                    share['agency_fee_pct'] = normalise_agency_pct(share['agency_fee_pct'])

        # Resolve the campaign name string into a Campaign row (matching
        # case-insensitively, creating on first use) so the deal links by FK.
        if 'campaign' in attrs and isinstance(attrs['campaign'], str):
            name = ' '.join(attrs['campaign'].split())[:255]
            if not name:
                raise serializers.ValidationError({'campaign': 'Campaign name cannot be blank.'})
            campaign = Campaign.objects.filter(name__iexact=name).first()
            if campaign is None:
                brand = attrs.get('brand') or (self.instance.brand if self.instance else '')
                campaign = Campaign.objects.create(name=name, brand=brand or '')
            attrs['campaign'] = campaign
        return attrs

    def create(self, validated_data):
        shares = validated_data.pop('creator_shares', None)
        deal = super().create(validated_data)
        if shares:
            for s in shares:
                DealCreatorShare.objects.create(deal=deal, **s)
        if deal.campaign_id:
            deal.campaign.refresh_status()
        return deal

    def update(self, instance, validated_data):
        old_campaign_id = instance.campaign_id
        shares = validated_data.pop('creator_shares', None)
        deal = super().update(instance, validated_data)
        # When creator_shares is provided, treat it as the full replacement set.
        if shares is not None:
            deal.creator_shares.all().delete()
            for s in shares:
                DealCreatorShare.objects.create(deal=deal, **s)
        # Keep derived campaign status in sync — for the new campaign and, when
        # the deal moved, for the one it left.
        if deal.campaign_id:
            deal.campaign.refresh_status()
        if old_campaign_id and old_campaign_id != deal.campaign_id:
            old = Campaign.objects.filter(id=old_campaign_id).first()
            if old:
                old.refresh_status()
        return deal


class EmployeeWeeklyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeWeeklyReport
        fields = '__all__'
        read_only_fields = ['version']


class DropOffSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()

    class Meta:
        model = DropOff
        fields = '__all__'
        read_only_fields = ['version']

    def get_creator_name(self, obj):
        return obj.effective_creator_name


class SocialMediaSnapshotSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.name', read_only=True)

    class Meta:
        model = SocialMediaSnapshot
        fields = '__all__'
        read_only_fields = ['version']


class EventInviteSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.name', read_only=True)

    class Meta:
        model = EventInvite
        fields = '__all__'
        read_only_fields = ['version']
