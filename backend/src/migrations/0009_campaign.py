"""Promote campaign from a free-text field on CommercialDeal to a first-class
Campaign model. Existing deal.campaign strings are grouped (case-insensitive,
whitespace-collapsed) into Campaign rows and each deal is linked by FK."""

from django.db import migrations, models
import django.db.models.deletion


def _norm(name):
    return ' '.join((name or '').split())


def populate_campaigns(apps, schema_editor):
    Campaign = apps.get_model('tch', 'Campaign')
    CommercialDeal = apps.get_model('tch', 'CommercialDeal')

    # key: lowercased normalised name -> Campaign instance
    by_key = {}
    # key -> aggregates used to derive status / dates / brand
    groups = {}

    for deal in CommercialDeal.objects.all().order_by('id'):
        name = _norm(deal.campaign)[:255]
        if not name:
            continue
        key = name.lower()
        g = groups.setdefault(key, {
            'name': name,
            'brand': '',
            'all_over': True,
            'start': None,
            'end': None,
            'deal_ids': [],
        })
        if deal.brand and not g['brand']:
            g['brand'] = deal.brand
        if deal.campaign_over != 'Y':
            g['all_over'] = False
        if deal.confirmation_date and (g['start'] is None or deal.confirmation_date < g['start']):
            g['start'] = deal.confirmation_date
        if deal.e_invoice_date and (g['end'] is None or deal.e_invoice_date > g['end']):
            g['end'] = deal.e_invoice_date
        g['deal_ids'].append(deal.id)

    for key, g in groups.items():
        campaign = Campaign.objects.create(
            name=g['name'],
            brand=g['brand'][:200],
            status='Over' if g['all_over'] else 'Active',
            start_date=g['start'],
            end_date=g['end'],
        )
        by_key[key] = campaign
        CommercialDeal.objects.filter(id__in=g['deal_ids']).update(campaign_link=campaign)


def restore_campaign_strings(apps, schema_editor):
    """Reverse: copy each linked campaign's name back into the string column."""
    CommercialDeal = apps.get_model('tch', 'CommercialDeal')
    for deal in CommercialDeal.objects.select_related('campaign_link').all():
        if deal.campaign_link_id:
            deal.campaign = deal.campaign_link.name
            deal.save(update_fields=['campaign'])


class Migration(migrations.Migration):

    dependencies = [
        ('tch', '0008_social_snapshots_and_events'),
    ]

    operations = [
        migrations.CreateModel(
            name='Campaign',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, unique=True)),
                ('brand', models.CharField(blank=True, max_length=200)),
                ('status', models.CharField(choices=[('Active', 'Active'), ('Over', 'Over')], default='Active', max_length=10)),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['name']},
        ),
        migrations.AddField(
            model_name='commercialdeal',
            name='campaign_link',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deals', to='tch.campaign'),
        ),
        migrations.RunPython(populate_campaigns, restore_campaign_strings),
        migrations.RemoveField(
            model_name='commercialdeal',
            name='campaign',
        ),
        migrations.RenameField(
            model_name='commercialdeal',
            old_name='campaign_link',
            new_name='campaign',
        ),
    ]
