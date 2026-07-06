import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch,
  Post, Put,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { applyMapped, rethrowUnique } from '../common/apply';
import { campaignDto } from '../common/serializers';
import { versionedUpdate } from '../common/versioned-update';
import { Campaign, CommercialDeal } from '../entities';

const FIELDS = {
  name: 'name',
  brand: 'brand',
  status: 'status',
  start_date: 'startDate',
  end_date: 'endDate',
  notes: 'notes',
};

// A campaign is Over once every deal on it is marked campaign_over.
// Recomputed whenever a deal is created/updated (see DealsController).
export async function refreshCampaignStatus(
  manager: EntityManager,
  campaignId: string | null,
): Promise<void> {
  if (!campaignId) return;
  const campaign = await manager.getRepository(Campaign).findOneBy({ id: campaignId });
  if (!campaign) return;
  const deals = await manager.getRepository(CommercialDeal).find({
    where: { campaignId },
    select: ['id', 'campaignOver'],
  });
  const newStatus =
    deals.length && deals.every((d) => d.campaignOver === 'Y') ? 'Over' : 'Active';
  if (newStatus !== campaign.status) {
    await manager.getRepository(Campaign).update({ id: campaignId }, { status: newStatus });
  }
}

@Controller('campaigns')
export class CampaignsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private repo(manager?: EntityManager) {
    return (manager ?? this.dataSource).getRepository(Campaign);
  }

  private async dealCounts(manager?: EntityManager): Promise<Map<string, number>> {
    const rows: Array<{ campaign_id: string; n: string }> = await (
      manager ?? this.dataSource
    ).query(
      'SELECT campaign_id, count(*) AS n FROM tch_commercialdeal WHERE campaign_id IS NOT NULL GROUP BY campaign_id',
    );
    return new Map(rows.map((r) => [String(r.campaign_id), Number(r.n)]));
  }

  private async serialize(id: string, manager?: EntityManager) {
    const row = await this.repo(manager).findOneBy({ id });
    if (!row) throw new NotFoundException({ detail: 'Not found.' });
    const counts = await this.dealCounts(manager);
    return campaignDto(row, counts.get(String(row.id)) ?? 0);
  }

  @Get()
  async list() {
    const [rows, counts] = await Promise.all([
      this.repo().find({ order: { name: 'ASC' } }),
      this.dealCounts(),
    ]);
    return rows.map((c) => campaignDto(c, counts.get(String(c.id)) ?? 0));
  }

  @Get(':id')
  retrieve(@Param('id') id: string) {
    return this.serialize(id);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: Record<string, unknown>) {
    const row = this.repo().create();
    applyMapped(row as unknown as Record<string, unknown>, body, FIELDS);
    try {
      await this.repo().save(row);
    } catch (err) {
      rethrowUnique(err, 'name');
    }
    return this.serialize(row.id);
  }

  @Put(':id')
  replace(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.update(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return versionedUpdate(this.dataSource, Campaign, id, body, {
      apply: (row) => applyMapped(row as unknown as Record<string, unknown>, body, FIELDS),
      serialize: (rowId, manager) => this.serialize(rowId, manager),
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const res = await this.repo().delete({ id });
    if (!res.affected) throw new NotFoundException({ detail: 'Not found.' });
  }
}
