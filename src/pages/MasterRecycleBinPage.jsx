import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  Boxes,
  FolderTree,
  Landmark,
  RefreshCcw,
  Trash2,
  Truck,
  Users2,
} from 'lucide-react'
import ProtectedRoute from '../components/ProtectedRoute'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppErrorState,
  AppListCard,
  AppListRow,
  PageHeader,
  PageShell,
  SectionHeader,
} from '../components/ui/AppPrimitives'
import { capabilityContracts } from '../lib/capabilities'
import { formatCurrency, formatTransactionDateTime } from '../lib/transaction-presentation'
import useMasterStore from '../store/useMasterStore'
import useAuthStore from '../store/useAuthStore'

const groupConfigs = [
  {
    entityType: 'project',
    key: 'projects',
    label: 'Proyek',
    Icon: Briefcase,
  },
  {
    entityType: 'category',
    key: 'categories',
    label: 'Kategori',
    Icon: FolderTree,
  },
  {
    entityType: 'supplier',
    key: 'suppliers',
    label: 'Supplier',
    Icon: Truck,
  },
  {
    entityType: 'creditor',
    key: 'fundingCreditors',
    label: 'Kreditur',
    Icon: Landmark,
  },
  {
    entityType: 'profession',
    key: 'professions',
    label: 'Profesi',
    Icon: Boxes,
  },
  {
    entityType: 'staff',
    key: 'staffMembers',
    label: 'Staf',
    Icon: Boxes,
  },
  {
    entityType: 'worker',
    key: 'workers',
    label: 'Pekerja',
    Icon: Users2,
  },
  {
    entityType: 'material',
    key: 'materials',
    label: 'Barang',
    Icon: Boxes,
  },
]

function getMasterRecordTitle(record) {
  return (
    record?.name ||
    record?.project_name ||
    record?.supplier_name ||
    record?.creditor_name ||
    record?.profession_name ||
    record?.staff_name ||
    record?.worker_name ||
    'Tanpa nama'
  )
}

function getMasterRecordDescription(record, entityType) {
  if (entityType === 'project') {
    return `Budget ${formatCurrency(record?.budget ?? 0)}`
  }

  if (entityType === 'category') {
    return record?.category_group || 'Kategori biaya'
  }

  if (entityType === 'supplier') {
    return record?.supplier_type || 'Supplier'
  }

  if (entityType === 'creditor') {
    return record?.notes || 'Kreditur pendanaan'
  }

  if (entityType === 'profession') {
    return record?.notes || 'Profesi pekerja'
  }

  if (entityType === 'staff') {
    return [
      `Gaji ${formatCurrency(record?.salary ?? 0)}`,
      `Fee ${Number(record?.fee_percentage ?? 0)}%`,
      `Tetap ${formatCurrency(record?.fee_amount ?? 0)}`,
    ].join(' | ')
  }

  if (entityType === 'worker') {
    return [
      record?.status || 'active',
      record?.default_role_name || 'Role default belum diisi',
      record?.notes || 'Pekerja',
    ].join(' | ')
  }

  if (entityType === 'material') {
    return [
      `Stok ${Number(record?.current_stock ?? 0)}`,
      record?.unit || 'Unit belum diisi',
    ].join(' | ')
  }

  return record?.notes || 'Data master terhapus'
}

function MasterRecycleBinPage() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const fetchDeletedMasters = useMasterStore((state) => state.fetchDeletedMasters)
  const restoreMasterRecord = useMasterStore((state) => state.restoreMasterRecord)
  const deletedMasters = useMasterStore((state) => state.deletedMasters)
  const projects = useMasterStore((state) => state.projects)
  const professions = useMasterStore((state) => state.professions)
  const [actionError, setActionError] = useState(null)
  const isLoading = useMasterStore((state) => state.isLoading)
  const error = useMasterStore((state) => state.error)

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    void Promise.all([fetchMasters({ force: false }), fetchDeletedMasters()]).catch((loadError) => {
      console.error('Gagal memuat Arsip master:', loadError)
    })
  }, [currentTeamId, fetchDeletedMasters, fetchMasters])

  const groupedRecords = useMemo(() => {
    const deletedState = deletedMasters ?? {}

    return groupConfigs
      .map((group) => {
        const records = deletedState[group.key] ?? []

        return {
          ...group,
          records,
          count: records.length,
        }
      })
      .filter((group) => group.count > 0)
  }, [deletedMasters])

  const projectsById = useMemo(
    () =>
      projects.reduce((map, project) => {
        map[project.id] = project
        return map
      }, {}),
    [projects]
  )

  const professionsById = useMemo(
    () =>
      professions.reduce((map, profession) => {
        map[profession.id] = profession
        return map
      }, {}),
    [professions]
  )

  const totalDeletedCount = useMemo(
    () => groupedRecords.reduce((sum, group) => sum + group.count, 0),
    [groupedRecords]
  )

  const getWorkerDescription = useCallback(
    (record) => {
      const defaultProject =
        projectsById[record?.default_project_id]?.project_name ??
        projectsById[record?.default_project_id]?.name ??
        'Belum diisi'
      const professionName =
        professionsById[record?.profession_id]?.profession_name ??
        professionsById[record?.profession_id]?.name ??
        'Profesi belum diisi'

      return [professionName, defaultProject, record?.notes || 'Pekerja'].join(' | ')
    },
    [professionsById, projectsById]
  )

  const handleRestore = async (group, record) => {
    try {
      setActionError(null)
      await restoreMasterRecord(group.entityType, record.id)
      await fetchDeletedMasters()
    } catch (restoreError) {
      setActionError(
        restoreError instanceof Error
          ? restoreError.message
          : 'Gagal memulihkan master data.'
      )
    }
  }

  const showSkeleton = Boolean(currentTeamId) && isLoading && totalDeletedCount === 0 && !error

  return (
    <ProtectedRoute
      requiredCapability={capabilityContracts.master_data_admin.key}
      description="Arsip master data hanya tersedia untuk Owner dan Admin."
    >
      <PageShell>
        <PageHeader
          eyebrow="Data Referensi"
          title="Arsip Master"
          backAction={() => navigate('/master')}
        />

        <div className="flex justify-end">
          <AppButton
            leadingIcon={<RefreshCcw className="h-4 w-4" />}
            onClick={() => {
              void fetchDeletedMasters().catch((loadError) => {
                console.error('Gagal memuat Arsip master:', loadError)
              })
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Muat Ulang
          </AppButton>
        </div>

        {error ? <AppErrorState title="Arsip master gagal dimuat" description={error} /> : null}

        {actionError ? (
          <AppCardDashed>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
              Aksi Master Gagal
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
              {actionError}
            </p>
          </AppCardDashed>
        ) : null}

        {!currentTeamId ? (
          <AppCardDashed className="px-4 py-5">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Team aktif belum tersedia.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
              Login ulang atau pilih workspace yang benar agar Arsip master bisa dimuat.
            </p>
          </AppCardDashed>
        ) : showSkeleton ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <AppCardStrong key={item}>
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                <div className="mt-3 h-16 animate-pulse rounded-[20px] bg-[var(--app-surface-low-color)]" />
              </AppCardStrong>
            ))}
          </div>
        ) : groupedRecords.length > 0 ? (
          <div className="space-y-4">
            {groupedRecords.map((group) => (
              <AppCardStrong key={group.key} className="space-y-4">
                <SectionHeader
                  eyebrow="Arsip"
                  title={group.label}
                  description={`${group.count} data terhapus`}
                  action={
                    <span className="inline-flex items-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-2 text-xs font-medium text-[var(--app-hint-color)]">
                      {group.count}
                    </span>
                  }
                />

                <AppListCard className="overflow-hidden p-0">
                  {group.records.map((record) => (
                    <AppListRow
                      key={record.id}
                      title={getMasterRecordTitle(record)}
                      description={[
                        group.entityType === 'worker'
                          ? getWorkerDescription(record)
                          : getMasterRecordDescription(record, group.entityType),
                        record.deleted_at ? `Dihapus ${formatTransactionDateTime(record.deleted_at)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      leading={
                        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                          <group.Icon className="h-4 w-4" />
                        </span>
                      }
                      actions={
                        <AppButton
                          leadingIcon={<RefreshCcw className="h-4 w-4" />}
                          onClick={() => handleRestore(group, record)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Pulihkan
                        </AppButton>
                      }
                    />
                  ))}
                </AppListCard>
              </AppCardStrong>
            ))}
          </div>
        ) : (
          <AppEmptyState
            icon={<Trash2 className="h-5 w-5" />}
            title="Arsip master kosong"
            description="Data master yang dihapus akan muncul di sini."
          />
        )}
      </PageShell>
    </ProtectedRoute>
  )
}

export default MasterRecycleBinPage
