import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import FormLayout from '../components/layouts/FormLayout'
import BrandLoader from '../components/ui/BrandLoader'
import {
  AppCard,
  AppCardStrong,
  AppErrorState,
  AppNominalInput,
  FormSection,
  PageHeader,
  PageShell,
  AppTechnicalGrid,
} from '../components/ui/AppPrimitives'
import { getAppTodayKey } from '../lib/date-time'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useIncomeStore from '../store/useIncomeStore'
import usePaymentStore from '../store/usePaymentStore'

function getUserDisplayName(user, authUser) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  if (user?.username) {
    return `@${user.username}`
  }

  if (authUser?.name) {
    return authUser.name
  }

  if (authUser?.telegram_user_id) {
    return authUser.telegram_user_id
  }

  return 'Pengguna Telegram'
}

function formatValue(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : '-'
}

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function getRemainingAmount(record) {
  const amount = Number(record?.remainingAmount ?? record?.remaining_amount)

  return Number.isFinite(amount) ? amount : 0
}

function getPaymentTotalAmount(record, isLoanPayment) {
  const amount = Number(
    isLoanPayment
      ? record?.repayment_amount ?? record?.repaymentAmount ?? record?.amount
      : record?.amount ?? record?.total_amount
  )

  return Number.isFinite(amount) ? amount : 0
}

function getPaymentPaidAmount(record) {
  const amount = Number(record?.paidAmount ?? record?.paid_amount)

  return Number.isFinite(amount) ? amount : 0
}

function createInitialForm(record) {
  const remainingAmount = getRemainingAmount(record)

  return {
    amount: remainingAmount > 0 ? String(remainingAmount) : '',
    paymentDate: getAppTodayKey(),
    notes: '',
  }
}

function isPayrollBillRecord(record) {
  return (
    String(record?.billType ?? record?.bill_type ?? '')
      .trim()
      .toLowerCase() === 'gaji'
  )
}

function getPaymentSummaryTitle(record, isLoanPayment) {
  if (isLoanPayment) {
    return formatValue(record?.creditor_name_snapshot ?? record?.creditorName ?? 'Pinjaman')
  }

  if (isPayrollBillRecord(record)) {
    return formatValue(
      record?.worker_name_snapshot ??
        record?.workerName ??
        record?.supplierName ??
        'Tagihan upah'
    )
  }

  return formatValue(
    record?.supplierName ??
      record?.supplier_name ??
      record?.supplier_name_snapshot ??
      'Tagihan'
  )
}

function getPaymentSummaryDescription(record, isLoanPayment) {
  if (isLoanPayment) {
    return 'Catat pelunasan pinjaman dari creditor yang sedang aktif.'
  }

  if (isPayrollBillRecord(record)) {
    return formatValue(
      record?.projectName ??
        record?.project_name ??
        record?.project_name_snapshot ??
        'Tagihan gaji aktif'
    )
  }

  const projectName = formatValue(
    record?.projectName ?? record?.project_name ?? record?.project_name_snapshot
  )

  return projectName === '-' ? 'Tagihan aktif siap dibayar.' : projectName
}

function PaymentPage({ paymentType = 'bill', technicalView = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const initialRecord = useMemo(
    () => location.state?.transaction ?? location.state?.bill ?? location.state?.record ?? null,
    [location.state]
  )
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const fetchBillById = useBillStore((state) => state.fetchBillById)
  const fetchLoanById = useIncomeStore((state) => state.fetchLoanById)
  const submitBillPayment = usePaymentStore((state) => state.submitBillPayment)
  const submitLoanPayment = usePaymentStore((state) => state.submitLoanPayment)
  const isSubmitting = usePaymentStore((state) => state.isSubmitting)
  const error = usePaymentStore((state) => state.error)
  const clearError = usePaymentStore((state) => state.clearError)
  const [record, setRecord] = useState(() => initialRecord)
  const [detailError, setDetailError] = useState(null)
  const [isLoadingRecord, setIsLoadingRecord] = useState(() => Boolean(id))
  const [formData, setFormData] = useState(() => createInitialForm(initialRecord))
  const isLoanPayment = paymentType === 'loan'
  const displayRecord = record ?? initialRecord ?? null
  const paymentSurface = useMemo(() => {
    const locationState = location.state ?? {}
    const stateSurface = String(
      locationState.surface ?? locationState.detailSurface ?? ''
    )
      .trim()
      .toLowerCase()

    if (stateSurface) {
      return stateSurface
    }

    const pathname = String(location.pathname ?? '').toLowerCase()

    if (pathname.startsWith('/tagihan')) {
      return 'tagihan'
    }

    if (pathname.startsWith('/pembayaran')) {
      return 'pembayaran'
    }

    return ''
  }, [location.pathname, location.state])
  const returnTo = useMemo(() => {
    const locationState = location.state ?? {}
    const normalizedReturnTo = String(locationState.returnTo ?? '').trim()

    return normalizedReturnTo.length > 0 ? normalizedReturnTo : null
  }, [location.state])
  const returnToOnSuccess = useMemo(() => {
    return Boolean(location.state?.returnToOnSuccess)
  }, [location.state])
  const pageTitle = isLoanPayment
    ? 'Pembayaran Pinjaman'
    : isPayrollBillRecord(displayRecord)
      ? 'Pembayaran Tagihan Upah'
      : 'Pembayaran Tagihan'
  const formId = 'payment-form'
  const userName = getUserDisplayName(null, authUser)
  const remainingAmount = getRemainingAmount(displayRecord)
  const combinedError = error ?? detailError
  const technicalRoute = isLoanPayment
    ? `/loan-payment/${id}/technical`
    : `/payment/${id}/technical`
  const technicalStatusLabel = isLoadingRecord
    ? 'Memuat...'
    : displayRecord
      ? String(displayRecord.status ?? 'unpaid')
      : 'Belum ditemukan'
  const technicalRows = [
    {
      key: 'mode',
      label: 'Mode',
      value: isLoanPayment ? 'loan-payment' : 'bill-payment',
    },
    {
      key: 'surface',
      label: 'Surface',
      value: formatValue(paymentSurface || 'default'),
    },
    {
      key: 'status',
      label: 'Status Mentah',
      value: formatValue(technicalStatusLabel),
    },
    {
      key: 'id',
      label: 'ID',
      value: formatValue(id),
    },
    {
      key: 'return-to',
      label: 'Return To',
      value: formatValue(returnTo ?? '-'),
    },
    {
      key: 'technical-route',
      label: 'Route Teknik',
      value: technicalRoute,
    },
  ]
  const backRoute = returnTo ?? (isLoanPayment ? '/transactions?tab=aktif' : '/transactions?tab=tagihan')

  useEffect(() => {
    setRecord(initialRecord)
    setFormData(createInitialForm(initialRecord))
    setDetailError(null)
    setIsLoadingRecord(Boolean(id))
  }, [id, initialRecord])

  const reloadRecord = useCallback(async () => {
    setIsLoadingRecord(true)
    setDetailError(null)

    try {
      const nextRecord = isLoanPayment ? await fetchLoanById(id) : await fetchBillById(id)

      if (nextRecord) {
        setRecord(nextRecord)
        setFormData(createInitialForm(nextRecord))
      }

      return nextRecord
    } catch (loadError) {
      setDetailError(
        loadError instanceof Error ? loadError.message : 'Gagal memuat detail pembayaran.'
      )
      return null
    } finally {
      setIsLoadingRecord(false)
    }
  }, [fetchBillById, fetchLoanById, id, isLoanPayment])

  useEffect(() => {
    void reloadRecord()
  }, [reloadRecord])

  useEffect(() => () => clearError(), [clearError])

  const handleBack = () => {
    navigate(backRoute)
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (combinedError) {
      clearError()
      setDetailError(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!record || isSubmitting) {
      return
    }

    try {
      if (isLoanPayment) {
        await submitLoanPayment({
          loan_id: record.id,
          telegram_user_id: authUser?.telegram_user_id ?? null,
          userName,
          team_id: currentTeamId ?? record.team_id,
          amount: formData.amount,
          maxAmount: remainingAmount,
          payment_date: formData.paymentDate,
          notes: formData.notes,
          creditorName: record.creditor_name_snapshot,
          remainingAmount: Math.max(remainingAmount - Number(formData.amount ?? 0), 0),
        })
      } else {
        await submitBillPayment({
          bill_id: record.id,
          telegram_user_id: authUser?.telegram_user_id ?? null,
          userName,
          team_id: currentTeamId ?? record.teamId,
          amount: formData.amount,
          maxAmount: remainingAmount,
          payment_date: formData.paymentDate,
          notes: formData.notes,
          supplierName: record.supplierName,
          projectName: record.projectName,
          remainingAmount: Math.max(remainingAmount - Number(formData.amount ?? 0), 0),
        })
      }

      if (returnToOnSuccess) {
        navigate(backRoute, { replace: true })
        return
      }

      await reloadRecord()
    } catch (submitError) {
      setDetailError(
        submitError instanceof Error ? submitError.message : 'Gagal menyimpan pembayaran.'
      )
    }
  }

  if (!displayRecord && isLoadingRecord) {
    return (
      <PageShell className="space-y-4">
        <PageHeader
          eyebrow={technicalView ? 'Owner' : 'Pembayaran'}
          title={pageTitle}
          backAction={handleBack}
        />

        <section className="grid min-h-[calc(100dvh-16rem)] place-items-center px-4 text-center">
          <div className="flex flex-col items-center gap-5">
            <BrandLoader context="form" size="hero" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                {technicalView
                  ? 'Memuat detail teknis pembayaran'
                  : 'Memuat detail pembayaran'}
              </h2>
              <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
                {technicalView
                  ? 'Menyiapkan data teknis.'
                  : 'Menyiapkan data tagihan.'}
              </p>
            </div>
          </div>
        </section>
      </PageShell>
    )
  }

  if (technicalView) {
    return (
      <PageShell>
        <PageHeader eyebrow="Owner" title={`Detail Teknis ${pageTitle}`} backAction={handleBack} />

        {detailError ? (
          <AppErrorState
            title="Detail teknis gagal dimuat"
            description={detailError}
          />
        ) : null}

        <AppCardStrong className="space-y-4">
          <AppTechnicalGrid items={technicalRows} />
        </AppCardStrong>
      </PageShell>
    )
  }

  return (
    <FormLayout
      actionLabel="Simpan Pembayaran"
      description={
        isLoanPayment
          ? 'Catat pembayaran pinjaman tanpa keluar dari halaman ini.'
          : 'Catat pembayaran tagihan tanpa keluar dari halaman ini.'
      }
      formId={formId}
      isSubmitting={isSubmitting}
      onBack={handleBack}
      submitDisabled={!record || isLoadingRecord}
      title={pageTitle}
    >
      {combinedError ? (
        <AppErrorState
          title="Pembayaran belum tersimpan"
          description={combinedError}
        />
      ) : null}

      {record ? (
        <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
          <FormSection
            eyebrow="Ringkasan"
            title={getPaymentSummaryTitle(record, isLoanPayment)}
            description={getPaymentSummaryDescription(record, isLoanPayment)}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <AppCard className="space-y-2 bg-white">
                <p className="app-meta">Total</p>
                <p className="text-lg font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(getPaymentTotalAmount(record, isLoanPayment))}
                </p>
              </AppCard>

              <AppCard className="space-y-2 bg-white">
                <p className="app-meta">Terbayar</p>
                <p className="text-lg font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(getPaymentPaidAmount(record))}
                </p>
              </AppCard>

              <AppCard className="space-y-2 bg-white">
                <p className="app-meta">Sisa</p>
                <p className="text-lg font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(remainingAmount)}
                </p>
              </AppCard>
            </div>
          </FormSection>

          <FormSection
            eyebrow="Pembayaran"
            title="Input pembayaran"
            description="Nominal maksimal mengikuti sisa yang masih belum dibayar."
          >
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                Nominal Pembayaran
              </span>
              <AppNominalInput
                className="app-input w-full rounded-[20px] px-4 py-4 text-xl font-bold"
                disabled={isLoadingRecord || !record}
                max={remainingAmount}
                name="amount"
                onValueChange={(nextValue) =>
                  handleChange({
                    target: {
                      name: 'amount',
                      value: nextValue,
                    },
                  })
                }
                required
                value={formData.amount}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Tanggal Pembayaran
                </span>
                <input
                  className="app-input w-full rounded-[20px] px-4 py-3.5 text-base"
                  disabled={isLoadingRecord || !record}
                  name="paymentDate"
                  onChange={handleChange}
                  required
                  type="date"
                  value={formData.paymentDate}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Catatan
                </span>
              <textarea
                className="app-input min-h-24 w-full resize-none rounded-[20px] px-4 py-3 text-base"
                disabled={isLoadingRecord || !record}
                name="notes"
                onChange={handleChange}
                placeholder="Tambahkan catatan pembayaran jika perlu"
                  value={formData.notes}
                />
              </label>
            </div>
          </FormSection>
        </form>
      ) : (
        <AppErrorState
          title={isLoanPayment ? 'Pinjaman tidak ditemukan' : 'Tagihan tidak ditemukan'}
          description="Data pembayaran tidak tersedia atau sudah berubah. Kembali ke daftar lalu buka ulang dari row terbaru."
        />
      )}
    </FormLayout>
  )
}

export default PaymentPage
