import { ReceiptText } from 'lucide-react'
import { AppCardDashed, AppCardStrong } from './ui/AppPrimitives'
import { formatAppDateLabel } from '../lib/date-time'
import {
  formatCurrency,
  hasMeaningfulText,
  shouldHideTransactionAmount,
} from '../lib/transaction-presentation'
import {
  formatMaterialInvoiceBillStatusLabel,
  formatMaterialInvoiceDocumentLabel,
} from '../lib/material-invoice'

function normalizeText(value, fallback = '-') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getItemTotal(item = {}) {
  const directTotal = Number(
    item?.line_total ?? item?.lineTotal ?? item?.subtotal ?? item?.total_price ?? item?.totalPrice
  )

  if (Number.isFinite(directTotal)) {
    return directTotal
  }

  const qty = Number(item?.qty)
  const unitPrice = Number(item?.unit_price ?? item?.unitPrice)

  if (Number.isFinite(qty) && Number.isFinite(unitPrice)) {
    return qty * unitPrice
  }

  return 0
}

function DetailField({ label, value }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
        {label}
      </p>
      <p className="text-sm font-semibold leading-6 text-[var(--app-text-color)]">{value}</p>
    </div>
  )
}

function MaterialInvoiceDetailPanel({
  billDetail = null,
  error = null,
  invoice = null,
  isLoading = false,
}) {
  if (error && !invoice) {
    return (
      <AppCardDashed className="px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
        {error}
      </AppCardDashed>
    )
  }

  if (isLoading && !invoice) {
    return (
      <AppCardDashed className="px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
        Memuat rincian faktur...
      </AppCardDashed>
    )
  }

  if (!invoice) {
    return (
      <AppCardDashed className="px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
        Rincian faktur belum tersedia.
      </AppCardDashed>
    )
  }

  const items = Array.isArray(invoice.items) ? invoice.items : []
  const documentLabel = formatMaterialInvoiceDocumentLabel(invoice.document_type)
  const hideAmount = shouldHideTransactionAmount(invoice)
  const billStatusLabel = formatMaterialInvoiceBillStatusLabel(
    billDetail?.status ?? invoice.bill?.status ?? invoice.status
  )
  const summaryCreatedAt = formatAppDateLabel(
    invoice.expense_date ?? invoice.created_at ?? invoice.updated_at
  )
  const summaryTotalAmount = Number(invoice.amount ?? invoice.total_amount ?? 0)
  const summaryPaidAmount = Number(
    billDetail?.paid_amount ??
      billDetail?.paidAmount ??
      invoice.bill?.paid_amount ??
      invoice.bill?.paidAmount ??
      0
  )
  const summaryRemainingAmount = Number(
    billDetail?.remaining_amount ??
      billDetail?.remainingAmount ??
      invoice.bill?.remaining_amount ??
      invoice.bill?.remainingAmount ??
      0
  )

  return (
    <AppCardStrong className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
          <ReceiptText className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
            Rincian {documentLabel}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--app-hint-color)]">
            {summaryCreatedAt}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="app-chip">{billStatusLabel}</span>
          <span className="app-chip">{items.length} item</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-[24px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] p-4 sm:grid-cols-2">
        <DetailField
          label="Proyek"
          value={normalizeText(invoice.project_name_snapshot ?? invoice.project_name, '-')}
        />
        <DetailField
          label="Supplier"
          value={normalizeText(invoice.supplier_name_snapshot ?? invoice.supplier_name, '-')}
        />
        <DetailField
          label="Tanggal"
          value={formatAppDateLabel(invoice.expense_date ?? invoice.created_at)}
        />
        {!hideAmount ? <DetailField label="Nominal" value={formatCurrency(summaryTotalAmount)} /> : null}
        {!hideAmount ? <DetailField label="Sudah Dibayar" value={formatCurrency(summaryPaidAmount)} /> : null}
        {!hideAmount ? <DetailField label="Sisa Tagihan" value={formatCurrency(summaryRemainingAmount)} /> : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="app-kicker">Item Faktur</p>
            <h3 className="app-section-title">Rincian Material</h3>
          </div>
          <span className="app-chip">{items.length} item</span>
        </div>

        {items.length > 0 ? (
          <div className="overflow-hidden rounded-[24px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)]">
            {items.map((item, index) => {
              const itemTotal = getItemTotal(item)

              return (
                <div
                  key={item.id ?? `${item.sort_order}-${item.item_name}-${index}`}
                  className="flex items-start justify-between gap-3 border-b border-[var(--app-border-color)] px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--app-text-color)]">
                      {normalizeText(item.item_name, 'Item')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                      Qty {normalizeText(item.qty, '-')} · Urutan {normalizeText(item.sort_order, '-')}
                    </p>
                    {hasMeaningfulText(normalizeText(item.notes, '')) ? (
                      <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                        {normalizeText(item.notes, '')}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="app-chip">Harga {formatCurrency(item.unit_price ?? 0)}</span>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(itemTotal)}
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <AppCardDashed className="px-4 py-5 text-sm text-[var(--app-hint-color)]">
            Item faktur belum tersedia.
          </AppCardDashed>
        )}
      </div>
    </AppCardStrong>
  )
}

export default MaterialInvoiceDetailPanel
