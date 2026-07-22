import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  NotFoundException, Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { applyMapped } from '../common/apply';
import { D, isBlank, normalisePct } from '../common/decimal';
import { syncBillingPeriod } from '../common/fy';
import { csvValues, paginationParams } from '../common/pagination';
import { refreshInvoiceCompletion } from '../common/invoice-completion';
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
  brand: 'Brand',
  brand_poc: 'POC Email',
  campaign: 'Campaign',
  deliverables: 'Deliverables',
  e_invoice_number: 'E-Invoice #',
};

const RELATIONS = ['creator', 'campaign', 'creatorShares', 'creatorShares.creator'];

interface SharePayload {
  creator?: number | string | null;
  total_fee?: unknown;
  agency_fee_pct?: unknown;
  agency_fee_inr?: unknown;
  creator_fee?: unknown;
  ro_number?: unknown;
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
    if ('creator' in body) {
      body.creator = isBlank(body.creator) ? null : Number(body.creator);
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
    if (shares.length === 0) return;
    const entities = shares.map((s) =>
      repo.create({
        dealId,
        creatorId: String(s.creator),
        creatorNameRaw: '',
        totalFee: String(s.total_fee ?? '0') || '0',
        agencyFeePct: String(s.agency_fee_pct ?? '0') || '0',
        agencyFeeInr: String(s.agency_fee_inr ?? '0') || '0',
        creatorFee: String(s.creator_fee ?? '0') || '0',
        roNumber: String(s.ro_number ?? '') || '',
      }),
    );
    await repo.save(entities);
  }

  @Get()
  async list(
    @Query('fy') fy?: string,
    @Query('campaign') campaign?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('search') search?: string,
    @Query('direction') direction?: string,
    @Query('creator') creator?: string,
    @Query('months') months?: string,
    @Query('sort') sort?: string,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: string,
    @Query('group_by') groupBy?: string,
    @Query('period_only') periodOnly?: string,
  ) {
    const pagination = paginationParams(page, pageSize);
    const qb = this.repo()
      .createQueryBuilder('deal')
      .leftJoinAndSelect('deal.creator', 'creator')
      .leftJoinAndSelect('deal.campaign', 'campaign')
      .leftJoinAndSelect('deal.creatorShares', 'share')
      .leftJoinAndSelect('share.creator', 'shareCreator')
      // Separate filter joins keep the selected creatorShares collection
      // complete when a search/creator predicate matches only one share.
      .leftJoin('deal.creatorShares', 'filterShare')
      .leftJoin('filterShare.creator', 'filterShareCreator')
      .distinct(true);
    if (campaign) qb.andWhere('deal.campaign_id = :campaign', { campaign });
    const fyStart = fy ? Number(fy) : NaN;
    if (!Number.isNaN(fyStart) && fy) {
      if (periodOnly === '1' || periodOnly === 'true') {
        qb.andWhere('deal.billing_fy_start = :fyStart', { fyStart });
      } else {
        qb.andWhere(`(
          deal.billing_fy_start = :fyStart OR
          (deal.confirmation_date >= :fyFrom AND deal.confirmation_date < :fyTo) OR
          (deal.billing_period IS NULL AND deal.confirmation_date IS NULL)
        )`, {
          fyStart,
          fyFrom: `${fyStart}-04-01`,
          fyTo: `${fyStart + 1}-04-01`,
        });
      }
    }
    if (direction) qb.andWhere('deal.direction = :direction', { direction });
    if (creator) {
      qb.andWhere('(deal.creator_id = :creator OR filterShare.creator_id = :creator)', { creator });
    }
    const monthValues = csvValues(months).map(Number).filter((m) => m >= 1 && m <= 12);
    if (monthValues.length) qb.andWhere('deal.billing_month IN (:...months)', { months: monthValues });
    if (search?.trim()) {
      qb.andWhere(`(
        deal.brand ILIKE :search OR campaign.name ILIKE :search OR deal.ro_number ILIKE :search OR
        creator.name ILIKE :search OR filterShareCreator.name ILIKE :search
      )`, { search: `%${search.trim()}%` });
    }

    const sortMap: Record<string, string> = {
      billing_period: 'deal.billingPeriod', confirmation_date: 'deal.confirmationDate',
      total_fee: 'deal.totalFee', brand: 'deal.brand', created_at: 'deal.createdAt',
    };
    // Explicit sort_by/sort_order is the public contract. The compact legacy
    // `sort=-billing_period` form remains accepted so old URLs keep working.
    const legacySortKey = (sort ?? '').replace(/^-/, '');
    const sortKey = sortBy ?? (legacySortKey || 'billing_period');
    if (!sortMap[sortKey]) {
      throw new BadRequestException({
        detail: `sort_by must be one of: ${Object.keys(sortMap).join(', ')}.`,
      });
    }
    const requestedOrder = sortOrder?.toLowerCase();
    if (requestedOrder && requestedOrder !== 'asc' && requestedOrder !== 'desc') {
      throw new BadRequestException({ detail: 'sort_order must be asc or desc.' });
    }
    const sortColumn = sortMap[sortKey];
    const sortDirection = requestedOrder
      ? (requestedOrder.toUpperCase() as 'ASC' | 'DESC')
      : (sort ?? '').startsWith('-') ? 'DESC' : 'ASC';
    qb.orderBy(sortColumn, sortDirection, 'NULLS FIRST').addOrderBy('deal.id', 'ASC');

    if (!pagination.requested) return (await qb.getMany()).map(dealDto);

    if (groupBy === 'campaign' || groupBy === 'creator') {
      const allRows = await qb.getMany();
      const totalBilling = allRows.reduce((sum, row) => sum + (Number(row.totalFee) || 0), 0);
      const groups = new Map<string, Record<string, unknown>>();
      if (groupBy === 'campaign') {
        for (const row of allRows) {
          const key = row.campaignId ? `c${row.campaignId}` : `d${row.id}`;
          const current = groups.get(key) ?? {
            key,
            name: row.campaign?.name || row.brand || '—',
            brand: row.brand,
            status: row.campaign?.status ?? '',
            creator_names: [] as string[],
            total: 0,
            deal_count: 0,
            deal: dealDto(row),
          };
          current.total = Number(current.total) + (Number(row.totalFee) || 0);
          current.deal_count = Number(current.deal_count) + 1;
          const names = (row.creatorShares?.length ? row.creatorShares.map((s) => s.creator?.name || s.creatorNameRaw) : [row.creator?.name || row.creatorNameRaw]).filter(Boolean);
          for (const name of names) if (!(current.creator_names as string[]).includes(name)) (current.creator_names as string[]).push(name);
          groups.set(key, current);
        }
      } else {
        for (const row of allRows) {
          const members = row.creatorShares?.length
            ? row.creatorShares.map((share) => ({
                key: share.creatorId ? `c${share.creatorId}` : `n${share.creatorNameRaw.toLowerCase()}`,
                name: share.creator?.name || share.creatorNameRaw || '—',
                relationship: share.creator?.relationship ?? 'NonTCH',
                total: Number(share.totalFee) || 0,
              }))
            : [{
                key: row.creatorId ? `c${row.creatorId}` : `n${row.creatorNameRaw.toLowerCase()}`,
                name: row.creator?.name || row.creatorNameRaw || '—',
                relationship: row.creator?.relationship ?? 'NonTCH',
                total: Number(row.totalFee) || 0,
              }];
          for (const member of members) {
            const current = groups.get(member.key) ?? {
              key: member.key, name: member.name, relationship: member.relationship,
              total: 0, deal_count: 0, deal: dealDto(row),
            };
            current.total = Number(current.total) + member.total;
            current.deal_count = Number(current.deal_count) + 1;
            groups.set(member.key, current);
          }
        }
      }
      const items = Array.from(groups.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      const start = (pagination.page - 1) * pagination.pageSize;
      return {
        items: items.slice(start, start + pagination.pageSize),
        page: pagination.page,
        page_size: pagination.pageSize,
        total: items.length,
        total_pages: Math.max(1, Math.ceil(items.length / pagination.pageSize)),
        summary: { total_billing: totalBilling.toFixed(2), deal_count: allRows.length },
      };
    }

    const total = await qb.getCount();
    const summaryRows = await qb.clone()
      .select('deal.id', 'id')
      .addSelect('deal.total_fee', 'total_fee')
      .orderBy()
      .getRawMany<{ id: string; total_fee: string }>();
    const totalBilling = summaryRows.reduce((sum, row) => sum + (Number(row.total_fee) || 0), 0);
    const rows = await qb.skip((pagination.page - 1) * pagination.pageSize).take(pagination.pageSize).getMany();
    return {
      items: rows.map(dealDto),
      page: pagination.page,
      page_size: pagination.pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pagination.pageSize)),
      summary: { total_billing: totalBilling.toFixed(2), deal_count: total },
    };
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
      syncBillingPeriod(row);
      await repo.save(row);
      const shares = body.creator_shares as SharePayload[] | undefined;
      if (shares?.length) await this.replaceShares(manager, row.id, shares);
      await refreshInvoiceCompletion(manager, row.id);
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
        syncBillingPeriod(row);
        await manager.getRepository(CommercialDeal).save(row);
        // When creator_shares is provided, it's the full replacement set;
        // an empty array clears any split.
        const shares = body.creator_shares as SharePayload[] | undefined;
        if (shares !== undefined && shares !== null) {
          await this.replaceShares(manager, row.id, shares);
        }
        await refreshInvoiceCompletion(manager, row.id);
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
