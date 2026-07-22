import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException, ConflictException, Controller, Delete, Get, HttpCode,
  NotFoundException, Param, Patch, Post, Put, Query, Body, UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { creatorInvoiceDto } from '../common/serializers';
import { refreshInvoiceCompletion } from '../common/invoice-completion';
import { env } from '../env';
import { CommercialDeal, Creator, CreatorInvoice, DealDocument } from '../entities';

const PAYMENT_STATUSES = ['', 'Pending', 'Scheduled', 'Paid', 'Overdue'];
const PAYMENT_CYCLES = ['', 'Immediate', 'Net15', 'Net30', 'Net45', 'Net60'];
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
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

function validateFile(file?: Express.Multer.File): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException({ file: ['Choose an invoice file to upload.'] });
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new BadRequestException({ file: ['Upload a PDF, JPEG, PNG, or WebP file.'] });
  }
}

function applyMetadata(invoice: CreatorInvoice, body: Record<string, string>): void {
  if ('invoice_number' in body) invoice.invoiceNumber = body.invoice_number.trim().slice(0, 120);
  if ('invoice_date' in body) {
    if (body.invoice_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.invoice_date)) {
      throw new BadRequestException({ invoice_date: ['Use YYYY-MM-DD format.'] });
    }
    invoice.invoiceDate = body.invoice_date || null;
  }
  if ('invoice_amount' in body) {
    const amount = Number(body.invoice_amount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException({ invoice_amount: ['Enter a valid non-negative amount.'] });
    }
    invoice.invoiceAmount = amount.toFixed(2);
  }
  if ('payment_status' in body) {
    if (!PAYMENT_STATUSES.includes(body.payment_status)) {
      throw new BadRequestException({ payment_status: [`Use one of: ${PAYMENT_STATUSES.filter(Boolean).join(', ')}.`] });
    }
    invoice.paymentStatus = body.payment_status;
  }
  if ('payment_cycle' in body) {
    if (!PAYMENT_CYCLES.includes(body.payment_cycle)) {
      throw new BadRequestException({ payment_cycle: [`Use one of: ${PAYMENT_CYCLES.filter(Boolean).join(', ')}.`] });
    }
    invoice.paymentCycle = body.payment_cycle;
  }
  if ('payment_date' in body) {
    if (body.payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.payment_date)) {
      throw new BadRequestException({ payment_date: ['Use YYYY-MM-DD format.'] });
    }
    invoice.paymentDate = body.payment_date || null;
  }
  if ('label' in body) invoice.label = body.label.trim().slice(0, 200);
}

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

  @Get(':id')
  retrieve(@Param('id') id: string) { return this.serialize(id); }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  async create(@Body() body: Record<string, string>, @UploadedFile() file?: Express.Multer.File) {
    if (!body.deal) throw new BadRequestException({ deal: ['Campaign is required.'] });
    if (!body.creator) throw new BadRequestException({ creator: ['Creator is required.'] });
    validateFile(file);
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
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
    if (file) validateFile(file);
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
      fs.rm(path.join(env.mediaRoot, oldFile), { force: true }, () => undefined);
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
      fs.rm(path.join(env.mediaRoot, row.file), { force: true }, () => undefined);
    }
  }
}
