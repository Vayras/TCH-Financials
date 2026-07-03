from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tch', '0011_campaign_version_commercialdeal_version_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='creatordocument',
            name='doc_type',
            field=models.CharField(
                choices=[
                    ('Agreement', 'Contract / Agreement'),
                    ('PAN', 'PAN Card'),
                    ('Aadhaar', 'Aadhaar Card'),
                    ('Cheque', 'Cancelled Cheque'),
                    ('Bank', 'Bank Details'),
                    ('GST', 'GST'),
                    ('Other', 'Other'),
                ],
                default='Other',
                max_length=20,
            ),
        ),
    ]
