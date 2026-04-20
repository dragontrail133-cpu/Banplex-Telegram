import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BadgePlus, BriefcaseBusiness, FilePenLine, FolderTree, UserRoundCog } from 'lucide-react'
import FormLayout from '../components/layouts/FormLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import WorkerForm from '../components/WorkerForm'
import GenericMasterForm from '../components/master/GenericMasterForm'
import { masterTabs } from '../components/master/masterTabs'
import {
  AppBadge,
  AppCard,
  AppCardStrong,
  AppErrorState,
} from '../components/ui/AppPrimitives'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'

function getRouteTab(routeTab) {
  const normalizedValue = String(routeTab ?? '').trim().toLowerCase()

  return (
    masterTabs.find(
      (tab) =>
        tab.routeKey === normalizedValue ||
        tab.key === normalizedValue ||
        tab.key.replace(/s$/, '') === normalizedValue
    ) ?? null
  )
}

function getRecordTitle(record, tabConfig) {
  if (!record) {
    return tabConfig?.label ?? 'Master'
  }

  return (
    record.name ||
    record.project_name ||
    record.supplier_name ||
    record.creditor_name ||
    record.profession_name ||
    record.staff_name ||
    record.worker_name ||
    tabConfig?.label ||
    'Master'
  )
}

function MasterFormPage() {
  const navigate = useNavigate()
  const params = useParams()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const projects = useMasterStore((state) => state.projects)
  const categories = useMasterStore((state) => state.categories)
  const suppliers = useMasterStore((state) => state.suppliers)
  const fundingCreditors = useMasterStore((state) => state.fundingCreditors)
  const professions = useMasterStore((state) => state.professions)
  const workers = useMasterStore((state) => state.workers)
  const workerWageRates = useMasterStore((state) => state.workerWageRates)
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
  const fetchStaff = useMasterStore((state) => state.fetchStaff)
  const isLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)

  const tabConfig = useMemo(() => getRouteTab(params.tab), [params.tab])
  const recordId = String(params.id ?? '').trim()
  const isEditMode = recordId.length > 0
  const formId = `${tabConfig?.key ?? 'master'}-form`
  const formKey = `${tabConfig?.key ?? 'master'}-${recordId || 'new'}-${
    currentTeamId ?? 'workspace'
  }`

  const collections = useMemo(
    () => ({
      projects,
      categories,
      suppliers,
      fundingCreditors,
      professions,
      workers,
      staffMembers,
    }),
    [
      categories,
      fundingCreditors,
      professions,
      projects,
      staffMembers,
      suppliers,
      workers,
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

  const currentRecord = tabConfig
    ? collections[tabConfig.stateKey]?.find((record) => String(record.id) === recordId) ?? null
    : null

  const recordTitle = getRecordTitle(currentRecord, tabConfig)

  useEffect(() => {
    void Promise.all([
      fetchProjects(),
      fetchExpenseCategories(),
      fetchSuppliers(),
      fetchFundingCreditors(),
      fetchProfessions(),
      fetchWorkers(),
      fetchWorkerWageRates(),
      fetchStaff(),
    ]).catch((error) => {
      console.error('Gagal memuat master form:', error)
    })
  }, [
    fetchExpenseCategories,
    fetchFundingCreditors,
    fetchProfessions,
    fetchProjects,
    fetchStaff,
    fetchSuppliers,
    fetchWorkerWageRates,
    fetchWorkers,
  ])

  const handleBack = () => {
    navigate('/master')
  }

  const handleSubmit = async (payload) => {
    if (!tabConfig) {
      throw new Error('Konfigurasi master data tidak ditemukan.')
    }

    const actionName = isEditMode ? tabConfig.updateAction : tabConfig.createAction
    const action = useMasterStore.getState()[actionName]

    if (typeof action !== 'function') {
      throw new Error('Aksi master data tidak tersedia.')
    }

    if (isEditMode) {
      await action(recordId, payload)
    } else {
      await action({
        ...payload,
        team_id: currentTeamId,
      })
    }

    navigate('/master', { replace: true })
  }

  if (!tabConfig) {
    return (
      <ProtectedRoute requiredCapability="master_data_admin" description="Master form tidak tersedia.">
        <section className="app-page-surface px-4 py-4">
          <AppErrorState
            title="Form master tidak ditemukan"
            description="Konfigurasi route master tidak cocok dengan daftar tab yang tersedia."
          />
        </section>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute
      requiredCapability="master_data_admin"
      description="Form master hanya tersedia untuk Owner dan Admin."
    >
      <FormLayout
        actionLabel={isEditMode ? 'Simpan Perubahan' : tabConfig.createLabel}
        formId={formId}
        isSubmitting={isLoading}
        onBack={handleBack}
        submitDisabled={Boolean(masterError)}
        title={`${isEditMode ? 'Edit' : 'Tambah'} ${tabConfig.label}`}
      >
        <div className="space-y-4">
          <AppCardStrong className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <AppBadge tone="info" icon={isEditMode ? FilePenLine : BadgePlus}>
                  {isEditMode ? 'Mode Edit' : 'Data Baru'}
                </AppBadge>
                <div>
                  <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                    {isEditMode ? recordTitle : `Buat ${tabConfig.label.toLowerCase()} baru`}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-hint-color)]">
                    {tabConfig.description}
                  </p>
                </div>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                {tabConfig.key === 'workers' ? (
                  <UserRoundCog className="h-5 w-5" />
                ) : tabConfig.key === 'projects' ? (
                  <BriefcaseBusiness className="h-5 w-5" />
                ) : (
                  <FolderTree className="h-5 w-5" />
                )}
              </span>
            </div>

          </AppCardStrong>

          {masterError ? (
            <AppErrorState
              title="Sinkronisasi master bermasalah"
              description={masterError}
            />
          ) : null}

          {tabConfig.customForm === 'worker' ? (
            <WorkerForm
              key={`${formKey}-${workerRatesByWorkerId[recordId]?.length ?? 0}`}
              formId={formId}
              hideActions
              initialWageRates={workerRatesByWorkerId[currentRecord?.id] ?? []}
              initialWorker={currentRecord}
              isSubmitting={isLoading}
              onSubmit={handleSubmit}
            />
          ) : (
            <GenericMasterForm
              key={formKey}
              config={tabConfig}
              formId={formId}
              hideActions
              initialData={currentRecord}
              isSubmitting={isLoading}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </FormLayout>
    </ProtectedRoute>
  )
}

export default MasterFormPage
