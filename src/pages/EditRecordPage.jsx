import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ExpenseForm from '../components/ExpenseForm'
import FormLayout from '../components/layouts/FormLayout'
import IncomeForm from '../components/IncomeForm'
import LoanForm from '../components/LoanForm'
import MaterialInvoiceForm from '../components/MaterialInvoiceForm'
import TagihanUpahForm from '../components/TagihanUpahForm'
import TransactionDeleteDialog from '../components/TransactionDeleteDialog'
import BrandLoader from '../components/ui/BrandLoader'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppErrorState,
  AppNominalInput,
  AppToggleGroup,
  AppTextarea,
  AppViewportSafeArea,
  PageHeader,
  PageShell,
  AppTechnicalGrid,
} from '../components/ui/AppPrimitives'
import { resolveFormBackRoute } from '../lib/form-shell'
import { getMaterialInvoiceDeleteBlockReason, isMaterialInvoiceExpense } from '../lib/material-invoice'
import { formatCurrency } from '../lib/transaction-presentation'
import {
  getTransactionDeleteHistoryRoute,
  hasTransactionPaymentHistory,
} from '../lib/transaction-delete'
import {
  calculateAttendanceTotalPay,
  deriveAttendanceBaseWage,
  deriveAttendanceOvertimeFee,
  getAllowedAttendanceStatusValues,
  getAttendanceDayWeight,
} from '../lib/attendance-payroll'
import { fetchAttendanceHistoryFromApi } from '../lib/records-api'
import useAttendanceStore from '../store/useAttendanceStore'
import useMasterStore from '../store/useMasterStore'
import useTransactionStore from '../store/useTransactionStore'
import useIncomeStore from '../store/useIncomeStore'
import { useEffect, useMemo, useState } from 'react'

function formatValue(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : '-'
}

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getWorkerRate(workerId, projectId, workerWageRates = []) {
  const exactRate =
    workerWageRates.find(
      (rate) => rate.worker_id === workerId && rate.project_id === projectId
    ) ?? null

  if (exactRate) {
    return exactRate
  }

  const defaultRate =
    workerWageRates.find(
      (rate) => rate.worker_id === workerId && Boolean(rate.is_default)
    ) ?? null

  if (defaultRate) {
    return defaultRate
  }

  return workerWageRates.find((rate) => rate.worker_id === workerId) ?? null
}

function EditRecordPage({ technicalView = false }) {
  const navigate = useNavigate()
  const { type, id } = useParams()
  const location = useLocation()
  const item = location.state?.item ?? location.state?.record ?? null
  const isCreateMode = id === 'new'
  const normalizedType = String(type ?? '').trim().toLowerCase()
  const isLoanEditMode = !isCreateMode && normalizedType === 'loan'
  const fetchMaterialInvoiceById = useTransactionStore(
    (state) => state.fetchMaterialInvoiceById
  )
  const softDeleteExpense = useTransactionStore((state) => state.softDeleteExpense)
  const restoreExpense = useTransactionStore((state) => state.restoreExpense)
  const softDeleteMaterialInvoice = useTransactionStore(
    (state) => state.softDeleteMaterialInvoice
  )
  const fetchAttendanceById = useAttendanceStore((state) => state.fetchAttendanceById)
  const attendanceStatusOptions = useAttendanceStore(
    (state) => state.attendanceStatusOptions
  )
  const updateAttendanceRecord = useAttendanceStore(
    (state) => state.updateAttendanceRecord
  )
  const softDeleteAttendanceRecord = useAttendanceStore(
    (state) => state.softDeleteAttendanceRecord
  )
  const restoreAttendanceRecord = useAttendanceStore(
    (state) => state.restoreAttendanceRecord
  )
  const workerWageRates = useMasterStore((state) => state.workerWageRates)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const fetchProjectIncomeById = useIncomeStore((state) => state.fetchProjectIncomeById)
  const fetchLoanById = useIncomeStore((state) => state.fetchLoanById)
  const [resolvedItem, setResolvedItem] = useState(item)
  const [isLoadingRecord, setIsLoadingRecord] = useState(() => isLoanEditMode)
  const [recordError, setRecordError] = useState(null)
  const [attendanceEditState, setAttendanceEditState] = useState({
    attendanceStatus: '',
    notes: '',
    overtimeFee: '',
  })
  const [attendanceDayHistory, setAttendanceDayHistory] = useState([])
  const [isAttendanceSaving, setIsAttendanceSaving] = useState(false)
  const [deleteDialogKind, setDeleteDialogKind] = useState(null)
  const [deleteDialogHistoryRoute, setDeleteDialogHistoryRoute] = useState(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const isAttendanceRecord = normalizedType === 'attendance'
  const attendanceFormId = 'attendance-edit-form'

  const attendanceWorkerRate = useMemo(() => {
    if (!isAttendanceRecord || !resolvedItem?.worker_id || !resolvedItem?.project_id) {
      return null
    }

    return getWorkerRate(resolvedItem.worker_id, resolvedItem.project_id, workerWageRates)
  }, [isAttendanceRecord, resolvedItem?.project_id, resolvedItem?.worker_id, workerWageRates])

  const attendanceSelectedStatus = normalizeText(attendanceEditState.attendanceStatus, '')
  const attendanceSelectedOption =
    attendanceStatusOptions.find((option) => option.value === attendanceSelectedStatus) ?? null
  const attendanceSelectedMultiplier = attendanceSelectedOption?.multiplier ?? 0
  const attendanceIsOvertime = attendanceSelectedStatus === 'overtime'

  const attendanceCurrentStatus = normalizeText(resolvedItem?.attendance_status, '')
  const attendanceCurrentNotes = normalizeText(resolvedItem?.notes, '')

  const attendanceBaseWage = useMemo(() => {
    if (!isAttendanceRecord || !resolvedItem) {
      return 0
    }

    const masterWage = Number(attendanceWorkerRate?.wage_amount ?? attendanceWorkerRate?.wageAmount)
    if (Number.isFinite(masterWage) && masterWage > 0) {
      return masterWage
    }

    return deriveAttendanceBaseWage({
      attendanceStatus: attendanceCurrentStatus,
      totalPay: resolvedItem.total_pay ?? 0,
      overtimeFee: resolvedItem.overtime_fee ?? null,
    })
  }, [attendanceCurrentStatus, attendanceWorkerRate, isAttendanceRecord, resolvedItem])

  const attendanceCurrentOvertimeFee = useMemo(() => {
    if (!isAttendanceRecord || !resolvedItem) {
      return 0
    }

    return deriveAttendanceOvertimeFee({
      attendanceStatus: attendanceCurrentStatus,
      baseWage: attendanceBaseWage,
      totalPay: resolvedItem.total_pay ?? 0,
      overtimeFee: resolvedItem.overtime_fee ?? null,
    })
  }, [attendanceBaseWage, attendanceCurrentStatus, isAttendanceRecord, resolvedItem])

  const attendanceHasChanges =
    attendanceSelectedStatus !== attendanceCurrentStatus ||
    normalizeText(attendanceEditState.notes, '') !== attendanceCurrentNotes ||
    Number(attendanceEditState.overtimeFee ?? 0) !== Number(attendanceCurrentOvertimeFee ?? 0)

  const attendanceSelectedOvertimeFee = Number(attendanceEditState.overtimeFee ?? 0)

  const attendancePreviewTotalPay = useMemo(() => {
    const totalPay = calculateAttendanceTotalPay({
      attendanceStatus: attendanceSelectedStatus,
      baseWage: attendanceBaseWage,
      overtimeFee: attendanceSelectedOvertimeFee,
    })

    return Number.isFinite(totalPay) && totalPay > 0 ? Math.round(totalPay) : 0
  }, [attendanceBaseWage, attendanceSelectedOvertimeFee, attendanceSelectedStatus])

  const isAttendanceEditable =
    isAttendanceRecord &&
    Boolean(resolvedItem) &&
    !isLoadingRecord &&
    !resolvedItem.deleted_at &&
    normalizeText(resolvedItem.billing_status, '') === 'unbilled' &&
    !resolvedItem.salary_bill_id

  const titleMap = {
    income: 'Pemasukan Proyek',
    'project-income': 'Pemasukan Proyek',
    expense: 'Pengeluaran',
    loan: 'Pinjaman',
    attendance: 'Absensi',
    bill: 'Tagihan Upah',
  }
  const resolvedTitle = formatValue(titleMap[normalizedType] ?? type)
  const technicalRoute = `/edit/${normalizedType}/${id}/technical`
  const technicalBackRoute = `/edit/${normalizedType}/${id}`
  const backRoute = resolveFormBackRoute('editRecord', {
    locationState: location.state,
    type: normalizedType,
    fallbackRoute: '/transactions',
  })
  const currentRoute = `${location.pathname}${location.search ?? ''}`
  const expenseHasPaymentHistory =
    normalizedType === 'expense' ? hasTransactionPaymentHistory(resolvedItem) : false
  const materialInvoiceDeleteBlockReason =
    normalizedType === 'expense' && isMaterialInvoiceExpense(resolvedItem)
      ? getMaterialInvoiceDeleteBlockReason(resolvedItem)
      : null

  const handleBack = () => {
    navigate(backRoute, { replace: true })
  }
  const handleTechnicalBack = () => {
    navigate(technicalBackRoute, {
      replace: true,
      state: {
        ...(location.state ?? {}),
        item: resolvedItem ?? null,
        record: resolvedItem ?? null,
      },
    })
  }

  const handleFormSuccess = async () => {
    try {
      setRecordError(null)
    } catch (error) {
      console.error('Gagal memproses hasil simpan form:', error)
    }
  }

  const openDeleteDialog = (kind) => {
    if (!resolvedItem?.id || resolvedItem.deleted_at) {
      return
    }

    setRecordError(null)
    setDeleteDialogKind(kind)
    setDeleteDialogHistoryRoute(
      expenseHasPaymentHistory ? getTransactionDeleteHistoryRoute(resolvedItem) : null
    )
    setIsDeleteDialogOpen(true)
  }

  const handleExpenseDelete = () => {
    openDeleteDialog('expense')
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

  const handleMaterialInvoiceDelete = () => {
    if (!resolvedItem?.id || resolvedItem.deleted_at) {
      return
    }

    if (materialInvoiceDeleteBlockReason) {
      setRecordError(materialInvoiceDeleteBlockReason)
      return
    }

    openDeleteDialog('material-invoice')
  }

  const performDelete = async () => {
    if (!resolvedItem?.id || resolvedItem.deleted_at || expenseHasPaymentHistory) {
      return
    }

    try {
      setIsDeleting(true)
      setRecordError(null)

      if (deleteDialogKind === 'material-invoice') {
        await softDeleteMaterialInvoice(
          resolvedItem.id,
          resolvedItem.updated_at ?? resolvedItem.updatedAt ?? null
        )
      } else {
        await softDeleteExpense(
          resolvedItem.id,
          resolvedItem.updated_at ?? resolvedItem.updatedAt ?? null
        )
      }

      const nextRecord = await fetchMaterialInvoiceById(resolvedItem.id, {
        includeDeleted: true,
      })
      setResolvedItem(nextRecord)
    } catch (error) {
      setRecordError(
        error instanceof Error ? error.message : 'Gagal menghapus pengeluaran.'
      )
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      setDeleteDialogKind(null)
      setDeleteDialogHistoryRoute(null)
    }
  }

  const handleAttendanceDelete = async () => {
    if (
      !resolvedItem?.id ||
      resolvedItem.deleted_at ||
      resolvedItem.billing_status === 'billed' ||
      resolvedItem.salary_bill_id
    ) {
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

  const handleAttendanceSave = async (event) => {
    event.preventDefault()

    if (!isAttendanceEditable || !resolvedItem?.id) {
      return
    }

    if (!attendanceSelectedStatus) {
      setRecordError('Status absensi wajib diisi.')
      return
    }

    const selectedAttendanceOption = attendanceEditableStatusOptions.find(
      (option) => option.value === attendanceSelectedStatus
    )

    if (!selectedAttendanceOption || selectedAttendanceOption.disabled) {
      setRecordError('Status absensi tidak valid.')
      return
    }

    try {
      setIsAttendanceSaving(true)
      setRecordError(null)

      const nextAttendance = await updateAttendanceRecord({
        attendanceId: resolvedItem.id,
        teamId: resolvedItem.team_id,
        attendanceStatus: attendanceSelectedStatus,
        totalPay: attendancePreviewTotalPay,
        overtimeFee: attendanceSelectedStatus === 'overtime' ? attendanceSelectedOvertimeFee : null,
        notes: attendanceEditState.notes,
        expectedUpdatedAt: resolvedItem.updated_at ?? resolvedItem.updatedAt ?? null,
      })

      if (nextAttendance) {
        setResolvedItem(nextAttendance)
        setAttendanceEditState({
          attendanceStatus: normalizeText(nextAttendance.attendance_status, attendanceSelectedStatus),
          notes: normalizeText(nextAttendance.notes, ''),
          overtimeFee: normalizeText(
            nextAttendance.overtime_fee ??
              (attendanceSelectedStatus === 'overtime' ? attendanceSelectedOvertimeFee : null),
            ''
          ),
        })
      }
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Gagal menyimpan absensi.')
    } finally {
      setIsAttendanceSaving(false)
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
      !['income', 'project-income', 'loan'].includes(normalizedType)
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

  useEffect(() => {
    if (!isAttendanceEditable) {
      return
    }

    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master absensi untuk edit:', fetchError)
    })
  }, [fetchMasters, isAttendanceEditable])

  useEffect(() => {
    if (!isAttendanceRecord || !resolvedItem) {
      setAttendanceEditState({
        attendanceStatus: '',
        notes: '',
        overtimeFee: '',
      })
      return
    }

    setAttendanceEditState({
      attendanceStatus: normalizeText(resolvedItem.attendance_status, ''),
      notes: normalizeText(resolvedItem.notes, ''),
      overtimeFee: normalizeText(
        resolvedItem.overtime_fee ??
          (normalizeText(resolvedItem.attendance_status, '') === 'overtime'
            ? attendanceCurrentOvertimeFee
            : ''),
        ''
      ),
    })
  }, [attendanceCurrentOvertimeFee, isAttendanceRecord, resolvedItem])

  useEffect(() => {
    if (!isAttendanceRecord || !resolvedItem?.team_id || !resolvedItem?.attendance_date) {
      setAttendanceDayHistory([])
      return
    }

    let isActive = true

    fetchAttendanceHistoryFromApi({
      teamId: resolvedItem.team_id,
      date: resolvedItem.attendance_date,
      workerId: resolvedItem.worker_id,
    })
      .then((records) => {
        if (!isActive) {
          return
        }

        setAttendanceDayHistory(records)
      })
      .catch((fetchError) => {
        if (!isActive) {
          return
        }

        console.error('Gagal memuat histori absensi harian untuk edit:', fetchError)
        setAttendanceDayHistory([])
      })

    return () => {
      isActive = false
    }
  }, [isAttendanceRecord, resolvedItem?.attendance_date, resolvedItem?.team_id, resolvedItem?.worker_id])

  const attendanceDayUsage = useMemo(() => {
    return attendanceDayHistory.reduce((totalWeight, record) => {
      if (String(record?.id ?? '').trim() === String(resolvedItem?.id ?? '').trim()) {
        return totalWeight
      }

      return totalWeight + getAttendanceDayWeight(record?.attendance_status)
    }, 0)
  }, [attendanceDayHistory, resolvedItem?.id])

  const attendanceEditableStatusOptions = useMemo(() => {
    const currentRowWeight = getAttendanceDayWeight(attendanceCurrentStatus)
    const allowedStatusValues = getAllowedAttendanceStatusValues({
      usedDayWeight: attendanceDayUsage,
      currentAttendanceStatus: attendanceCurrentStatus,
      currentRowWeight,
    })

    return attendanceStatusOptions.map((option) => ({
      ...option,
      disabled:
        !allowedStatusValues.includes(option.value) &&
        option.value !== attendanceSelectedStatus,
    }))
  }, [
    attendanceCurrentStatus,
    attendanceDayUsage,
    attendanceSelectedStatus,
    attendanceStatusOptions,
  ])

  const technicalStatusLabel = isLoadingRecord
    ? 'Memuat...'
    : resolvedItem
      ? normalizedType === 'attendance'
        ? resolvedItem.deleted_at
          ? 'Terhapus'
          : isAttendanceEditable
            ? 'Siap diedit'
            : 'Siap dilihat'
        : 'Siap diedit'
      : 'Belum ditemukan'
  const technicalRows = [
    {
      key: 'type',
      label: 'Jenis Data',
      value: resolvedTitle,
    },
    {
      key: 'id',
      label: 'ID',
      value: formatValue(id),
    },
    {
      key: 'status',
      label: 'Status Mentah',
      value: technicalStatusLabel,
    },
    {
      key: 'editable',
      label: 'Editable',
      value: !isCreateMode && resolvedItem ? (isAttendanceEditable ? 'Ya' : 'Tidak') : 'N/A',
    },
    {
      key: 'route',
      label: 'Route Teknik',
      value: technicalRoute,
    },
  ]

  if (!isCreateMode && isLoadingRecord) {
    return (
      <AppViewportSafeArea className="min-h-full sm:mx-auto sm:max-w-md">
        <PageShell className="min-h-full">
          <PageHeader
            eyebrow={technicalView ? 'Owner' : 'Form'}
            title={
              technicalView
                ? `Detail Teknis ${resolvedTitle}`
                : `${isCreateMode ? 'Tambah' : 'Edit'} ${resolvedTitle}`
            }
            backAction={technicalView ? handleTechnicalBack : handleBack}
          />

          <section className="grid min-h-[calc(100dvh-16rem)] place-items-center px-4 text-center">
            <div className="flex flex-col items-center gap-5">
              <BrandLoader context="form" size="hero" />
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                  {technicalView
                    ? `Memuat detail teknis ${resolvedTitle}`
                    : `Memuat ${resolvedTitle}`}
                </h2>
                <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
                  {technicalView
                    ? 'Menyiapkan data teknis.'
                    : 'Menyiapkan data yang akan diubah.'}
                </p>
              </div>
            </div>
          </section>
        </PageShell>
      </AppViewportSafeArea>
    )
  }

  if (!isCreateMode && !isLoadingRecord && !resolvedItem) {
    return (
      <PageShell className="space-y-4">
        <PageHeader
          eyebrow={technicalView ? 'Owner' : 'Form'}
          title={
            technicalView
              ? `Detail Teknis ${resolvedTitle}`
              : `${isCreateMode ? 'Tambah' : 'Edit'} ${resolvedTitle}`
          }
          backAction={technicalView ? handleTechnicalBack : handleBack}
        />

        <AppErrorState
          action={
            <AppButton
              onClick={technicalView ? handleTechnicalBack : handleBack}
              type="button"
              variant="secondary"
            >
              Kembali
            </AppButton>
          }
          description={
            recordError ??
            `Data ${resolvedTitle} tidak ditemukan atau sudah tidak tersedia untuk diedit.`
          }
          title="Data tidak ditemukan"
        />
      </PageShell>
    )
  }

  if (technicalView) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Owner"
          title={`Detail Teknis ${resolvedTitle}`}
          backAction={handleTechnicalBack}
        />

        {recordError ? (
          <AppCardDashed className="text-sm leading-6 text-[var(--app-hint-color)]">
            {recordError}
          </AppCardDashed>
        ) : null}

        <AppCardStrong className="space-y-4">
          <AppTechnicalGrid items={technicalRows} />
        </AppCardStrong>
      </PageShell>
    )
  }

  return (
    <FormLayout
      onBack={handleBack}
      actionLabel={isAttendanceEditable ? 'Simpan Perubahan' : null}
      formId={isAttendanceEditable ? attendanceFormId : null}
      isSubmitting={isAttendanceSaving}
      submitDisabled={!attendanceHasChanges}
      title={`${isCreateMode ? 'Tambah' : 'Edit'} ${resolvedTitle}`}
    >
      <div className="space-y-4">
        {isCreateMode && ['income', 'project-income'].includes(normalizedType) ? (
          <IncomeForm onSuccess={handleFormSuccess} />
        ) : null}

        {isCreateMode && normalizedType === 'expense' ? (
          <ExpenseForm onSuccess={handleFormSuccess} />
        ) : null}

        {isCreateMode && normalizedType === 'loan' ? (
          <LoanForm onSuccess={handleFormSuccess} />
        ) : null}

        {isCreateMode && normalizedType === 'bill' ? <TagihanUpahForm /> : null}

        {!isCreateMode &&
        ['income', 'project-income'].includes(normalizedType) &&
        resolvedItem &&
        !isLoadingRecord ? (
          <div className="space-y-4">
            <IncomeForm
              initialData={resolvedItem}
              onSuccess={handleFormSuccess}
              recordId={resolvedItem.id}
            />
          </div>
        ) : null}

        {!isCreateMode && normalizedType === 'loan' && resolvedItem && !isLoadingRecord ? (
          <LoanForm
            initialData={resolvedItem}
            onSuccess={handleFormSuccess}
            recordId={resolvedItem.id}
          />
        ) : null}

        {!isCreateMode && normalizedType === 'attendance' && resolvedItem ? (
          <div className="space-y-4">
            {isAttendanceEditable ? (
              <form id={attendanceFormId} className="space-y-3" onSubmit={handleAttendanceSave}>
                <AppToggleGroup
                  buttonSize="sm"
                  description="Status mengubah total upah."
                  label="Status Absensi"
                  disabled={isAttendanceSaving}
                  onChange={(nextValue) =>
                    setAttendanceEditState((currentState) => ({
                      ...currentState,
                      attendanceStatus: nextValue,
                    }))
                  }
                  options={attendanceEditableStatusOptions}
                  value={attendanceSelectedStatus}
                />

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--app-text-color)]">Catatan</p>
                  <AppTextarea
                    disabled={isAttendanceSaving}
                    onChange={(event) =>
                      setAttendanceEditState((currentState) => ({
                        ...currentState,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Catatan absensi, opsional"
                    value={attendanceEditState.notes}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Upah Dasar
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(attendanceBaseWage)}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                    {attendanceIsOvertime ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                          Fee Lembur
                        </p>
                        <AppNominalInput
                          disabled={isAttendanceSaving}
                          onValueChange={(nextValue) =>
                            setAttendanceEditState((currentState) => ({
                              ...currentState,
                              overtimeFee: nextValue,
                            }))
                          }
                          value={attendanceEditState.overtimeFee}
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                          Faktor Status
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                          {attendanceSelectedOption
                            ? `${attendanceSelectedOption.label} x ${attendanceSelectedMultiplier}`
                            : 'Belum dipilih'}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="rounded-[18px] bg-[var(--app-surface-low-color)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Total Setelah Simpan
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(attendancePreviewTotalPay)}
                    </p>
                  </div>
                </div>
              </form>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {resolvedItem.salary_bill?.id ? (
                <AppButton
                  onClick={() =>
              navigate(`/payment/${resolvedItem.salary_bill.id}`, {
                state: {
                  surface: 'tagihan',
                  detailSurface: 'tagihan',
                  returnTo: currentRoute,
                  returnToOnSuccess: true,
                },
              })
            }
                  type="button"
                  variant="secondary"
                >
                  Buka Tagihan Gaji
                </AppButton>
              ) : null}

              {!resolvedItem.deleted_at &&
              resolvedItem.billing_status !== 'billed' &&
              !resolvedItem.salary_bill_id ? (
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
        resolvedItem &&
        !isLoadingRecord ? (
          <div className="space-y-4">
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
              {!resolvedItem.deleted_at ? (
                <AppButton
                  disabled={Boolean(materialInvoiceDeleteBlockReason)}
                  onClick={
                    isMaterialInvoiceExpense(resolvedItem)
                      ? handleMaterialInvoiceDelete
                      : handleExpenseDelete
                  }
                  type="button"
                  variant="danger"
                >
                  Hapus
                </AppButton>
              ) : null}

              {resolvedItem.deleted_at ? (
                <AppButton onClick={handleExpenseRestore} type="button" variant="secondary">
                  Restore
                </AppButton>
              ) : null}
            </div>

            {materialInvoiceDeleteBlockReason ? (
              <section className="app-card-dashed p-4 text-sm leading-6 text-[var(--app-hint-color)] sm:col-span-2">
                {materialInvoiceDeleteBlockReason}
              </section>
            ) : null}
          </div>
        ) : null}

        {!isCreateMode && recordError ? (
          <section className="app-card-dashed p-4 text-sm text-[var(--app-destructive-color)]">
            {recordError}
          </section>
        ) : null}

        {isCreateMode &&
        !['income', 'project-income', 'expense', 'loan', 'bill'].includes(normalizedType) ? (
          <section className="app-section-surface p-4">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Tipe form belum dipetakan.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
              Route ini belum memiliki form create final untuk tipe `{formatValue(type)}`.
            </p>
          </section>
        ) : null}
        <TransactionDeleteDialog
          confirmLabel={deleteDialogKind === 'material-invoice' ? 'Hapus Faktur' : 'Hapus Pengeluaran'}
          description={normalizeText(resolvedItem?.supplier_name_snapshot ?? resolvedItem?.supplier_name ?? resolvedTitle, null)}
          historyRoute={deleteDialogHistoryRoute}
          isConfirming={isDeleting}
          open={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false)
            setDeleteDialogKind(null)
            setDeleteDialogHistoryRoute(null)
          }}
          onConfirm={performDelete}
          onOpenHistory={(route) => {
            setIsDeleteDialogOpen(false)
            setDeleteDialogKind(null)
            setDeleteDialogHistoryRoute(null)

            if (!route) {
              return
            }

            navigate(route, {
              state: {
                transaction: resolvedItem,
                item: resolvedItem,
                detailSurface: 'riwayat',
              },
            })
          }}
          title={
            deleteDialogHistoryRoute
              ? deleteDialogKind === 'material-invoice'
                ? 'Faktur sudah memiliki pembayaran'
                : 'Pengeluaran sudah memiliki pembayaran'
              : deleteDialogKind === 'material-invoice'
                ? 'Konfirmasi Hapus Faktur Material'
                : 'Konfirmasi Hapus Pengeluaran'
          }
          warning={
            deleteDialogHistoryRoute
              ? 'Data ini sudah memiliki pembayaran. Buka riwayat tagihan untuk meninjau pembayaran sebelum memutuskan langkah berikutnya.'
              : deleteDialogKind === 'material-invoice'
                ? 'Faktur material akan dipindahkan ke arsip dan tagihan terhubung ikut disinkronkan.'
                : 'Pengeluaran akan dipindahkan ke arsip dan tagihan terhubung ikut disinkronkan.'
          }
        />
      </div>
    </FormLayout>
  )
}

export default EditRecordPage
