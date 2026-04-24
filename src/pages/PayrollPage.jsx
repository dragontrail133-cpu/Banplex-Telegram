import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PayrollAttendanceHistory from '../components/PayrollAttendanceHistory'
import ProtectedRoute from '../components/ProtectedRoute'
import { PageHeader, PageShell } from '../components/ui/AppPrimitives'
import { capabilityContracts } from '../lib/capabilities'
import { getAppTodayKey } from '../lib/date-time'
import useMutationToast from '../hooks/useMutationToast'
import { createAttendanceRecapFromApi } from '../lib/records-api'
import {
  getPayrollBillGroupPaymentTarget,
  isPayrollBillSummary,
} from '../lib/transaction-presentation'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useTelegram from '../hooks/useTelegram'

function getWorkerName(record) {
  return (
    String(record?.worker_name ?? record?.worker_name_snapshot ?? record?.workers?.name ?? '')
      .trim() || 'Pekerja'
  )
}

function getTodayDateString() {
  return getAppTodayKey()
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

function isRecapableAttendance(record) {
  return (
    String(record?.billing_status ?? '').trim().toLowerCase() === 'unbilled' &&
    Number(record?.total_pay ?? 0) > 0 &&
    !record?.salary_bill_id
  )
}

function getGroupTeamId(records = []) {
  return records.map((record) => String(record?.team_id ?? '').trim()).find(Boolean) ?? null
}

function groupRecordsByWorker(records = []) {
  const groups = new Map()

  for (const record of records) {
    if (!isRecapableAttendance(record)) {
      continue
    }

    const workerId = String(record?.worker_id ?? '').trim()
    const workerName = getWorkerName(record)
    const groupKey = workerId || workerName

    const nextGroup =
      groups.get(groupKey) ?? {
        workerId: workerId || null,
        workerName,
        records: [],
      }

    nextGroup.records.push(record)
    groups.set(groupKey, nextGroup)
  }

  return [...groups.values()].map((group) => {
    const recordsByDate = [...group.records].sort((left, right) =>
      String(left?.attendance_date ?? '').localeCompare(String(right?.attendance_date ?? ''))
    )

    return {
      ...group,
      records: recordsByDate,
      teamId: getGroupTeamId(recordsByDate),
      totalAmount: recordsByDate.reduce((sum, record) => sum + Number(record?.total_pay ?? 0), 0),
    }
  })
}

async function generateSalaryBillForGroup(group, userDisplayName) {
  if (
    !group?.teamId ||
    !group?.workerId ||
    group.records.length === 0 ||
    Number(group?.totalAmount ?? 0) <= 0
  ) {
    throw new Error('Data rekap tidak valid.')
  }

  const recordIds = group.records.map((record) => record.id)
  const dueDate = getTodayDateString()

  const result = await createAttendanceRecapFromApi({
    teamId: group.teamId,
    workerId: group.workerId,
    recordIds,
    dueDate,
  })
  const attendanceCount = Number(result.attendanceCount ?? group.records.length)
  const totalAmount = Number(result.totalAmount ?? group.totalAmount)
  const description = `Tagihan gaji untuk ${group.workerName} (${attendanceCount} absensi)`

  notifyTelegram({
    notificationType: 'salary_bill',
    workerName: group.workerName,
    amount: totalAmount,
    dueDate,
    billId: result.billId ?? null,
    recordCount: attendanceCount,
    userName: userDisplayName,
    description,
  })

  return {
    billId: result.billId ?? null,
    attendanceCount,
    totalAmount,
  }
}

function buildRecapGroups(context) {
  const records = Array.isArray(context?.group?.records) ? context.group.records : []

  if (context?.tab === 'daily') {
    return groupRecordsByWorker(records)
  }

  if (context?.tab === 'worker') {
    const workerId = String(context?.workerId ?? context?.group?.workerId ?? '').trim()
    const workerName = String(context?.group?.workerName ?? '').trim() || 'Pekerja'
    const filteredRecords = records.filter((record) => isRecapableAttendance(record))

    if (!workerId || filteredRecords.length === 0) {
      return []
    }

    return [
      {
        teamId: getGroupTeamId(filteredRecords),
        workerId,
        workerName,
        records: [...filteredRecords].sort((left, right) =>
          String(left?.attendance_date ?? '').localeCompare(String(right?.attendance_date ?? ''))
        ),
        totalAmount: filteredRecords.reduce((sum, record) => sum + Number(record?.total_pay ?? 0), 0),
      },
    ]
  }

  return []
}

function PayrollPage() {
  const navigate = useNavigate()
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const bills = useBillStore((state) => state.bills)
  const fetchUnpaidBills = useBillStore((state) => state.fetchUnpaidBills)
  const userDisplayName = useMemo(() => getUserDisplayName(user, authUser), [authUser, user])
  const [refreshToken, setRefreshToken] = useState(0)
  const { begin, clear, fail, succeed } = useMutationToast()

  useEffect(() => () => clear(), [clear])

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    void fetchUnpaidBills({ teamId: currentTeamId, silent: true })
  }, [currentTeamId, fetchUnpaidBills, refreshToken])

  const resolveWorkerPaymentTarget = useCallback(
    (group) => {
      const workerId = String(group?.workerId ?? '').trim()
      const workerName = String(group?.workerName ?? '').trim().toLowerCase()

      const matchedBills = bills.filter((bill) => {
        if (!isPayrollBillSummary(bill)) {
          return false
        }

        const billWorkerId = String(bill?.workerId ?? bill?.worker_id ?? '').trim()
        const billWorkerName = String(
          bill?.workerName ?? bill?.worker_name ?? bill?.worker_name_snapshot ?? ''
        )
          .trim()
          .toLowerCase()

        const billWorkerFallbackName = String(
          bill?.supplierName ?? bill?.supplier_name_snapshot ?? ''
        )
          .trim()
          .toLowerCase()

        if (workerId && billWorkerId) {
          return billWorkerId === workerId
        }

        return (
          Boolean(workerName) &&
          (billWorkerName === workerName || billWorkerFallbackName === workerName)
        )
      })

      if (matchedBills.length === 0) {
        return null
      }

      return getPayrollBillGroupPaymentTarget({
        workerName: group?.workerName ?? null,
        bills: matchedBills,
      })
    },
    [bills]
  )

  const handleRequestPay = useCallback(
    (group) => {
      const paymentTarget = resolveWorkerPaymentTarget(group)

      if (!paymentTarget?.id) {
        throw new Error('Tagihan aktif pekerja tidak ditemukan.')
      }

      navigate(`/payment/${paymentTarget.id}`, {
        state: {
          bill: paymentTarget,
          record: paymentTarget,
          returnTo: '/payroll?tab=worker',
          returnToOnSuccess: true,
        },
      })
    },
    [navigate, resolveWorkerPaymentTarget]
  )

  const handleConfirmRecap = async (context) => {
    const recapGroups = buildRecapGroups(context)
    const totalRecordCount = recapGroups.reduce((sum, group) => sum + group.records.length, 0)

    if (recapGroups.length === 0) {
      throw new Error('Tidak ada absensi yang bisa direkap.')
    }

    begin({
      title: 'Membuat rekap gaji',
      message: 'Mohon tunggu sampai tagihan selesai dibuat.',
    })

    try {
      const results = await Promise.allSettled(
        recapGroups.map((group) =>
          generateSalaryBillForGroup(
            {
              ...group,
              teamId: group.teamId ?? currentTeamId ?? null,
            },
            userDisplayName
          )
        )
      )
      const fulfilledResults = results.filter((result) => result.status === 'fulfilled')
      const rejectedResults = results.filter((result) => result.status === 'rejected')
      const processedRecordCount = results.reduce((sum, result) => {
        if (result.status !== 'fulfilled') {
          return sum
        }

        return sum + Number(result.value?.attendanceCount ?? 0)
      }, 0)
      const processedTotalAmount = results.reduce((sum, result) => {
        if (result.status !== 'fulfilled') {
          return sum
        }

        return sum + Number(result.value?.totalAmount ?? 0)
      }, 0)

      if (fulfilledResults.length === 0) {
        const rejectedResult = rejectedResults[0]
        throw rejectedResult?.reason instanceof Error
          ? rejectedResult.reason
          : new Error('Rekap gagal.')
      }

      const skippedRecordCount = Math.max(totalRecordCount - processedRecordCount, 0)
      const isPartialResult = rejectedResults.length > 0 || skippedRecordCount > 0

      succeed({
        tone: isPartialResult ? 'info' : 'success',
        title: isPartialResult ? 'Rekap sebagian' : 'Rekap berhasil',
        message: `${processedRecordCount} absensi · ${formatCurrency(processedTotalAmount)}`,
      })
      return true
    } catch (error) {
      fail({
        title: 'Rekap gagal',
        message: error instanceof Error ? error.message : 'Rekap gagal.',
      })
      throw error
    } finally {
      setRefreshToken((value) => value + 1)
    }
  }

  return (
    <PageShell>
      <PageHeader title="Catatan Absensi" />
      <ProtectedRoute requiredCapability={capabilityContracts.payroll_access.key}>
        <PayrollAttendanceHistory
          onRequestPay={handleRequestPay}
          onRequestRecap={handleConfirmRecap}
          refreshToken={refreshToken}
          resolveWorkerPaymentTarget={resolveWorkerPaymentTarget}
        />
      </ProtectedRoute>
    </PageShell>
  )
}

export default PayrollPage
