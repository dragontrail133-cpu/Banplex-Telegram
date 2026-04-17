import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FilePenLine, Info, PencilLine } from 'lucide-react'
import ExpenseForm from '../components/ExpenseForm'
import FormLayout from '../components/layouts/FormLayout'
import IncomeForm from '../components/IncomeForm'
import LoanForm from '../components/LoanForm'
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
    bill: 'Tagihan',
  }
  const resolvedTitle = formatValue(titleMap[normalizedType] ?? type)

  const handleBack = () => {
    navigate(-1)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate(-1)
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

    if (item) {
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
  }, [fetchLoanById, fetchProjectIncomeById, id, isCreateMode, item, normalizedType])

  return (
    <FormLayout
      actionLabel="Selanjutnya"
      onBack={handleBack}
      onSubmit={handleSubmit}
      submitDisabled={false}
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
                  {isLoadingRecord ? 'Memuat...' : resolvedItem ? 'Siap diedit' : 'Belum ditemukan'}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {isCreateMode && ['income', 'project-income'].includes(normalizedType) ? (
          <IncomeForm onSuccess={handleBack} />
        ) : null}

        {isCreateMode && normalizedType === 'expense' ? (
          <ExpenseForm onSuccess={handleBack} />
        ) : null}

        {isCreateMode && normalizedType === 'loan' ? (
          <LoanForm onSuccess={handleBack} />
        ) : null}

        {!isCreateMode &&
        ['income', 'project-income'].includes(normalizedType) &&
        resolvedItem ? (
          <IncomeForm
            initialData={resolvedItem}
            onSuccess={handleBack}
            recordId={resolvedItem.id}
          />
        ) : null}

        {!isCreateMode && normalizedType === 'loan' && resolvedItem ? (
          <LoanForm
            initialData={resolvedItem}
            onSuccess={handleBack}
            recordId={resolvedItem.id}
          />
        ) : null}

        {!isCreateMode &&
        !['income', 'project-income', 'loan'].includes(normalizedType) ? (
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
