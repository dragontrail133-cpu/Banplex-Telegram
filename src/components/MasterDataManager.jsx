import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Loader2, Plus, Users2 } from 'lucide-react'
import ProtectedRoute from './ProtectedRoute'
import ActionCard from './ui/ActionCard'
import { masterTabs } from './master/masterTabs'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardStrong,
  AppEmptyState,
  AppErrorState,
  SectionHeader,
} from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function MasterDataManager() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const projects = useMasterStore((state) => state.projects)
  const categories = useMasterStore((state) => state.categories)
  const suppliers = useMasterStore((state) => state.suppliers)
  const fundingCreditors = useMasterStore((state) => state.fundingCreditors)
  const professions = useMasterStore((state) => state.professions)
  const workers = useMasterStore((state) => state.workers)
  const workerWageRates = useMasterStore((state) => state.workerWageRates)
  const materials = useMasterStore((state) => state.materials)
  const staffMembers = useMasterStore((state) => state.staffMembers)
  const fetchProjects = useMasterStore((state) => state.fetchProjects)
  const fetchExpenseCategories = useMasterStore(
    (state) => state.fetchExpenseCategories
  )
  const fetchSuppliers = useMasterStore((state) => state.fetchSuppliers)
  const fetchFundingCreditors = useMasterStore(
    (state) => state.fetchFundingCreditors
  )
  const fetchProfessions = useMasterStore((state) => state.fetchProfessions)
  const fetchWorkers = useMasterStore((state) => state.fetchWorkers)
  const fetchWorkerWageRates = useMasterStore((state) => state.fetchWorkerWageRates)
  const fetchMaterials = useMasterStore((state) => state.fetchMaterials)
  const fetchStaff = useMasterStore((state) => state.fetchStaff)
  const isLoading = useMasterStore((state) => state.isLoading)
  const error = useMasterStore((state) => state.error)
  const [activeTab, setActiveTab] = useState(masterTabs[0].key)
  const [feedbackMessage, setFeedbackMessage] = useState(null)

  useEffect(() => {
    void Promise.all([
      fetchProjects(),
      fetchExpenseCategories(),
      fetchSuppliers(),
      fetchFundingCreditors(),
      fetchProfessions(),
      fetchWorkers(),
      fetchWorkerWageRates(),
      fetchMaterials(),
      fetchStaff(),
    ]).catch((masterError) => {
      console.error('Gagal memuat master data universal:', masterError)
    })
  }, [
    fetchExpenseCategories,
    fetchFundingCreditors,
    fetchMaterials,
    fetchProfessions,
    fetchProjects,
    fetchStaff,
    fetchSuppliers,
    fetchWorkerWageRates,
    fetchWorkers,
  ])

  const collections = useMemo(
    () => ({
      projects,
      categories,
      suppliers,
      fundingCreditors,
      professions,
      workers,
      materials,
      staffMembers,
    }),
    [
      categories,
      fundingCreditors,
      materials,
      professions,
      projects,
      staffMembers,
      suppliers,
      workers,
    ]
  )

  const projectsById = useMemo(
    () =>
      projects.reduce((map, project) => {
        map[project.id] = project
        return map
      }, {}),
    [projects]
  )

  const professionMap = useMemo(
    () =>
      professions.reduce((map, profession) => {
        map[profession.id] = profession
        return map
      }, {}),
    [professions]
  )

  const projectWageRateUsageById = useMemo(
    () =>
      workerWageRates.reduce((map, rate) => {
        if (!rate.project_id) {
          return map
        }

        map[rate.project_id] = (map[rate.project_id] ?? 0) + 1
        return map
      }, {}),
    [workerWageRates]
  )

  const projectWorkerUsageById = useMemo(
    () =>
      workers.reduce((map, worker) => {
        if (!worker.default_project_id) {
          return map
        }

        map[worker.default_project_id] = (map[worker.default_project_id] ?? 0) + 1
        return map
      }, {}),
    [workers]
  )

  const categoryUsageById = useMemo(
    () =>
      materials.reduce((map, material) => {
        if (!material.category_id) {
          return map
        }

        map[material.category_id] = (map[material.category_id] ?? 0) + 1
        return map
      }, {}),
    [materials]
  )

  const professionUsageById = useMemo(
    () =>
      workers.reduce((map, worker) => {
        if (!worker.profession_id) {
          return map
        }

        map[worker.profession_id] = (map[worker.profession_id] ?? 0) + 1
        return map
      }, {}),
    [workers]
  )

  const workerRateUsageById = useMemo(
    () =>
      workerWageRates.reduce((map, rate) => {
        if (!rate.worker_id) {
          return map
        }

        map[rate.worker_id] = (map[rate.worker_id] ?? 0) + 1
        return map
      }, {}),
    [workerWageRates]
  )

  const masterUsageContext = useMemo(
    () => ({
      projectsById,
      projectWageRateUsageById,
      projectWorkerUsageById,
      categoryUsageById,
      professionUsageById,
      workerRateUsageById,
    }),
    [
      categoryUsageById,
      professionUsageById,
      projectsById,
      projectWageRateUsageById,
      projectWorkerUsageById,
      workerRateUsageById,
    ]
  )

  const workerRatesByWorkerId = useMemo(
    () =>
      workerWageRates.reduce((map, rate) => {
        if (!map[rate.worker_id]) {
          map[rate.worker_id] = []
        }

        map[rate.worker_id].push(rate)
        return map
      }, {}),
    [workerWageRates]
  )

  const currentConfig = masterTabs.find((tab) => tab.key === activeTab) ?? masterTabs[0]
  const currentRecords = collections[currentConfig.stateKey] ?? []

  const openCreateForm = () => {
    setFeedbackMessage(null)
    navigate(`/master/${currentConfig.routeKey}/add`)
  }

  const openEditForm = (record) => {
    setFeedbackMessage(null)
    navigate(`/master/${currentConfig.routeKey}/edit/${record.id}`)
  }

  const handleDelete = async (record) => {
    const action = useMasterStore.getState()[currentConfig.deleteAction]

    if (typeof action !== 'function') {
      return
    }

    const deleteGuard = currentConfig.getDeleteGuard?.(record, masterUsageContext)

    if (deleteGuard?.blocked) {
      setFeedbackMessage(deleteGuard.reason)
      return
    }

    const confirmed = window.confirm(
      `Yakin ingin menghapus ${currentConfig.label.toLowerCase()} ini?`
    )

    if (!confirmed) {
      return
    }

    await action(record.id)
    setFeedbackMessage(`${currentConfig.label} berhasil dihapus secara soft delete.`)
  }

  const renderWorkerDescription = (worker) => {
    const professionName =
      professionMap[worker.profession_id]?.profession_name ??
      professionMap[worker.profession_id]?.name ??
      'Profesi belum diisi'
    const rateCount = workerRatesByWorkerId[worker.id]?.length ?? 0

    return `${professionName} | ${worker.status || 'active'} | ${rateCount} tarif upah`
  }

  if (!currentTeamId) {
    return (
      <ProtectedRoute
        requiredCapability="master_data_admin"
        description="Master data hanya tersedia untuk Owner dan Admin."
      >
        <AppCard className="app-tone-warning space-y-3">
          <p className="app-kicker text-[var(--app-tone-warning-text)]">Workspace Belum Aktif</p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">
            Team aktif belum tersedia.
          </h2>
          <p className="text-sm leading-6 text-[var(--app-tone-warning-text)]/80">
            Login ulang atau selesaikan onboarding agar manager master data bisa
            memuat workspace yang benar.
          </p>
        </AppCard>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute
      requiredCapability="master_data_admin"
      description="Master data universal hanya tersedia untuk Owner dan Admin."
    >
      <section className="space-y-4">
        <AppCardStrong className="space-y-4 sm:p-5">
          <SectionHeader
            eyebrow="Master Data Manager"
            action={
              <AppButton
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={openCreateForm}
                type="button"
              >
                {currentConfig.createLabel}
              </AppButton>
            }
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            {masterTabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = tab.key === activeTab

              return (
                <button
                  key={tab.key}
                  className={`inline-flex min-w-fit items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'border-[var(--app-accent-color)]/20 bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]'
                      : 'border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]'
                  }`}
                  onClick={() => {
                    setActiveTab(tab.key)
                    setFeedbackMessage(null)
                  }}
                  type="button"
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </AppCardStrong>

        <AppCardStrong className="space-y-4 sm:p-5">
          <SectionHeader
            eyebrow={currentConfig.label}
            title={currentConfig.description}
            description={`${currentRecords.length} data aktif tersedia untuk workspace ini.`}
            action={
              isLoading ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-2 text-sm text-[var(--app-hint-color)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sinkronisasi
                </div>
              ) : null
            }
          />

          {feedbackMessage ? (
            <AppCard
              className={`p-4 ${
                feedbackMessage.toLowerCase().includes('dipakai')
                  ? 'app-tone-warning'
                  : 'app-tone-success'
              }`}
            >
              <p className="text-sm leading-6">{feedbackMessage}</p>
            </AppCard>
          ) : null}

          {error ? (
            <AppErrorState
              title="Master data gagal dimuat"
              description={error}
            />
          ) : null}

          <div className="space-y-3">
            {currentRecords.length > 0 ? (
              currentRecords.map((record) => {
                const workerRates = workerRatesByWorkerId[record.id] ?? []
                const primaryTitle =
                  record.name ||
                  record.project_name ||
                  record.supplier_name ||
                  record.creditor_name ||
                  record.profession_name ||
                  record.staff_name ||
                  record.worker_name ||
                  'Tanpa Nama'
                const badges = currentConfig.getBadges?.(record) ?? []
                const primaryBadge = badges[0] ?? null
                const hiddenBadges = badges.slice(1)
                const recordDescription =
                  currentConfig.key === 'workers'
                    ? renderWorkerDescription(record)
                    : currentConfig.getDescription?.(record)
                const detailLines =
                  currentConfig.getDetails?.(record, masterUsageContext) ?? []
                const deleteGuard = currentConfig.getDeleteGuard?.(record, masterUsageContext)
                const workerDetailLines =
                  currentConfig.key === 'workers'
                    ? workerRates.map(
                        (rate) =>
                          `${rate.project_name || 'Proyek'} | ${rate.role_name} | ${formatCurrency(rate.wage_amount)}`
                      )
                    : []

                return (
                  <ActionCard
                    key={record.id}
                    title={primaryTitle}
                    subtitle={
                      currentConfig.key === 'workers'
                        ? recordDescription
                        : recordDescription || 'Data referensi aktif'
                    }
                    badge={primaryBadge}
                    badges={hiddenBadges}
                    details={[...detailLines, ...workerDetailLines]}
                    className="bg-[var(--app-surface-strong-color)] px-4 py-4"
                    leadingIcon={
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                        {currentConfig.key === 'workers' ? (
                          <Users2 className="h-4 w-4" />
                        ) : (
                          <FolderKanban className="h-4 w-4" />
                        )}
                      </span>
                    }
                    actions={[
                      {
                        id: 'edit',
                        label: 'Edit',
                        onClick: () => openEditForm(record),
                      },
                      {
                        id: 'delete',
                        label: 'Hapus',
                        destructive: true,
                        disabled: Boolean(deleteGuard?.blocked),
                        meta: deleteGuard?.label ?? null,
                        onClick: async () => {
                          try {
                            await handleDelete(record)
                          } catch (deleteError) {
                            console.error('Gagal menghapus master data:', deleteError)
                          }
                        },
                      },
                    ]}
                  />
                )
              })
            ) : (
              <AppEmptyState
                icon={<FolderKanban className="h-5 w-5" />}
                title={currentConfig.emptyTitle}
                description="Gunakan tombol tambah untuk membuat data pertama."
              />
            )}
          </div>
        </AppCardStrong>
      </section>
    </ProtectedRoute>
  )
}

export default MasterDataManager
