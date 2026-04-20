import { useEffect, useMemo, useState } from 'react'
import PayrollAttendanceHistory from '../components/PayrollAttendanceHistory'
import ProtectedRoute from '../components/ProtectedRoute'
import { AppCardDashed, PageHeader, PageShell } from '../components/ui/AppPrimitives'
import { getAppTodayKey } from '../lib/date-time'
import { createAttendanceRecapFromApi } from '../lib/records-api'
import useAuthStore from '../store/useAuthStore'
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
  return String(record?.billing_status ?? '').trim().toLowerCase() === 'unbilled'
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
  if (!group?.teamId || !group?.workerId || group.records.length === 0) {
    throw new Error('Data rekap tidak valid.')
  }

  const recordIds = group.records.map((record) => record.id)
  const dueDate = getTodayDateString()
  const description = `Tagihan gaji untuk ${group.workerName} (${group.records.length} absensi)`

  const result = await createAttendanceRecapFromApi({
    teamId: group.teamId,
    workerId: group.workerId,
    recordIds,
    dueDate,
    description,
  })

  notifyTelegram({
    notificationType: 'salary_bill',
    workerName: group.workerName,
    amount: group.totalAmount,
    dueDate,
    billId: result.billId ?? null,
    recordCount: group.records.length,
    userName: userDisplayName,
    description,
  })

  return {
    billId: result.billId ?? null,
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
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const userDisplayName = useMemo(() => getUserDisplayName(user, authUser), [authUser, user])
  const [refreshToken, setRefreshToken] = useState(0)
  const [toastState, setToastState] = useState(null)

  useEffect(() => {
    if (!toastState) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setToastState(null)
    }, 2400)

    return () => window.clearTimeout(timeoutId)
  }, [toastState])

  const handleConfirmRecap = async (context) => {
    const recapGroups = buildRecapGroups(context)
    const totalRecordCount = recapGroups.reduce((sum, group) => sum + group.records.length, 0)

    if (recapGroups.length === 0) {
      throw new Error('Tidak ada absensi yang bisa direkap.')
    }

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
      const processedRecordCount = results.reduce((sum, result, index) => {
        if (result.status !== 'fulfilled') {
          return sum
        }

        return sum + (recapGroups[index]?.records.length ?? 0)
      }, 0)

      if (fulfilledResults.length === 0) {
        const rejectedResult = rejectedResults[0]
        throw rejectedResult?.reason instanceof Error
          ? rejectedResult.reason
          : new Error('Rekap gagal.')
      }

      const skippedRecordCount = Math.max(totalRecordCount - processedRecordCount, 0)
      const isPartialResult = rejectedResults.length > 0 || skippedRecordCount > 0

      setToastState({
        tone: isPartialResult ? 'info' : 'success',
        message: isPartialResult ? 'Rekap sebagian.' : 'Rekap berhasil.',
      })
      return true
    } finally {
      setRefreshToken((value) => value + 1)
    }
  }

  const toastClassName =
    toastState?.tone === 'success'
      ? 'app-tone-success'
      : toastState?.tone === 'info'
        ? 'app-tone-info'
      : 'app-tone-danger'

  return (
    <PageShell>
      <PageHeader title="Catatan Absensi" />
      <ProtectedRoute requiredCapability="payroll_access">
        <PayrollAttendanceHistory
          onRequestRecap={handleConfirmRecap}
          refreshToken={refreshToken}
        />
      </ProtectedRoute>

      {toastState ? (
        <div className="fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[160] flex justify-center px-3">
          <AppCardDashed
            className={`${toastClassName} w-full max-w-sm px-4 py-3 text-sm font-semibold shadow-lg`}
            role="status"
            aria-live="polite"
          >
            {toastState.message}
          </AppCardDashed>
        </div>
      ) : null}
    </PageShell>
  )
}

export default PayrollPage
