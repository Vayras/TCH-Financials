"""Domain models for TCH Financials.

The CommercialDeal table is the single source of truth for money.
Current Overview and Quarterly Exclusive summaries are derived, never stored.
"""

from __future__ import annotations

from decimal import Decimal
from django.db import models


class VersionedModel(models.Model):
    """Optimistic-locking support: every user-editable row carries a version
    that increments on each update. Clients send back the version they loaded;
    a mismatch means someone else saved in between and the API answers 409
    instead of silently overwriting their change."""

    version = models.PositiveIntegerField(default=1)

    class Meta:
        abstract = True


class Creator(VersionedModel):
    SOURCE_CHOICES = [('EMW', 'EMW'), ('TCH', 'TCH'), ('OTHER', 'Other')]
    STAGE_CHOICES = [
        ('Lead', 'Lead'),
        ('Discussing', 'Discussing'),
        ('Closed', 'Closed'),
        ('Dropped', 'Dropped'),
    ]
    RELATIONSHIP_CHOICES = [
        ('Exclusive', 'Exclusive'),
        ('Friend', 'Friend'),
        ('Dropping', 'Dropping out soon'),
        ('NonTCH', 'Non TCH'),
    ]
    STATUS_CHOICES = [('Active', 'Active'), ('Inactive', 'Inactive')]

    name = models.CharField(max_length=200, unique=True)
    category = models.CharField(max_length=200, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, blank=True)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, blank=True)
    relationship = models.CharField(max_length=20, choices=RELATIONSHIP_CHOICES, default='Friend')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Active')
    doj = models.DateField(null=True, blank=True)
    doj_note = models.CharField(max_length=120, blank=True, help_text="Free-text DOJ if unparseable")
    profile_url = models.URLField(max_length=400, blank=True)
    location = models.CharField(max_length=80, blank=True)
    ops_manager = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


def creator_document_path(instance, filename: str) -> str:
    """Store uploads under creator_docs/<creator_id>/<filename>."""
    return f"creator_docs/{instance.creator_id}/{filename}"


class CreatorDocument(models.Model):
    DOC_TYPES = [
        ('Agreement', 'Agreement'),
        ('Bank', 'Bank Details'),
        ('PAN', 'PAN'),
        ('GST', 'GST'),
        ('Other', 'Other'),
    ]

    creator = models.ForeignKey(Creator, on_delete=models.CASCADE, related_name='documents')
    doc_type = models.CharField(max_length=20, choices=DOC_TYPES, default='Other')
    label = models.CharField(max_length=200, blank=True)
    file = models.FileField(upload_to=creator_document_path)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self) -> str:
        return f"Document<{self.creator.name}/{self.doc_type}>"


class ContractingCompliance(VersionedModel):
    YN = [('Y', 'Y'), ('N', 'N'), ('', '')]

    creator = models.OneToOneField(Creator, on_delete=models.CASCADE, related_name='contracting')
    final_meeting = models.CharField(max_length=1, choices=YN, blank=True)
    agreement_sent = models.CharField(max_length=1, choices=YN, blank=True)
    agreement_signed = models.CharField(max_length=1, choices=YN, blank=True)
    bank_verified = models.CharField(max_length=1, choices=YN, blank=True)
    time_to_sign = models.CharField(max_length=120, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    renewal_note = models.CharField(max_length=120, blank=True)

    def __str__(self) -> str:
        return f"Contracting<{self.creator.name}>"


class Campaign(VersionedModel):
    """First-class campaign. Deals belong to a campaign; billing, status and
    creator involvement roll up from the deals."""

    STATUS_CHOICES = [('Active', 'Active'), ('Over', 'Over')]

    name = models.CharField(max_length=255, unique=True)
    brand = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Active')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name

    def refresh_status(self) -> None:
        """A campaign is Over once every deal on it is marked campaign_over."""
        flags = list(self.deals.values_list('campaign_over', flat=True))
        new_status = 'Over' if flags and all(f == 'Y' for f in flags) else 'Active'
        if new_status != self.status:
            self.status = new_status
            self.save(update_fields=['status'])


class CommercialDeal(VersionedModel):
    DIRECTION = [
        ('Inbound', 'Inbound'),
        ('Outbound', 'Outbound'),
        ('MarkUp', 'Mark Up'),
    ]
    YN = [('Y', 'Y'), ('N', 'N'), ('', '')]

    confirmation_date = models.DateField(null=True, blank=True)
    e_invoice_date = models.DateField(null=True, blank=True)
    creator = models.ForeignKey(
        Creator, on_delete=models.PROTECT, related_name='deals', null=True, blank=True
    )
    creator_name_raw = models.CharField(
        max_length=200, blank=True,
        help_text="Raw name string for non-TCH / outsiders without a Creator row",
    )
    tch_poc = models.CharField(max_length=120, blank=True,
                               help_text="TCH person who worked on this deal")
    agency_commission_agreed = models.CharField(max_length=120, blank=True)
    direction = models.CharField(max_length=16, choices=DIRECTION, default='Outbound')
    total_fee = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    agency_fee_pct = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal('0'),
                                          help_text="Fractional, e.g. 0.20 = 20%")
    agency_fee_inr = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'),
                                          help_text="Profit to TCH")
    creator_fee = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    billing_entity = models.CharField(max_length=120, blank=True)
    brand = models.CharField(max_length=200, blank=True)
    brand_poc = models.CharField(max_length=200, blank=True,
                                 help_text="Brand-side point of contact (name / detail)")
    campaign = models.ForeignKey(
        Campaign, on_delete=models.SET_NULL, related_name='deals', null=True, blank=True
    )
    deliverables = models.CharField(max_length=255, blank=True)
    ro_number = models.CharField(max_length=80, blank=True)
    campaign_over = models.CharField(max_length=1, choices=YN, blank=True)
    invoice_received = models.CharField(max_length=1, choices=YN, blank=True)
    payment_cleared = models.CharField(max_length=1, choices=YN, blank=True)
    e_invoice_number = models.CharField(max_length=80, blank=True)
    payment_received = models.CharField(max_length=1, choices=YN, blank=True)

    # --- Finance: Client Invoice (TCH → Client) ---
    client_invoice_number = models.CharField(max_length=120, blank=True, help_text="Invoice number sent to client")
    client_invoice_date = models.DateField(null=True, blank=True)
    client_invoice_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    client_payment_status = models.CharField(
        max_length=20,
        choices=[('Pending', 'Pending'), ('Partial', 'Partial'), ('Received', 'Received'), ('Overdue', 'Overdue'), ('', '')],
        blank=True,
    )
    client_payment_received_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    client_payment_date = models.DateField(null=True, blank=True)

    # --- Finance: Creator Invoice (Creator → TCH) ---
    creator_invoice_number = models.CharField(max_length=120, blank=True, help_text="Invoice from creator")
    creator_invoice_date = models.DateField(null=True, blank=True)
    creator_invoice_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    creator_payment_status = models.CharField(
        max_length=20,
        choices=[('Pending', 'Pending'), ('Scheduled', 'Scheduled'), ('Paid', 'Paid'), ('Overdue', 'Overdue'), ('', '')],
        blank=True,
    )
    creator_payment_cycle = models.CharField(
        max_length=20,
        choices=[('Immediate', 'Immediate'), ('Net15', 'Net 15'), ('Net30', 'Net 30'), ('Net45', 'Net 45'), ('Net60', 'Net 60'), ('', '')],
        blank=True,
        help_text="Payment cycle for creator payout",
    )
    creator_payment_date = models.DateField(null=True, blank=True)

    comments = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Show no-date rows first (likely needs attention / just-added),
        # then chronological 2025 → 2026.
        ordering = [models.F('confirmation_date').asc(nulls_first=True), 'id']

    def save(self, *args, **kwargs):
        # Auto-derive missing agency_fee_inr / creator_fee from the other fields
        if self.total_fee and self.agency_fee_pct and not self.agency_fee_inr:
            self.agency_fee_inr = (self.total_fee * self.agency_fee_pct).quantize(Decimal('0.01'))
        if self.total_fee and self.agency_fee_inr and not self.creator_fee:
            self.creator_fee = (self.total_fee - self.agency_fee_inr).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    @property
    def effective_creator_name(self) -> str:
        return self.creator.name if self.creator_id else self.creator_name_raw

    @property
    def campaign_name(self) -> str:
        return self.campaign.name if self.campaign_id else ''


class DealCreatorShare(models.Model):
    """Per-creator split of a campaign's billing.

    When a campaign has multiple creators, each gets a row here partitioning
    the campaign's total_fee / profit / creator_fee. A campaign with no shares
    falls back to its single `creator` (legacy behaviour) in aggregations.
    """

    deal = models.ForeignKey(
        CommercialDeal, on_delete=models.CASCADE, related_name='creator_shares'
    )
    creator = models.ForeignKey(
        Creator, on_delete=models.PROTECT, related_name='deal_shares', null=True, blank=True
    )
    creator_name_raw = models.CharField(max_length=200, blank=True)
    total_fee = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    agency_fee_pct = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal('0'))
    agency_fee_inr = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    creator_fee = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))

    class Meta:
        ordering = ['id']

    @property
    def effective_creator_name(self) -> str:
        return self.creator.name if self.creator_id else self.creator_name_raw


class DropOff(VersionedModel):
    """Log of creators who left TCH."""

    creator = models.ForeignKey(
        Creator, on_delete=models.SET_NULL, null=True, blank=True, related_name='dropoffs'
    )
    creator_name_raw = models.CharField(max_length=200, blank=True)
    drop_off_date = models.DateField(null=True, blank=True)
    drop_off_date_note = models.CharField(max_length=120, blank=True)
    reason = models.TextField(blank=True)
    learning = models.TextField(blank=True)
    duration = models.CharField(max_length=80, blank=True, help_text="e.g. '1 year', '8 months'")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-drop_off_date', '-id']

    @property
    def effective_creator_name(self) -> str:
        return self.creator.name if self.creator_id else self.creator_name_raw


class SocialMediaSnapshot(VersionedModel):
    """Tracks a creator's social media stats at a point in time."""
    SNAPSHOT_TYPES = [
        ('Baseline', 'Baseline (Day 0)'),
        ('Quarterly', 'Quarterly'),
    ]

    creator = models.ForeignKey(Creator, on_delete=models.CASCADE, related_name='social_snapshots')
    snapshot_type = models.CharField(max_length=20, choices=SNAPSHOT_TYPES, default='Quarterly')
    snapshot_date = models.DateField()
    platform = models.CharField(max_length=40, default='Instagram')
    followers = models.IntegerField(default=0)
    engagement_rate = models.DecimalField(max_digits=6, decimal_places=3, default=Decimal('0'),
                                          help_text="As percentage, e.g. 3.5 = 3.5%")
    estimated_reach = models.IntegerField(default=0)
    revenue_last_3m = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'),
                                           help_text="Estimated revenue in last 3 months (INR)")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['creator__name', 'snapshot_date']

    def __str__(self) -> str:
        return f"Snapshot<{self.creator.name}/{self.snapshot_type}/{self.snapshot_date}>"


class EventInvite(VersionedModel):
    """Tracks event invitations sent to creators and their responses."""
    RESPONSE_CHOICES = [
        ('Accepted', 'Accepted'),
        ('Declined', 'Declined'),
        ('NoResponse', 'No Response'),
        ('', ''),
    ]

    creator = models.ForeignKey(Creator, on_delete=models.CASCADE, related_name='event_invites')
    event_name = models.CharField(max_length=255)
    event_date = models.DateField()
    invited_date = models.DateField(null=True, blank=True)
    response = models.CharField(max_length=20, choices=RESPONSE_CHOICES, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-event_date', 'creator__name']

    def __str__(self) -> str:
        return f"Event<{self.creator.name}/{self.event_name}>"


class EmployeeWeeklyReport(VersionedModel):
    week_ending = models.DateField(null=True, blank=True)
    employee_name = models.CharField(max_length=120)
    new_outreach = models.IntegerField(default=0)
    paid_confirmations = models.CharField(max_length=255, blank=True)
    revenue_locked = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    profit_locked = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0'))
    barter_confirmations = models.CharField(max_length=255, blank=True)
    live_campaigns = models.IntegerField(default=0)
    action_points = models.TextField(blank=True)

    class Meta:
        ordering = ['-week_ending', 'employee_name']


class AlertDismissal(models.Model):
    """A dismissed ('cleared') alert on the Alerts page.

    Alerts are recomputed from live data on every load, so clearing one means
    remembering its stable key here and filtering it out of the payload. Keys
    embed what makes the alert recur (deal id, creator id, brand, quarter or
    occurrence date), so e.g. a dismissed seasonal moment comes back next year
    and a dismissed QoQ drop can fire again next quarter.
    """
    key = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"AlertDismissal<{self.key}>"
