import { Controller, Get, Post, Patch, Body, Query, Param, BadRequestException, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';
import { TdsEntry } from '../entities/tds-entry.entity';
import { Creator } from '../entities/creator.entity';
import { D } from '../common/decimal';

@Controller('tds')
export class TdsController {
  constructor(private readonly dataSource: DataSource) {}

  @Roles('creator')
  @Get('creator-portal')
  async creatorPortalList(@Req() req: any) {
    const creatorId = req.user?.creatorId;
    if (!creatorId) {
      throw new BadRequestException('Your profile is not linked to any creator record.');
    }
    const repo = this.dataSource.getRepository(TdsEntry);
    const qb = repo.createQueryBuilder('tds')
      .leftJoinAndSelect('tds.creator', 'creator')
      .leftJoinAndSelect('tds.deal', 'deal')
      .andWhere('tds.creatorId = :creatorId', { creatorId })
      .orderBy('tds.createdAt', 'DESC');
    return qb.getMany();
  }

  @Roles('super_admin', 'accounts')
  @Get()
  async list(
    @Query('creatorId') creatorId?: string,
    @Query('status') status?: 'Pending' | 'Remitted',
  ) {
    const repo = this.dataSource.getRepository(TdsEntry);
    const qb = repo.createQueryBuilder('tds')
      .leftJoinAndSelect('tds.creator', 'creator')
      .leftJoinAndSelect('tds.deal', 'deal')
      .orderBy('tds.createdAt', 'DESC');

    if (creatorId) {
      qb.andWhere('tds.creatorId = :creatorId', { creatorId });
    }
    if (status) {
      qb.andWhere('tds.status = :status', { status });
    }

    return qb.getMany();
  }

  @Roles('super_admin', 'accounts')
  @Post()
  async create(
    @Body() body: {
      creatorId: string;
      dealId?: string | null;
      quarter: string;
      tdsRate: number; // e.g. 0.1000 for 10%
      grossAmount: number;
      notes?: string;
    }
  ) {
    const { creatorId, quarter, tdsRate, grossAmount } = body;
    if (!creatorId || !quarter || tdsRate === undefined || grossAmount === undefined) {
      throw new BadRequestException('creatorId, quarter, tdsRate, and grossAmount are required.');
    }

    const creatorRepo = this.dataSource.getRepository(Creator);
    const creatorExists = await creatorRepo.findOneBy({ id: creatorId });
    if (!creatorExists) {
      throw new BadRequestException('Creator not found.');
    }

    // Calculate TDS amount and net payable
    const gross = D(grossAmount);
    const rate = D(tdsRate);
    const tdsAmt = gross.mul(rate);
    const net = gross.sub(tdsAmt);

    const repo = this.dataSource.getRepository(TdsEntry);
    const entry = repo.create({
      creatorId,
      dealId: body.dealId || null,
      quarter,
      tdsRate: rate.toFixed(4),
      grossAmount: gross.toFixed(2),
      tdsAmount: tdsAmt.toFixed(2),
      netPayable: net.toFixed(2),
      status: 'Pending',
      notes: body.notes || '',
    });

    return repo.save(entry);
  }

  @Roles('super_admin', 'accounts')
  @Patch(':id')
  async updateRemittance(
    @Param('id') id: string,
    @Body() body: {
      remittanceDate: string;
      challanNumber: string;
      notes?: string;
    }
  ) {
    const { remittanceDate, challanNumber } = body;
    if (!remittanceDate || !challanNumber) {
      throw new BadRequestException('remittanceDate and challanNumber are required.');
    }

    const repo = this.dataSource.getRepository(TdsEntry);
    const entry = await repo.findOneBy({ id });
    if (!entry) {
      throw new BadRequestException('TDS entry not found.');
    }

    entry.remittanceDate = remittanceDate;
    entry.challanNumber = challanNumber;
    entry.status = 'Remitted';
    if (body.notes !== undefined) {
      entry.notes = body.notes;
    }

    return repo.save(entry);
  }
}
