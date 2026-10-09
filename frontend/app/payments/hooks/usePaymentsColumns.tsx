import * as React from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { type Deal, type DealDocument, type CreatorInvoice } from '@/lib/api';
import { inr, formatDocDate } from '@/lib/utils';
import { creatorLabel, creatorNamesOf } from '@/lib/deals';
import {
	clientPaymentDueDate,
	creatorPaymentDueDate,
	STATUS_LABEL,
	STATUS_TONE,
	type PaymentStatus
} from '@/lib/payments';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Tag from '@/components/ui/Tag';
import { InvoiceTag } from '../components/InvoiceTag';
import { type PaymentTransactionItem, type TdsEntryItem } from '../queries';

interface UsePaymentsColumnsOptions {
	activeTab: 'receivables' | 'payables' | 'utr' | 'tds';
	docsByDeal: Map<number, DealDocument[]>;
	creatorInvoicesByDeal: Map<number, CreatorInvoice[]>;
	statusOf: (deal: Deal) => PaymentStatus;
	startUpload: (deal: Deal) => void;
	setConfirmPaidDeal: (deal: Deal) => void;
	setTdsRemitItem: (item: TdsEntryItem) => void;
	setTdsRemitOpen: (open: boolean) => void;
}

export function usePaymentsColumns({
	activeTab,
	docsByDeal,
	creatorInvoicesByDeal,
	statusOf,
	startUpload,
	setConfirmPaidDeal,
	setTdsRemitItem,
	setTdsRemitOpen
}: UsePaymentsColumnsOptions) {
	const columns = React.useMemo<ColumnDef<Deal, unknown>[]>(
		() => {
			const entityColumn: ColumnDef<Deal, unknown> = activeTab === 'receivables' ? {
				id: 'brand',
				header: 'Brand',
				meta: { tdClassName: 'font-medium' },
				accessorFn: (r: Deal) => r.brand,
				cell: ({ row }) => row.original.brand || '—'
			} : {
				id: 'creator',
				header: 'Creator',
				meta: { tdClassName: 'font-medium' },
				accessorFn: (r: Deal) => creatorLabel(creatorNamesOf(r)),
				cell: ({ row }) => creatorLabel(creatorNamesOf(row.original)) || '—'
			};

			return [
				entityColumn,
				{
					accessorKey: 'campaign',
					header: 'Campaign',
					cell: ({ row }) => (
						<div>
							<div className="font-medium" style={{ color: 'var(--n-fg)' }}>
								{row.original.campaign || '—'}
							</div>
							<div className="text-[12px] truncate max-w-[250px]" style={{ color: 'var(--n-fg-subtle)' }}>
								{activeTab === 'receivables' ? creatorLabel(creatorNamesOf(row.original)) : row.original.brand}
							</div>
						</div>
					)
				},
				{
					id: 'amount',
					header: 'Amount',
					meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
					accessorFn: (r: Deal) => activeTab === 'receivables'
						? Number(r.client_invoice_amount || r.total_fee) || 0
						: Number(r.creator_invoice_amount || r.creator_fee) || 0,
					cell: ({ row }) => {
						const amt = activeTab === 'receivables'
							? row.original.client_invoice_amount || row.original.total_fee
							: row.original.creator_invoice_amount || row.original.creator_fee;
						const formatted = inr(Number(amt));
						return formatted ? `₹${formatted}` : '—';
					}
				},
				{
					id: 'invoices',
					header: 'Invoices',
					enableSorting: false,
					cell: ({ row }) => {
						const deal = row.original;
						const docsForDeal = docsByDeal.get(deal.id) ?? [];
						const clientDoc = docsForDeal.find((d) => d.doc_type === 'ClientInvoice');
						const creatorCount = creatorInvoicesByDeal.get(deal.id)?.length ?? 0;
						const requiredCount = deal.creator_shares?.length || (deal.creator ? 1 : 0);
						const received = deal.invoice_received === 'Y';

						if (activeTab === 'receivables') {
							return <InvoiceTag label="Client" doc={clientDoc} fallbackYes={received} />;
						} else {
							return (
								<div className="flex gap-1">
									<Tag tone={creatorCount >= requiredCount && requiredCount > 0 ? 'yes' : 'no'}>Creators {creatorCount}/{requiredCount}</Tag>
								</div>
							);
						}
					}
				},
				{
					id: 'due',
					header: 'Due',
					meta: { tdClassName: 'whitespace-nowrap', tdStyle: { color: 'var(--n-fg-muted)' } },
					accessorFn: (r: Deal) => activeTab === 'receivables' ? clientPaymentDueDate(r) : creatorPaymentDueDate(r),
					cell: ({ row }) => {
						const due = activeTab === 'receivables' ? clientPaymentDueDate(row.original) : creatorPaymentDueDate(row.original);
						return due ? formatDocDate(due) : '—';
					}
				},
				{
					id: 'status',
					header: 'Status',
					accessorFn: (r: Deal) => statusOf(r),
					cell: ({ row }) => {
						const status = statusOf(row.original);
						return <Tag tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Tag>;
					}
				},
				{
					id: 'actions',
					header: 'Actions',
					enableSorting: false,
					meta: { thClassName: 'w-[140px]', tdClassName: 'text-right' },
					cell: ({ row }) => {
						const deal = row.original;
						const status = statusOf(deal);
						const canMarkPaid = status === 'due_soon' || status === 'overdue' || status === 'upcoming';
						return (
							<div className="flex gap-2 justify-end">
								{activeTab === 'receivables' && (
									<Button variant="outline" size="sm" onClick={() => startUpload(deal)} title="Upload client invoice">
										<Icon name="upload" size={14} />
									</Button>
								)}
								{canMarkPaid && (
									<Button variant="primary" size="sm" onClick={() => setConfirmPaidDeal(deal)} title={activeTab === 'receivables' ? "Mark client paid" : "Mark creator paid"}>
										<Icon name="check" size={14} />
									</Button>
								)}
							</div>
						);
					}
				}
			];
		},
		[activeTab, docsByDeal, creatorInvoicesByDeal, statusOf, startUpload, setConfirmPaidDeal]
	);

	const utrColumns = React.useMemo<ColumnDef<PaymentTransactionItem, unknown>[]>(
		() => [
			{
				accessorKey: 'transactionDate',
				header: 'Date',
				cell: ({ row }) => <span className="tabular-nums">{row.original.transactionDate}</span>
			},
			{
				accessorKey: 'vendorName',
				header: 'Vendor / Partner',
				cell: ({ row }) => <span className="font-semibold">{row.original.vendorName}</span>
			},
			{
				accessorKey: 'utrOrRef',
				header: 'UTR / Ref No',
				cell: ({ row }) => <span className="text-[12px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{row.original.utrOrRef}</span>
			},
			{
				accessorKey: 'debitAmount',
				header: 'Debit (Paid Out)',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
				cell: ({ row }) => {
					const val = Number(row.original.debitAmount);
					return val > 0 ? <span className="text-red-600 font-medium">₹{inr(val)}</span> : <span className="text-gray-300">—</span>;
				}
			},
			{
				accessorKey: 'creditAmount',
				header: 'Credit (Received)',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
				cell: ({ row }) => {
					const val = Number(row.original.creditAmount);
					return val > 0 ? <span className="text-green-600 font-medium">₹{inr(val)}</span> : <span className="text-gray-300">—</span>;
				}
			},
			{
				accessorKey: 'notes',
				header: 'Notes',
				cell: ({ row }) => <span className="text-[12px] text-gray-500 truncate max-w-[200px]" title={row.original.notes}>{row.original.notes || '—'}</span>
			}
		],
		[]
	);

	const tdsColumns = React.useMemo<ColumnDef<TdsEntryItem, unknown>[]>(
		() => [
			{
				accessorKey: 'creator.name',
				header: 'Creator Name',
				cell: ({ row }) => <span className="font-semibold">{row.original.creator?.name || '—'}</span>
			},
			{
				accessorKey: 'quarter',
				header: 'Quarter',
				cell: ({ row }) => <span>{row.original.quarter}</span>
			},
			{
				accessorKey: 'grossAmount',
				header: 'Gross Amount',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums font-medium' },
				cell: ({ row }) => `₹${inr(Number(row.original.grossAmount))}`
			},
			{
				accessorKey: 'tdsRate',
				header: 'TDS Rate',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums' },
				cell: ({ row }) => `${(Number(row.original.tdsRate) * 100).toFixed(1)}%`
			},
			{
				accessorKey: 'tdsAmount',
				header: 'TDS Amount',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums text-amber-700 font-medium' },
				cell: ({ row }) => `₹${inr(Number(row.original.tdsAmount))}`
			},
			{
				accessorKey: 'netPayable',
				header: 'Net Payable',
				meta: { thClassName: 'text-right', tdClassName: 'text-right tabular-nums font-bold' },
				cell: ({ row }) => `₹${inr(Number(row.original.netPayable))}`
			},
			{
				accessorKey: 'status',
				header: 'Status',
				cell: ({ row }) => (
					<Tag tone={row.original.status === 'Remitted' ? 'yes' : 'no'}>
						{row.original.status}
					</Tag>
				)
			},
			{
				accessorKey: 'challanNumber',
				header: 'Challan Info',
				cell: ({ row }) => {
					const item = row.original;
					return item.status === 'Remitted' ? (
						<div className="text-[11.5px] leading-tight">
							<div className="font-medium text-gray-900">{item.challanNumber}</div>
							<div className="text-gray-400">{item.remittanceDate}</div>
						</div>
					) : <span className="text-gray-400">—</span>;
				}
			},
			{
				id: 'actions',
				header: 'Actions',
				meta: { tdClassName: 'text-right' },
				cell: ({ row }) => {
					const item = row.original;
					return item.status === 'Pending' ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setTdsRemitItem(item);
								setTdsRemitOpen(true);
							}}
						>
							<Icon name="check" size={13} /> Remit
						</Button>
					) : null;
				}
			}
		],
		[setTdsRemitItem, setTdsRemitOpen]
	);

	return { columns, utrColumns, tdsColumns };
}
