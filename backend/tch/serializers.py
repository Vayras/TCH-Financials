from rest_framework import serializers
from .models import Creator, ContractingCompliance, CommercialDeal, EmployeeWeeklyReport, DropOff


class CreatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Creator
        fields = '__all__'


class ContractingComplianceSerializer(serializers.ModelSerializer):
    creator_name = serializers.CharField(source='creator.name', read_only=True)

    class Meta:
        model = ContractingCompliance
        fields = '__all__'


class CommercialDealSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()
    creator_relationship = serializers.SerializerMethodField()

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
