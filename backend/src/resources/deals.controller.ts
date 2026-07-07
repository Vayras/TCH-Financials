import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  NotFoundException, Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { applyMapped } from '../common/apply';
import { D, isBlank, normalisePct } from '../common/decimal';
import { billingPeriod, fiscalYearOf } from '../common/fy';
import { dealDto } from '../common/serializers';
import { versionedUpdate } from '../common/versioned-update';
import { Campaign, CommercialDeal, DealCreatorShare } from '../entities';
import { refreshCampaignStatus } from './campaigns.controller';

const FIELDS = {
  confirmation_date: 'confirmationDate',
  e_invoice_date: 'eInvoiceDate',
  creator: 'creatorId',
  tch_poc: 'tchPoc',
  agency_commission_agreed: 'agencyCommissionAgreed',
  direction: 'direction',
  total_fee: 'totalFee',
  agency_fee_pct: 'agencyFeePct',
  agency_fee_inr: 'agencyFeeInr',
  creator_fee: 'creatorFee',
  billing_entity: 'billingEntity',
  brand: 'brand',
  brand_poc: 'brandPoc',
  deliverables: 'deliverables',
  ro_number: 'roNumber',
  campaign_over: 'campaignOver',
  invoice_received: 'invoiceReceived',
  payment_cleared: 'paymentCleared',
  e_invoice_number: 'eInvoiceNumber',
  payment_received: 'paymentReceived',
  client_invoice_number: 'clientInvoiceNumber',
  client_invoice_date: 'clientInvoiceDate',
  client_invoice_amount: 'clientInvoiceAmount',
  client_payment_status: 'clientPaymentStatus',
  client_payment_received_amount: 'clientPaymentReceivedAmount',
  client_payment_date: 'clientPaymentDate',
  creator_invoice_number: 'creatorInvoiceNumber',
  creator_invoice_date: 'creatorInvoiceDate',
  creator_invoice_amount: 'creatorInvoiceAmount',
  creator_payment_status: 'creatorPaymentStatus',
  creator_payment_cycle: 'creatorPaymentCycle',
  creator_payment_date: 'creatorPaymentDate',
  comments: 'comments',
  completed_at: 'completedAt',
};

const REQUIRED: Record<string, string> = {
  confirmation_date: 'Confirmation Date',
  direction: 'Direction',
  tch_poc: 'TCH POC',
  total_fee: 'Total Fee',
  agency_fee_pct: 'Agency Fee %',
  agency_fee_inr: 'Agency Fee (INR)',
  creator_fee: 'Creator Fee',
  brand: 'Brand',
  brand_poc: 'POC Email',
  campaign: 'Campaign',
  deliverables: 'Deliverables',
};

const RELATIONS = ['creator', 'campaign', 'creatorShares', 'creatorShares.creator'];

interface SharePayload {
  creator?: number | string | null;
  total_fee?: unknown;
  agency_fee_pct?: unknown;
  agency_fee_inr?: unknown;
  creator_fee?: unknown;
}

@Controller('deals')
export class DealsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager) {
    return (manager ?? this.dataSource).getRepository(CommercialDeal);
  }

  private async serialize(id: string, manager?: EntityManager) {
    const row = await this.repo(manager).findOne({ where: { id }, relations: RELATIONS });
    if (!row) throw new NotFoundException({ detail: 'Not found.' });
    return dealDto(row);
  }

  /**
   * Mirrors CommercialDealSerializer.validate(): creator mandatory, percent
   * normalisation, DRF-style required-field check merging payload over the
   * existing row, share validation, and campaign-name -> Campaign resolution
   * (matching case-insensitively, creating on first use).
   */
  private async validateAndResolve(
    body: Record<string, unknown>,
    instance: CommercialDeal | null,
    manager: EntityManager,
  ): Promise<{ campaignId: string | null }> {
    const creator = body.creator ?? instance?.creatorId ?? null;
    if (isBlank(creator)) {
      throw new BadRequestException({ creator: ['Pick a creator from the master list.'] });
    }
    body.creator_name_raw = '';
    if ('agency_fee_pct' in body) {
      body.agency_fee_pct = normalisePct(body.agency_fee_pct);
    }

    const instanceWire: Record<string, unknown> = instance
      ? {
          confirmation_date: instance.confirmationDate,
          direction: instance.direction,
          tch_poc: instance.tchPoc,
          total_fee: instance.totalFee,
          agency_fee_pct: instance.agencyFeePct,
          agency_fee_inr: instance.agencyFeeInr,
          creator_fee: instance.creatorFee,
          billing_entity: instance.billingEntity,
          brand: instance.brand,
          brand_poc: instance.brandPoc,
          campaign: instance.campaignId,
          deliverables: instance.deliverables,
          ro_number: instance.roNumber,
          campaign_over: instance.campaignOver,
          invoice_received: instance.invoiceReceived,
          payment_cleared: instance.paymentCleared,
          e_invoice_number: instance.eInvoiceNumber,
          payment_received: instance.paymentReceived,
        }
      : {};
    const missing = Object.entries(REQUIRED)
      .filter(([field]) => isBlank(field in body ? body[field] : instanceWire[field]))
      .map(([, label]) => label);
    if (missing.length) {
      throw new BadRequestException({
        required_fields:
          `Please fill required campaign fields: ${missing.join(', ')}. ` +
          'Client Invoice and Creator Invoice sections are optional.',
      });
    }

    const shares = body.creator_shares as SharePayload[] | undefined;
    if (shares !== undefined && shares !== null) {
      for (const share of shares) {
        if (isBlank(share.creator)) {
          throw new BadRequestException({
            creator_shares: ['Pick every split creator from the master list.'],
          });
        }
        if ('agency_fee_pct' in share) {
          share.agency_fee_pct = normalisePct(share.agency_fee_pct);
        }
      }
    }

    // Resolve the campaign name string into a Campaign row.
    let campaignId: string | null = instance?.campaignId ?? null;
    if ('campaign' in body && typeof body.campaign === 'string') {
      const name = body.campaign.split(/\s+/).join(' ').trim().slice(0, 255);
      if (!name) {
        throw new BadRequestException({ campaign: ['Campaign name cannot be blank.'] });
      }
      const repo = manager.getRepository(Campaign);
      let campaign = await repo
        .createQueryBuilder('c')
        .where('LOWER(c.name) = LOWER(:name)', { name })
        .getOne();
      if (!campaign) {
        campaign = repo.create({
          name,
          brand: String(body.brand ?? instance?.brand ?? ''),
        });
        await repo.save(campaign);
      }
      campaignId = campaign.id;
    }
    return { campaignId };
  }

  // Auto-derive missing agency_fee_inr / creator_fee, as the Django model did
  // on every save (zero counts as missing).
  private deriveFees(row: CommercialDeal): void {
    const total = D(row.totalFee);
    const pct = D(row.agencyFeePct);
    if (!total.isZero() && !pct.isZero() && D(row.agencyFeeInr).isZero()) {
      row.agencyFeeInr = total.mul(pct).toFixed(2);
    }
    const inr = D(row.agencyFeeInr);
    if (!total.isZero() && !inr.isZero() && D(row.creatorFee).isZero()) {
      row.creatorFee = total.minus(inr).toFixed(2);
    }
  }

  private async replaceShares(
    manager: EntityManager,
    dealId: string,
    shares: SharePayload[],
  ): Promise<void> {
    const repo = manager.getRepository(DealCreatorShare);
    await repo.delete({ dealId });
    for (const s of shares) {
      await repo.save(
        repo.create({
          dealId,
          creatorId: String(s.creator),
          creatorNameRaw: '',
          totalFee: String(s.total_fee ?? '0') || '0',
          agencyFeePct: String(s.agency_fee_pct ?? '0') || '0',
          agencyFeeInr: String(s.agency_fee_inr ?? '0') || '0',
          creatorFee: String(s.creator_fee ?? '0') || '0',
        }),
      );
    }
  }

  @Get()
  async list(@Query('fy') fy?: string, @Query('campaign') campaign?: string) {
    const qb = this.repo()
      .createQueryBuilder('deal')
      .leftJoinAndSelect('deal.creator', 'creator')
      .leftJoinAndSelect('deal.campaign', 'campaign')
      .leftJoinAndSelect('deal.creatorShares', 'share')
      .leftJoinAndSelect('share.creator', 'shareCreator')
      .orderBy('deal.confirmation_date', 'ASC', 'NULLS FIRST')
      .addOrderBy('deal.id', 'ASC');
    if (campaign) qb.andWhere('deal.campaign_id = :campaign', { campaign });
    let rows = await qb.getMany();

    // FY filter runs here, not in SQL: the billing period hides inside the
    // free-text E-Invoice No. A deal belongs to the FY when either its billing
    // period or its confirmation date lands there; deals with neither date are
    // always included so the UI can surface them for backfill.
    const fyStart = fy ? Number(fy) : NaN;
    if (!Number.isNaN(fyStart) && fy) {
      rows = rows.filter((d) => {
        const period = billingPeriod(d);
        const confirmed = d.confirmationDate;
        if (period === null && confirmed === null) return true;
        return (
          (period !== null && fiscalYearOf(period) === fyStart) ||
          (confirmed !== null && fiscalYearOf(confirmed) === fyStart)
        );
      });
    }
    return rows.map(dealDto);
  }

  @Get(':id')
  retrieve(@Param('id') id: string) {
    return this.serialize(id);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: Record<string, unknown>) {
    const id = await this.dataSource.transaction(async (manager) => {
      const { campaignId } = await this.validateAndResolve(body, null, manager);
      const repo = manager.getRepository(CommercialDeal);
      const row = repo.create();
      applyMapped(row as unknown as Record<string, unknown>, body, FIELDS);
      row.creatorNameRaw = '';
      row.campaignId = campaignId;
      this.deriveFees(row);
      await repo.save(row);
      const shares = body.creator_shares as SharePayload[] | undefined;
      if (shares?.length) await this.replaceShares(manager, row.id, shares);
      await refreshCampaignStatus(manager, row.campaignId);
      return row.id;
    });
    return this.serialize(id);
  }

  @Put(':id')
  replace(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.update(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return versionedUpdate(this.dataSource, CommercialDeal, id, body, {
      apply: async (row, manager) => {
        const oldCampaignId = row.campaignId;
        const { campaignId } = await this.validateAndResolve(body, row, manager);
        applyMapped(row as unknown as Record<string, unknown>, body, FIELDS);
        row.creatorNameRaw = '';
        row.campaignId = campaignId;
        this.deriveFees(row);
        await manager.getRepository(CommercialDeal).save(row);
        // When creator_shares is provided, it's the full replacement set;
        // an empty array clears any split.
        const shares = body.creator_shares as SharePayload[] | undefined;
        if (shares !== undefined && shares !== null) {
          await this.replaceShares(manager, row.id, shares);
        }
        // Keep derived campaign status in sync — for the new campaign and,
        // when the deal moved, for the one it left.
        await refreshCampaignStatus(manager, row.campaignId);
        if (oldCampaignId && oldCampaignId !== row.campaignId) {
          await refreshCampaignStatus(manager, oldCampaignId);
        }
      },
      serialize: (rowId, manager) => this.serialize(rowId, manager),
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const row = await this.repo().findOneBy({ id });
    if (!row) throw new NotFoundException({ detail: 'Not found.' });
    const campaignId = row.campaignId;
    await this.repo().delete({ id });
    await this.dataSource.transaction((m) => refreshCampaignStatus(m, campaignId));
  }
}
