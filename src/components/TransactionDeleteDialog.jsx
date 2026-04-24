import { AppButton, AppCardDashed, AppDialog } from './ui/AppPrimitives'

function TransactionDeleteDialog({
  open,
  title,
  description = null,
  warning = null,
  historyRoute = null,
  onClose,
  onConfirm,
  onOpenHistory,
  isConfirming = false,
  confirmLabel = 'Hapus',
  historyLabel = 'Buka Riwayat Tagihan',
}) {
  if (!open) {
    return null
  }

  const hasHistoryFallback = Boolean(historyRoute && onOpenHistory)

  return (
    <AppDialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        hasHistoryFallback ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton onClick={onClose} type="button" variant="secondary">
              Tutup
            </AppButton>
            <AppButton
              onClick={() => onOpenHistory(historyRoute)}
              type="button"
              variant="primary"
            >
              {historyLabel}
            </AppButton>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AppButton onClick={onClose} type="button" variant="secondary">
              Batal
            </AppButton>
            <AppButton
              disabled={isConfirming}
              onClick={onConfirm}
              type="button"
              variant="danger"
            >
              {isConfirming ? 'Menghapus...' : confirmLabel}
            </AppButton>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {warning ? (
          <p className="text-sm leading-6 text-[var(--app-hint-color)]">{warning}</p>
        ) : null}

        {hasHistoryFallback ? (
          <AppCardDashed className="px-4 py-4 text-sm leading-6 text-[var(--app-hint-color)]">
            Data ini sudah punya riwayat pembayaran. Buka tab riwayat tagihan untuk meninjau
            pembayaran sebelum memutuskan tindakan lain.
          </AppCardDashed>
        ) : null}
      </div>
    </AppDialog>
  )
}

export default TransactionDeleteDialog
