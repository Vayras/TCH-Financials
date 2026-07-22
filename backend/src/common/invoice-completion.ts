import { DataSource, EntityManager } from 'typeorm';
import { todayISO } from './dates';
import { CommercialDeal, CreatorInvoice, DealDocument } from '../entities';

export async function refreshInvoiceCompletion(
  source: DataSource | EntityManager,
  dealId: string,
): Promise<void> {
  const dealRepo = source.getRepository(CommercialDeal);
  const deal = await dealRepo.findOne({ where: { id: dealId }, relations: ['creatorShares'] });
  if (!deal) return;

  const [documents, creatorInvoices] = await Promise.all([
    source.getRepository(DealDocument).find({ where: { dealId } }),
    source.getRepository(CreatorInvoice).find({ where: { dealId } }),
  ]);
  const hasClientInvoice = documents.some((document) => document.docType === 'ClientInvoice');
  const assignedCreatorIds = Array.from(new Set(
    (deal.creatorShares?.length
      ? deal.creatorShares.map((share) => share.creatorId)
      : [deal.creatorId]
    ).filter((id): id is string => !!id),
  ));
  const invoicedCreatorIds = new Set(creatorInvoices.map((invoice) => invoice.creatorId));
  const creatorsComplete = assignedCreatorIds.every((creatorId) => invoicedCreatorIds.has(creatorId));
  const complete = hasClientInvoice && creatorsComplete;

  let changed = false;
  const nextInvoiceReceived = complete ? 'Y' : 'N';
  if (deal.invoiceReceived !== nextInvoiceReceived) {
    deal.invoiceReceived = nextInvoiceReceived;
    changed = true;
  }
  if (complete && deal.campaignOver !== 'Y') {
    deal.campaignOver = 'Y';
    changed = true;
  }
  if (complete && !deal.completedAt) {
    deal.completedAt = todayISO();
    changed = true;
  } else if (!complete && deal.completedAt) {
    deal.completedAt = null;
    changed = true;
  }
  if (changed) {
    deal.version += 1;
    await dealRepo.save(deal);
  }
}
