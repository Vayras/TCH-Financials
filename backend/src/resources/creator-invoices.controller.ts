import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException, ConflictException, Controller, Delete, Get, HttpCode,
  NotFoundException, Param, Patch, Post, Put, Query, Body, UploadedFile,
  UseInterceptors, Req,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { D } from '../common/decimal';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { creatorInvoiceDto } from '../common/serializers';
import { refreshInvoiceCompletion } from '../common/invoice-completion';
import { env } from '../env';
import { CommercialDeal, Creator, CreatorInvoice, DealDocument } from '../entities';
import { privateFile, removePrivateFile } from '../common/private-file';
import { UPLOAD_LIMITS, validateUpload } from '../common/uploads';
import { optionalDate, optionalEnum, optionalMoney } from '../common/integrity';

const PAYMENT_STATUSES = ['', 'Pending', 'Scheduled', 'Paid', 'Overdue'];
const PAYMENT_CYCLES = ['', 'Immediate', 'Net15', 'Net30', 'Net45', 'Net60'];
const RELATIONS = ['creator', 'deal', 'deal.campaign'];

function cleanFilename(original: string): string {
  return path.basename(original || 'invoice').replace(/[^\w.\-()+ ]+/g, '_') || 'invoice';
}

function storeUpload(dealId: string, creatorId: string, file: Express.Multer.File): string {
  const safeName = cleanFilename(file.originalname);
  const dir = path.join(env.mediaRoot, 'creator_invoices', dealId, creatorId);
  fs.mkdirSync(dir, { recursive: true });
  let name = safeName;
  let attempt = 0;
  while (fs.existsSync(path.join(dir, name))) {
    attempt += 1;
    const ext = path.extname(safeName);
    name = `${path.basename(safeName, ext)}_${attempt}${ext}`;
  }
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return path.posix.join('creator_invoices', dealId, creatorId, name);
}

function applyMetadata(invoice: CreatorInvoice, body: Record<string, string>): void {
  if ('invoice_number' in body) invoice.invoiceNumber = body.invoice_number.trim().slice(0, 120);
  if ('invoice_date' in body) {
    invoice.invoiceDate = optionalDate(body.invoice_date, 'invoice_date') ?? null;
  }
  if ('invoice_amount' in body) {
    invoice.invoiceAmount = optionalMoney(body.invoice_amount, 'invoice_amount')!;
  }
  if ('payment_status' in body) {
    invoice.paymentStatus = optionalEnum(body.payment_status, 'payment_status', PAYMENT_STATUSES)!;
  }
  if ('payment_cycle' in body) {
    invoice.paymentCycle = optionalEnum(body.payment_cycle, 'payment_cycle', PAYMENT_CYCLES)!;
  }
  if ('payment_date' in body) {
    invoice.paymentDate = optionalDate(body.payment_date, 'payment_date') ?? null;
  }
  if ('label' in body) invoice.label = body.label.trim().slice(0, 200);
}

@Roles('super_admin', 'accounts', 'tch_member')
@Controller('creator-invoices')
export class CreatorInvoicesController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private repo() { return this.dataSource.getRepository(CreatorInvoice); }
  private dealRepo() { return this.dataSource.getRepository(CommercialDeal); }

  private async serialize(id: string) {
    const row = await this.repo().findOne({ where: { id }, relations: RELATIONS });
    if (!row) throw new NotFoundException({ detail: 'Creator invoice not found.' });
    return creatorInvoiceDto(row);
  }

  private async requireAssignment(dealId: string, creatorId: string): Promise<void> {
    const [deal, creator] = await Promise.all([
      this.dealRepo().findOne({ where: { id: dealId }, relations: ['creatorShares'] }),
      this.dataSource.getRepository(Creator).findOneBy({ id: creatorId }),
    ]);
    if (!deal) throw new BadRequestException({ deal: ['Campaign not found.'] });
    if (!creator) throw new BadRequestException({ creator: ['Creator not found.'] });
    const assignedIds = deal.creatorShares?.length
      ? deal.creatorShares.map((share) => share.creatorId).filter(Boolean)
      : [deal.creatorId].filter(Boolean);
    if (!assignedIds.includes(creatorId)) {
      throw new BadRequestException({ creator: ['This creator is not assigned to the campaign.'] });
    }
  }

  @Get()
  async list(@Query('deal') deal?: string, @Query('creator') creator?: string) {
    const qb = this.repo().createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.creator', 'creatorRow')
      .leftJoinAndSelect('invoice.deal', 'dealRow')
      .leftJoinAndSelect('dealRow.campaign', 'campaign')
      .orderBy('invoice.uploadedAt', 'DESC');
    if (deal) qb.andWhere('invoice.dealId = :deal', { deal });
    if (creator) qb.andWhere('invoice.creatorId = :creator', { creator });
    return (await qb.getMany()).map(creatorInvoiceDto);
  }

  @Roles('creator')
  @Get('creator-portal')
  async creatorPortalList(@Req() req: any) {
    const creatorId = req.user?.creatorId;
    if (!creatorId) {
      throw new BadRequestException('Your profile is not linked to any creator record.');
    }
    const qb = this.repo().createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.creator', 'creatorRow')
      .leftJoinAndSelect('invoice.deal', 'dealRow')
      .leftJoinAndSelect('dealRow.campaign', 'campaign')
      .andWhere('invoice.creatorId = :creatorId', { creatorId })
      .orderBy('invoice.uploadedAt', 'DESC');
    return (await qb.getMany()).map(creatorInvoiceDto);
  }

  @Roles('creator')
  @Post('creator-portal')
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_LIMITS }))
  async creatorPortalCreate(@Req() req: any, @Body() body: Record<string, string>, @UploadedFile() file?: Express.Multer.File) {
    const creatorId = req.user?.creatorId;
    if (!creatorId) {
      throw new BadRequestException('Your profile is not linked to any creator record.');
    }
    if (!body.deal) {
      throw new BadRequestException({ deal: ['Campaign is required.'] });
    }
    validateUpload(file, 'Choose an invoice file to upload.');
    await this.requireAssignment(body.deal, creatorId);

    const existing = await this.repo().findOneBy({ dealId: body.deal, creatorId });
    if (existing) {
      throw new ConflictException({ detail: 'You have already submitted an invoice for this campaign.' });
    }

    const row = this.repo().create({
      dealId: body.deal,
      creatorId,
      invoiceNumber: (body.invoice_number || '').trim().slice(0, 120),
      paymentStatus: 'Pending',
      label: `Creator Invoice — ${file.originalname}`,
    });
    applyMetadata(row, body);
    row.paymentStatus = 'Pending';
    row.file = storeUpload(body.deal, creatorId, file);

    try {
      await this.repo().save(row);
    } catch (error) {
      fs.rmSync(path.join(env.mediaRoot, row.file), { force: true });
      throw error;
    }
    await refreshInvoiceCompletion(this.dataSource, row.dealId);
    return this.serialize(row.id);
  }

  @Get(':id')
  retrieve(@Param('id') id: string) { return this.serialize(id); }

  @Roles('super_admin', 'accounts', 'tch_member', 'creator')
  @Get(':id/download')
  async download(@Param('id') id: string, @Req() req: any) {
    const row = await this.repo().findOneBy({ id });
    if (!row) throw new NotFoundException({ detail: 'Creator invoice not found.' });
    if (req.user?.role === 'creator' && String(req.user?.creatorId ?? '') !== String(row.creatorId)) {
      throw new NotFoundException({ detail: 'Creator invoice not found.' });
    }
    return privateFile(row.file, row.label || path.basename(row.file));
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_LIMITS }))
  async create(@Body() body: Record<string, string>, @UploadedFile() file?: Express.Multer.File) {
    if (!body.deal) throw new BadRequestException({ deal: ['Campaign is required.'] });
    if (!body.creator) throw new BadRequestException({ creator: ['Creator is required.'] });
    validateUpload(file, 'Choose an invoice file to upload.');
    await this.requireAssignment(body.deal, body.creator);
    if (await this.repo().findOneBy({ dealId: body.deal, creatorId: body.creator })) {
      throw new ConflictException({ detail: 'This creator already has an invoice for the campaign. Use Replace instead.' });
    }
    const row = this.repo().create({ dealId: body.deal, creatorId: body.creator });
    applyMetadata(row, body);
    row.label ||= `Creator Invoice — ${file.originalname}`;
    row.file = storeUpload(body.deal, body.creator, file);
    try {
      await this.repo().save(row);
    } catch (error) {
      fs.rmSync(path.join(env.mediaRoot, row.file), { force: true });
      throw error;
    }
    await refreshInvoiceCompletion(this.dataSource, row.dealId);
    return this.serialize(row.id);
  }

  @Put(':id')
  @Patch(':id')
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_LIMITS }))
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const row = await this.repo().findOneBy({ id });
    if (!row) throw new NotFoundException({ detail: 'Creator invoice not found.' });
    const version = Number(body.version);
    if (!Number.isInteger(version) || version !== row.version) {
      throw new ConflictException({ detail: 'This invoice changed since it was opened. Refresh and try again.' });
    }
    if (file) validateUpload(file);
    applyMetadata(row, body);
    const oldFile = row.file;
    const newFile = file ? storeUpload(row.dealId, row.creatorId, file) : null;
    if (newFile) {
      row.file = newFile;
      row.label = body.label?.trim().slice(0, 200) || `Creator Invoice — ${file!.originalname}`;
    }
    row.version += 1;
    try {
      await this.repo().save(row);
    } catch (error) {
      if (newFile) fs.rmSync(path.join(env.mediaRoot, newFile), { force: true });
      throw error;
    }
    await refreshInvoiceCompletion(this.dataSource, row.dealId);
    if (newFile && oldFile && !(await this.isLegacyFile(oldFile))) {
      removePrivateFile(oldFile);
    }
    return this.serialize(row.id);
  }

  private async isLegacyFile(file: string): Promise<boolean> {
    return this.dataSource.getRepository(DealDocument).exists({ where: { file } });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Query('version') versionRaw?: string) {
    const row = await this.repo().findOneBy({ id });
    if (!row) throw new NotFoundException({ detail: 'Creator invoice not found.' });
    const version = Number(versionRaw);
    if (!Number.isInteger(version) || version !== row.version) {
      throw new ConflictException({ detail: 'This invoice changed since it was opened. Refresh and try again.' });
    }
    await this.repo().delete({ id });
    await refreshInvoiceCompletion(this.dataSource, row.dealId);
    if (row.file && !(await this.isLegacyFile(row.file))) {
      removePrivateFile(row.file);
    }
  }
}
