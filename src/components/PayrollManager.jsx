import { useEffect, useMemo, useRef, useState } from 'react'
import { FileClock, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useAttendanceStore from '../store/useAttendanceStore'
import { formatAppDateLabel, getAppTodayKey } from '../lib/date-time'
import useMutationToast from '../hooks/useMutationToast'
import {
  AppButton,
  AppCardDashed,
  AppEmptyState,
  AppErrorState,
  PageSection,
} from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value) {
  return formatAppDateLabel(value)
}

function getStatusLabel(status) {
  if (status === 'half_day') {
    return 'Half Day'
  }

  if (status === 'overtime') {
    return 'Lembur'
  }

  if (status === 'absent') {
    return 'Tidak Hadir'
  }

  return 'Full Day'
}

function getTodayDateString() {
  return getAppTodayKey()
}

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

function groupAttendances(attendances) {
  const grouped = attendances.reduce((accumulator, attendance) => {
    const billingStatus = String(attendance?.billing_status ?? '').trim().toLowerCase()
    const totalPay = Number(attendance?.total_pay ?? 0)

    if (billingStatus !== 'unbilled' || totalPay <= 0) {
      return accumulator
    }

    const workerId = attendance.worker_id
    const workerName = attendance.worker_name ?? 'Pekerja belum terhubung'
    const groupKey = workerId ?? workerName

    if (!accumulator[groupKey]) {
      accumulator[groupKey] = {
        workerId,
        workerName,
        records: [],
        totalAmount: 0,
      }
    }

    accumulator[groupKey].records.push(attendance)
    accumulator[groupKey].totalAmount += Number(attendance.total_pay ?? 0)

    return accumulator
  }, {})

  return Object.values(grouped).sort((a, b) =>
    a.workerName.localeCompare(b.workerName, 'id', { sensitivity: 'base' })
  )
}

function notifyTelegram(payload) {
  void fetch('/api/notify', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error('Gagal memanggil endpoint notifikasi payroll:', error)
  })
}

function PayrollManager({ onSuccess, recapContext = null }) {
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const userDisplayName = getUserDisplayName(user, authUser)
  const unbilledAttendances = useAttendanceStore((state) => state.unbilledAttendances)
  const isLoading = useAttendanceStore((state) => state.isLoading)
  const error = useAttendanceStore((state) => state.error)
  const fetchUnbilledAttendances = useAttendanceStore(
    (state) => state.fetchUnbilledAttendances
  )
  const clearError = useAttendanceStore((state) => state.clearError)
  const [activeWorkerId, setActiveWorkerId] = useState(null)
  const groupRefs = useRef(new Map())
  const lastFocusedRecapKeyRef = useRef('')
  const { begin, clear, fail, succeed } = useMutationToast()

  const highlightedWorkerIds = useMemo(() => {
    if (recapContext?.tab === 'daily') {
      return new Set(
        (recapContext.workerIds ?? []).map((workerId) => String(workerId ?? '').trim()).filter(Boolean)
      )
    }

    if (recapContext?.tab === 'worker' && recapContext.workerId) {
      return new Set([String(recapContext.workerId).trim()])
    }

    return new Set()
  }, [recapContext])

  const recapFocusKey = useMemo(() => {
    if (recapContext?.tab === 'daily') {
      const workerIds = Array.from(highlightedWorkerIds)

      if (workerIds.length > 0) {
        return `daily:${workerIds.join('|')}`
      }

      return recapContext.dateKey ? `daily:${recapContext.dateKey}` : 'daily'
    }

    if (recapContext?.tab === 'worker' && recapContext.workerId) {
      return `worker:${String(recapContext.workerId).trim()}`
    }

    return ''
  }, [highlightedWorkerIds, recapContext])

  const groupedAttendances = useMemo(
    () => groupAttendances(unbilledAttendances),
    [unbilledAttendances]
  )

  const orderedGroupedAttendances = useMemo(() => {
    if (!highlightedWorkerIds.size) {
      return groupedAttendances
    }

    return [...groupedAttendances].sort((left, right) => {
      const leftKey = String(left.workerId ?? '').trim()
      const rightKey = String(right.workerId ?? '').trim()
      const leftPriority = highlightedWorkerIds.has(leftKey) ? 0 : 1
      const rightPriority = highlightedWorkerIds.has(rightKey) ? 0 : 1

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority
      }

      return String(left.workerName ?? '').localeCompare(String(right.workerName ?? ''), 'id', {
        sensitivity: 'base',
      })
    })
  }, [groupedAttendances, highlightedWorkerIds])

  useEffect(() => {
    if (!recapFocusKey || lastFocusedRecapKeyRef.current === recapFocusKey) {
      return
    }

    const firstTarget = orderedGroupedAttendances.find((group) =>
      highlightedWorkerIds.has(String(group.workerId ?? '').trim())
    )

    if (!firstTarget) {
      return
    }

    lastFocusedRecapKeyRef.current = recapFocusKey
    const targetKey = String(firstTarget.workerId ?? firstTarget.workerName ?? '').trim()

    if (!targetKey) {
      return
    }

    groupRefs.current.get(targetKey)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [highlightedWorkerIds, orderedGroupedAttendances, recapFocusKey])

  useEffect(() => {
    fetchUnbilledAttendances({
      teamId: currentTeamId,
      force: true,
    }).catch((fetchError) => {
      console.error('Gagal memuat absensi yang belum ditagihkan:', fetchError)
    })
  }, [currentTeamId, fetchUnbilledAttendances])

  useEffect(() => () => clearError(), [clearError])
  useEffect(() => () => clear(), [clear])

  const handleCreateBill = async (group) => {
    if (
      !group?.workerId ||
      group.records.length === 0 ||
      Number(group?.totalAmount ?? 0) <= 0 ||
      !supabase
    ) {
      return
    }

    setActiveWorkerId(group.workerId)
    begin({
      title: 'Membuat tagihan gaji',
      message: 'Mohon tunggu sampai tagihan selesai dibuat.',
    })

    try {
      const recordIds = group.records.map((record) => record.id)
      const dueDate = getTodayDateString()
      const description = `Tagihan gaji untuk ${group.workerName} (${group.records.length} absensi)`

      const { data, error: rpcError } = await supabase.rpc('fn_generate_salary_bill', {
        p_worker_id: group.workerId,
        p_record_ids: recordIds,
        p_total_amount: group.totalAmount,
        p_due_date: dueDate,
        p_description: description,
      })

      if (rpcError) {
        throw rpcError
      }

      const newBillId = Array.isArray(data) ? data[0] : data

      notifyTelegram({
        notificationType: 'salary_bill',
        workerName: group.workerName,
        amount: group.totalAmount,
        dueDate,
        billId: newBillId ?? null,
        recordCount: group.records.length,
        userName: userDisplayName,
        description,
      })

      await fetchUnbilledAttendances({
        teamId: currentTeamId,
        force: true,
      })

      if (typeof onSuccess === 'function') {
        await onSuccess()
      }

      succeed({
        title: 'Tagihan gaji tersimpan',
        message: `Tagihan gaji untuk ${group.workerName} berhasil dibuat.`,
      })
    } catch (billError) {
      const message =
        billError instanceof Error
          ? billError.message
          : 'Gagal membuat tagihan gaji.'

      fail({
        title: 'Tagihan gaji gagal dibuat',
        message,
      })
      console.error(message)
    } finally {
      setActiveWorkerId(null)
    }
  }

  return (
    <PageSection
      eyebrow="Rekap Gaji"
      title="Bundel absensi menjadi tagihan gaji"
      description="Pilih kelompok pekerja, lalu buat satu tagihan gaji dari absensi yang belum ditagihkan."
    >

      {error ? (
        <AppErrorState
          description={error}
          title="Rekap gaji gagal dimuat"
        />
      ) : null}

      {isLoading && orderedGroupedAttendances.length === 0 ? (
        <AppEmptyState
          description="Menarik absensi yang belum ditagihkan dari server."
          icon={<Loader2 className="h-10 w-10 animate-spin" />}
          title="Memuat absensi yang belum ditagihkan"
        />
      ) : orderedGroupedAttendances.length > 0 ? (
        <div className="space-y-4">
          {orderedGroupedAttendances.map((group) => {
            const isProcessing = activeWorkerId === group.workerId
            const isHighlighted = highlightedWorkerIds.has(String(group.workerId ?? '').trim())
            const dateValues = group.records.map((record) => record.attendance_date)
            const firstDate = dateValues[0] ?? null
            const lastDate = dateValues[dateValues.length - 1] ?? null

            return (
              <article
                key={group.workerId ?? group.workerName}
                ref={(node) => {
                  const groupKey = String(group.workerId ?? group.workerName ?? '').trim()

                  if (!groupKey) {
                    return
                  }

                  if (node) {
                    groupRefs.current.set(groupKey, node)
                    return
                  }

                  groupRefs.current.delete(groupKey)
                }}
                className={`rounded-[26px] border p-4 shadow-sm transition ${
                  isHighlighted
                    ? 'border-sky-300 bg-sky-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileClock className="h-4 w-4 text-sky-600" />
                      <p className="text-base font-semibold text-[var(--app-text-color)]">
                        {group.workerName}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--app-hint-color)]">
                      {group.records.length} absensi belum dibundel
                    </p>
                    <p className="text-sm text-slate-500">
                      Periode {formatDate(firstDate)} - {formatDate(lastDate)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      Total Upah
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                      {formatCurrency(group.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {group.records.map((record) => (
                    <div
                      key={record.id}
                      className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--app-text-color)]">
                          {formatDate(record.attendance_date)} -{' '}
                          {record.project_name ?? 'Proyek belum terhubung'}
                        </p>
                        <p className="text-sm text-[var(--app-hint-color)]">
                          {getStatusLabel(record.attendance_status)}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-slate-700">
                        {formatCurrency(record.total_pay)}
                      </div>
                    </div>
                  ))}
                </div>

                <AppButton
                  className="mt-4"
                  disabled={isProcessing || Number(group.totalAmount ?? 0) <= 0}
                  onClick={() => handleCreateBill(group)}
                  type="button"
                >
                  Buat Tagihan Gaji
                </AppButton>
              </article>
            )
          })}
        </div>
      ) : (
        <AppEmptyState
          description="Absensi yang belum ditagihkan akan muncul di sini."
          icon={<FileClock className="h-10 w-10" />}
          title="Belum ada absensi yang belum ditagihkan"
        />
      )}
    </PageSection>
  )
}

export default PayrollManager
