from rest_framework import serializers
from .models import (
    Creator, ContractingCompliance, CommercialDeal, EmployeeWeeklyReport,
    DropOff, CreatorDocument, DealCreatorShare,
)


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


class ContractingComplianceSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.name', read_only=True)

    class Meta:
        model = ContractingCompliance
        fields = '__all__'


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


class CommercialDealSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()
    creator_relationship = serializers.SerializerMethodField()
    creator_shares = DealCreatorShareSerializer(many=True, required=False)

    class Meta:
        model = CommercialDeal
        fields = '__all__'
        extra_kwargs = {
            'agency_fee_inr': {'required': False},
            'creator_fee': {'required': False},
        }

    def get_creator_name(self, obj):
        return obj.effective_creator_name

    def get_creator_relationship(self, obj):
        return obj.creator.relationship if obj.creator_id else 'NonTCH'

    def create(self, validated_data):
        shares = validated_data.pop('creator_shares', None)
        deal = super().create(validated_data)
        if shares:
            for s in shares:
                DealCreatorShare.objects.create(deal=deal, **s)
        return deal

    def update(self, instance, validated_data):
        shares = validated_data.pop('creator_shares', None)
        deal = super().update(instance, validated_data)
        # When creator_shares is provided, treat it as the full replacement set.
        if shares is not None:
            deal.creator_shares.all().delete()
            for s in shares:
                DealCreatorShare.objects.create(deal=deal, **s)
        return deal


class EmployeeWeeklyReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeWeeklyReport
        fields = '__all__'


class DropOffSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()

    class Meta:
        model = DropOff
        fields = '__all__'

    def get_creator_name(self, obj):
        return obj.effective_creator_name
