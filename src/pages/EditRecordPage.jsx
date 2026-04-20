import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FilePenLine, Info, PencilLine } from 'lucide-react'
import ExpenseForm from '../components/ExpenseForm'
import FormLayout from '../components/layouts/FormLayout'
import IncomeForm from '../components/IncomeForm'
import LoanForm from '../components/LoanForm'
import MaterialInvoiceForm from '../components/MaterialInvoiceForm'
import { AppButton } from '../components/ui/AppPrimitives'
import { formatCurrency } from '../lib/transaction-presentation'
import useAttendanceStore from '../store/useAttendanceStore'
import useTransactionStore from '../store/useTransactionStore'
import useIncomeStore from '../store/useIncomeStore'
import { useEffect, useState } from 'react'

function formatValue(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : '-'
}

function EditRecordPage() {
  const navigate = useNavigate()
  const { type, id } = useParams()
  const location = useLocation()
  const item = location.state?.item ?? location.state?.record ?? null
  const isCreateMode = id === 'new'
  const normalizedType = String(type ?? '').trim().toLowerCase()
  const fetchMaterialInvoiceById = useTransactionStore(
    (state) => state.fetchMaterialInvoiceById
  )
  const softDeleteExpense = useTransactionStore((state) => state.softDeleteExpense)
  const restoreExpense = useTransactionStore((state) => state.restoreExpense)
  const softDeleteMaterialInvoice = useTransactionStore(
    (state) => state.softDeleteMaterialInvoice
  )
  const restoreMaterialInvoice = useTransactionStore(
    (state) => state.restoreMaterialInvoice
  )
  const fetchAttendanceById = useAttendanceStore((state) => state.fetchAttendanceById)
  const softDeleteAttendanceRecord = useAttendanceStore(
    (state) => state.softDeleteAttendanceRecord
  )
  const restoreAttendanceRecord = useAttendanceStore(
    (state) => state.restoreAttendanceRecord
  )
  const fetchProjectIncomeById = useIncomeStore((state) => state.fetchProjectIncomeById)
  const fetchLoanById = useIncomeStore((state) => state.fetchLoanById)
  const [resolvedItem, setResolvedItem] = useState(item)
  const [isLoadingRecord, setIsLoadingRecord] = useState(false)
  const [recordError, setRecordError] = useState(null)

  const titleMap = {
    income: 'Pemasukan Proyek',
    'project-income': 'Pemasukan Proyek',
    expense: 'Pengeluaran',
    loan: 'Pinjaman',
    attendance: 'Absensi',
    bill: 'Tagihan',
  }
  const resolvedTitle = formatValue(titleMap[normalizedType] ?? type)

  const handleBack = () => {
    navigate(-1)
  }

  const handleFormSuccess = async () => {
    try {
      setRecordError(null)
    } catch (error) {
      console.error('Gagal memproses hasil simpan form:', error)
    }
  }

  const handleExpenseDelete = async () => {
    if (!resolvedItem?.id || resolvedItem.deleted_at) {
      return
    }

    const shouldDelete = window.confirm(`Hapus ${resolvedTitle}?`)

    if (!shouldDelete) {
      return
    }

    try {
      setRecordError(null)
      await softDeleteExpense(
        resolvedItem.id,
        resolvedItem.updated_at ?? resolvedItem.updatedAt ?? null
      )
      const nextRecord = await fetchMaterialInvoiceById(resolvedItem.id, {
        includeDeleted: true,
      })
      setResolvedItem(nextRecord)
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Gagal menghapus pengeluaran.')
    }
  }

  const handleExpenseRestore = async () => {
    if (!resolvedItem?.id || !resolvedItem.deleted_at) {
      return
    }

    try {
      setRecordError(null)
      await restoreExpense(
        resolvedItem.id,
        resolvedItem.updated_at ?? resolvedItem.updatedAt ?? null
      )
      const nextRecord = await fetchMaterialInvoiceById(resolvedItem.id, {
        includeDeleted: false,
      })
      setResolvedItem(nextRecord)
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Gagal memulihkan pengeluaran.')
    }
  }

  const handleMaterialInvoiceDelete = async () => {
    if (!resolvedItem?.id || resolvedItem.deleted_at) {
      return
    }

    const shouldDelete = window.confirm(`Hapus ${resolvedTitle}?`)

    if (!shouldDelete) {
      return
    }

    try {
      setRecordError(null)
      await softDeleteMaterialInvoice(
        resolvedItem.id,
        resolvedItem.updated_at ?? resolvedItem.updatedAt ?? null
      )
      const nextRecord = await fetchMaterialInvoiceById(resolvedItem.id, {
        includeDeleted: true,
      })
      setResolvedItem(nextRecord)
    } catch (error) {
      setRecordError(
        error instanceof Error ? error.message : 'Gagal menghapus faktur material.'
      )
    }
  }

  const handleMaterialInvoiceRestore = async () => {
    if (!resolvedItem?.id || !resolvedItem.deleted_at) {
      return
    }

    try {
      setRecordError(null)
      await restoreMaterialInvoice(
        resolvedItem.id,
        resolvedItem.updated_at ?? resolvedItem.updatedAt ?? null
      )
      const nextRecord = await fetchMaterialInvoiceById(resolvedItem.id, {
        includeDeleted: false,
      })
      setResolvedItem(nextRecord)
    } catch (error) {
      setRecordError(
        error instanceof Error ? error.message : 'Gagal memulihkan faktur material.'
      )
    }
  }

  const handleAttendanceDelete = async () => {
    if (!resolvedItem?.id || resolvedItem.deleted_at || resolvedItem.billing_status === 'billed') {
      return
    }

    const shouldDelete = window.confirm(`Hapus ${resolvedTitle}?`)

    if (!shouldDelete) {
      return
    }

    try {
      setRecordError(null)
      await softDeleteAttendanceRecord({
        attendanceId: resolvedItem.id,
        teamId: resolvedItem.team_id,
      })
      const nextRecord = await fetchAttendanceById(resolvedItem.id, { includeDeleted: true })
      setResolvedItem(nextRecord)
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Gagal menghapus absensi.')
    }
  }

  const handleAttendanceRestore = async () => {
    if (!resolvedItem?.id || !resolvedItem.deleted_at) {
      return
    }

    try {
      setRecordError(null)
      await restoreAttendanceRecord({
        attendanceId: resolvedItem.id,
        teamId: resolvedItem.team_id,
      })
      const nextRecord = await fetchAttendanceById(resolvedItem.id, { includeDeleted: true })
      setResolvedItem(nextRecord)
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Gagal memulihkan absensi.')
    }
  }

  useEffect(() => {
    let isActive = true

    if (isCreateMode) {
      setResolvedItem(item)
      setRecordError(null)
      setIsLoadingRecord(false)
      return () => {
        isActive = false
      }
    }

    if (
      item &&
      normalizedType !== 'expense' &&
      normalizedType !== 'attendance' &&
      !['income', 'project-income'].includes(normalizedType)
    ) {
      setResolvedItem(item)
      setRecordError(null)
      setIsLoadingRecord(false)
      return () => {
        isActive = false
      }
    }

    async function loadRecord() {
      setIsLoadingRecord(true)
      setRecordError(null)

      try {
        const nextRecord =
          normalizedType === 'project-income' || normalizedType === 'income'
            ? await fetchProjectIncomeById(id)
            : normalizedType === 'expense'
              ? await fetchMaterialInvoiceById(id, { includeDeleted: true })
              : normalizedType === 'attendance'
                ? await fetchAttendanceById(id, { includeDeleted: true })
              : normalizedType === 'loan'
              ? await fetchLoanById(id)
              : null

        if (!isActive) {
          return
        }

        setResolvedItem(nextRecord)
      } catch (error) {
        if (!isActive) {
          return
        }

        setResolvedItem(null)
        setRecordError(
          error instanceof Error ? error.message : 'Gagal memuat data edit.'
        )
      } finally {
        if (isActive) {
          setIsLoadingRecord(false)
        }
      }
    }

    void loadRecord()

    return () => {
      isActive = false
    }
  }, [
    fetchMaterialInvoiceById,
    fetchAttendanceById,
    fetchLoanById,
    fetchProjectIncomeById,
    id,
    isCreateMode,
    item,
    normalizedType,
  ])

  return (
    <FormLayout
      onBack={handleBack}
      title={`${isCreateMode ? 'Tambah' : 'Edit'} ${resolvedTitle}`}
    >
      <div className="space-y-4">
        <section className=" ">
          {!isCreateMode ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="app-card rounded-[20px] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Tipe
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                  {resolvedTitle}
                </p>
              </div>
              <div className="app-card rounded-[20px] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  ID
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                  {formatValue(id)}
                </p>
              </div>
              <div className="app-card rounded-[20px] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Status
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                  {isLoadingRecord
                    ? 'Memuat...'
                    : resolvedItem
                      ? normalizedType === 'attendance'
                        ? 'Siap dilihat'
                        : 'Siap diedit'
                      : 'Belum ditemukan'}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {isCreateMode && ['income', 'project-income'].includes(normalizedType) ? (
          <IncomeForm onSuccess={handleFormSuccess} />
        ) : null}

        {isCreateMode && normalizedType === 'expense' ? (
          <ExpenseForm onSuccess={handleFormSuccess} />
        ) : null}

        {isCreateMode && normalizedType === 'loan' ? (
          <LoanForm onSuccess={handleFormSuccess} />
        ) : null}

        {!isCreateMode &&
        ['income', 'project-income'].includes(normalizedType) &&
        resolvedItem ? (
          <div className="space-y-4">
            {resolvedItem.bill?.id ? (
              <section className="app-section-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Fee Bill Terkait
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {resolvedItem.bill.description || 'Bill fee pemasukan proyek'}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--app-tone-neutral-bg)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-tone-neutral-text)]">
                    {formatValue(resolvedItem.bill.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Nominal
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(resolvedItem.bill.amount ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Terbayar
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(resolvedItem.bill.paidAmount ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Sisa
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(resolvedItem.bill.remainingAmount ?? 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <AppButton
                    onClick={() =>
                      navigate(`/tagihan/${resolvedItem.bill.id}`, {
                        state: {
                          surface: 'tagihan',
                          detailSurface: 'tagihan',
                        },
                      })
                    }
                    type="button"
                    variant="secondary"
                  >
                    Buka Tagihan
                  </AppButton>
                </div>
              </section>
            ) : null}

            <IncomeForm
              initialData={resolvedItem}
              onSuccess={handleFormSuccess}
              recordId={resolvedItem.id}
            />
          </div>
        ) : null}

        {!isCreateMode && normalizedType === 'loan' && resolvedItem ? (
          <LoanForm
            initialData={resolvedItem}
            onSuccess={handleFormSuccess}
            recordId={resolvedItem.id}
          />
        ) : null}

        {!isCreateMode && normalizedType === 'attendance' && resolvedItem ? (
          <div className="space-y-4">
            <section className="app-section-surface p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Pekerja
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatValue(resolvedItem.worker_name_snapshot ?? resolvedItem.worker_name)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Proyek
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatValue(resolvedItem.project_name_snapshot ?? resolvedItem.project_name)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Tanggal
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatValue(resolvedItem.attendance_date)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Status Billing
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatValue(resolvedItem.billing_status)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Tagihan Gaji
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--app-text-color)]">
                  {resolvedItem.salary_bill_id
                    ? `Absensi ini sudah ditautkan ke tagihan gaji ${resolvedItem.salary_bill_id}.`
                    : 'Absensi ini belum ditautkan ke tagihan gaji.'}
                </p>
                {resolvedItem.salary_bill?.id ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[16px] bg-[var(--app-surface-low-color)] px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                        Status Bill
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                        {formatValue(resolvedItem.salary_bill.status)}
                      </p>
                    </div>
                    <div className="rounded-[16px] bg-[var(--app-surface-low-color)] px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                        Nominal
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                        {formatValue(resolvedItem.salary_bill.amount)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            {resolvedItem.billing_status === 'billed' ? (
              <section className="app-card-dashed p-4 text-sm leading-6 text-[var(--app-hint-color)]">
                Absensi yang sudah ditagihkan hanya bisa dilihat dari halaman ini. Perubahan
                data harus mengikuti tagihan gaji yang terkait agar relasinya tetap aman.
              </section>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {resolvedItem.salary_bill?.id ? (
                <AppButton
                  onClick={() =>
                    navigate(`/tagihan/${resolvedItem.salary_bill.id}`, {
                      state: {
                        surface: 'tagihan',
                        detailSurface: 'tagihan',
                      },
                    })
                  }
                  type="button"
                  variant="secondary"
                >
                  Buka Tagihan Gaji
                </AppButton>
              ) : null}

              {!resolvedItem.deleted_at && resolvedItem.billing_status !== 'billed' ? (
                <AppButton onClick={handleAttendanceDelete} type="button" variant="danger">
                  Hapus
                </AppButton>
              ) : null}

              {resolvedItem.deleted_at ? (
                <AppButton onClick={handleAttendanceRestore} type="button" variant="secondary">
                  Restore
                </AppButton>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isCreateMode &&
        normalizedType === 'expense' &&
        resolvedItem ? (
          <div className="space-y-4">
            <section className="app-section-surface p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Status Bill
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatValue(resolvedItem.bill?.status ?? 'tidak ada bill')}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Sisa Tagihan
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatValue(resolvedItem.bill?.remainingAmount ?? 0)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Lampiran
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {Array.isArray(resolvedItem.attachments)
                      ? `${resolvedItem.attachments.filter((attachment) => !attachment.deleted_at).length} aktif`
                      : '0 aktif'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {resolvedItem.bill?.id ? (
                  <AppButton
                    onClick={() =>
                      navigate(`/tagihan/${resolvedItem.bill.id}`, {
                        state: {
                          surface: 'tagihan',
                          detailSurface: 'tagihan',
                        },
                      })
                    }
                    type="button"
                    variant="secondary"
                  >
                    Buka Tagihan
                  </AppButton>
                ) : null}
                {Array.isArray(resolvedItem.attachments) ? (
                  <span className="rounded-full bg-[var(--app-tone-neutral-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-tone-neutral-text)]">
                    {resolvedItem.attachments.length} total lampiran
                  </span>
                ) : null}
              </div>
            </section>

            {['material', 'material_invoice'].includes(
              String(resolvedItem.expense_type ?? '').trim().toLowerCase()
            ) ? (
            <MaterialInvoiceForm
              key={resolvedItem.id}
              initialData={resolvedItem}
              onClose={handleBack}
              recordId={resolvedItem.id}
              onSuccess={handleFormSuccess}
            />
          ) : (
            <ExpenseForm
              key={resolvedItem.id}
              initialData={resolvedItem}
              onSuccess={handleFormSuccess}
            />
          )}

            <div className="grid gap-3 sm:grid-cols-2">
              {['material', 'material_invoice'].includes(
                String(resolvedItem.expense_type ?? '').trim().toLowerCase()
              ) ? (
                <>
                  {!resolvedItem.deleted_at ? (
                    <AppButton
                      onClick={handleMaterialInvoiceDelete}
                      type="button"
                      variant="danger"
                    >
                      Hapus
                    </AppButton>
                  ) : null}

                  {resolvedItem.deleted_at ? (
                    <AppButton
                      onClick={handleMaterialInvoiceRestore}
                      type="button"
                      variant="secondary"
                    >
                      Restore
                    </AppButton>
                  ) : null}
                </>
              ) : (
                <>
                  {!resolvedItem.deleted_at ? (
                    <AppButton onClick={handleExpenseDelete} type="button" variant="danger">
                      Hapus
                    </AppButton>
                  ) : null}

                  {resolvedItem.deleted_at ? (
                    <AppButton onClick={handleExpenseRestore} type="button" variant="secondary">
                      Restore
                    </AppButton>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}

        {!isCreateMode &&
        !['income', 'project-income', 'loan', 'expense'].includes(normalizedType) ? (
          <section className="app-section-surface p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
                <Info className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">Ringkasan Data</p>
                <p className="mt-1 text-sm leading-6 text-[var(--app-hint-color)]">
                  Tipe ini belum memiliki editor final, jadi sementara hanya tampil ringkasan data.
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2 text-sm text-[var(--app-hint-color)]">
              <p>
                <span className="font-medium">ID:</span> {formatValue(id)}
              </p>
              <p>
                <span className="font-medium">Tipe:</span> {formatValue(type)}
              </p>
              <p>
                <span className="font-medium">Nama:</span>{' '}
                {formatValue(
                  item?.title ??
                    item?.description ??
                    item?.category ??
                    item?.supplierName ??
                    item?.creditor_name_snapshot
                )}
              </p>
              <p>
                <span className="font-medium">Catatan:</span>{' '}
                {formatValue(item?.notes ?? item?.description)}
              </p>
            </div>
          </section>
        ) : null}

        {!isCreateMode && isLoadingRecord ? (
          <section className="app-section-surface p-4 text-sm text-[var(--app-hint-color)]">
            Memuat data edit...
          </section>
        ) : null}

        {!isCreateMode && recordError ? (
          <section className="app-card-dashed p-4 text-sm text-[var(--app-destructive-color)]">
            {recordError}
          </section>
        ) : null}

        {isCreateMode &&
        !['income', 'project-income', 'expense', 'loan'].includes(normalizedType) ? (
          <section className="app-section-surface p-4">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Tipe form belum dipetakan.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
              Route ini belum memiliki form create final untuk tipe `{formatValue(type)}`.
            </p>
          </section>
        ) : null}
      </div>
    </FormLayout>
  )
}

export default EditRecordPage
