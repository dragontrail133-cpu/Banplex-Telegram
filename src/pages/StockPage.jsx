import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  Boxes,
  ChevronRight,
  History,
  Loader2,
  PackagePlus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListCard,
  AppListRow,
  AppSelect,
  AppSheet,
  PageHeader,
  PageSection,
  PageShell,
} from '../components/ui/AppPrimitives'
import useMutationToast from '../hooks/useMutationToast'
import {
  createManualStockOutFromApi,
  fetchStockMovementsFromApi,
  fetchStockOverviewFromApi,
  fetchStockProjectOptionsFromApi,
} from '../lib/records-api'
import { canUseCapability, capabilityContracts } from '../lib/capabilities'
import useAuthStore from '../store/useAuthStore'

const STOCK_PAGE_SIZE = 25
const MOVEMENT_PAGE_SIZE = 20

const stockFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 3,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const emptySummary = {
  total: 0,
  normal: 0,
  low: 0,
  empty: 0,
}

const emptyPage = {
  limit: STOCK_PAGE_SIZE,
  offset: 0,
  total: 0,
  hasMore: false,
}

const stockTabOptions = [
  { label: 'Stok', value: 'stock' },
  { label: 'Riwayat', value: 'history' },
]

const stockFilterOptions = [
  { label: 'Semua', value: 'all' },
  { label: 'Normal', value: 'normal' },
  { label: 'Rendah', value: 'low' },
  { label: 'Habis', value: 'empty' },
]

const stockSortOptions = [
  { label: 'Prioritas', value: 'priority' },
  { label: 'Nama A-Z', value: 'name_asc' },
  { label: 'Stok terendah', value: 'stock_asc' },
  { label: 'Stok tertinggi', value: 'stock_desc' },
  { label: 'Update terbaru', value: 'updated_desc' },
]

const movementDirectionOptions = [
  { label: 'Semua', value: 'all' },
  { label: 'Masuk', value: 'in' },
  { label: 'Keluar', value: 'out' },
]

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function formatStockValue(value) {
  return stockFormatter.format(toNumber(value))
}

function formatStockDate(value) {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return dateFormatter.format(parsedDate)
}

function formatStockDateTime(value) {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return dateTimeFormatter.format(parsedDate)
}

function getStockState(material) {
  const currentStock = toNumber(material?.current_stock)
  const reorderPoint = toNumber(material?.reorder_point)

  if (currentStock <= 0) {
    return 'empty'
  }

  if (reorderPoint > 0 && currentStock <= reorderPoint) {
    return 'low'
  }

  return 'normal'
}

function getStockStateLabel(state) {
  if (state === 'empty') {
    return 'Habis'
  }

  if (state === 'low') {
    return 'Rendah'
  }

  return 'Normal'
}

function getStockStateTone(state) {
  if (state === 'empty') {
    return 'danger'
  }

  if (state === 'low') {
    return 'warning'
  }

  return 'success'
}

function getMovementDocumentRoute(transaction) {
  const expenseId = normalizeText(transaction?.expense_id, '')

  if (!expenseId) {
    return null
  }

  return `/transactions/${expenseId}`
}

function getMovementDirection(transaction) {
  return normalizeText(transaction?.direction, 'in').toLowerCase() === 'out' ? 'out' : 'in'
}

function getMovementSourceLabel(transaction) {
  const sourceType = normalizeText(transaction?.source_type, '').toLowerCase()

  if (sourceType === 'manual') {
    return 'Manual'
  }

  if (sourceType === 'delivery_order' || sourceType === 'surat_jalan') {
    return 'Surat Jalan'
  }

  if (sourceType === 'invoice' || sourceType === 'faktur' || sourceType === 'material_invoice') {
    return 'Faktur'
  }

  return 'Dokumen'
}

function normalizeProjectOption(project) {
  const projectName = normalizeText(project?.project_name ?? project?.name, 'Unit Kerja')
  const projectType = normalizeText(project?.project_type, null)
  const statusLabel = normalizeText(project?.status, null)
  const labels = [projectType, statusLabel].filter(Boolean).join(' · ')

  return {
    value: normalizeText(project?.id, ''),
    label: projectName,
    description: labels || (project?.is_active ? 'Aktif' : null),
    searchText: [projectName, projectType, statusLabel].filter(Boolean).join(' '),
  }
}

function normalizePage(page, fallbackLimit) {
  return {
    limit: Number.isFinite(Number(page?.limit)) ? Number(page.limit) : fallbackLimit,
    offset: Number.isFinite(Number(page?.offset)) ? Number(page.offset) : 0,
    total: Number.isFinite(Number(page?.total)) ? Number(page.total) : 0,
    hasMore: Boolean(page?.hasMore),
  }
}

function useDebouncedValue(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}

function ChipToggleRow({ ariaLabel, options, value, onChange }) {
  return (
    <div role="group" aria-label={ariaLabel}>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isActive = value === option.value

          return (
            <AppButton
              key={option.value}
              aria-pressed={isActive}
              className="min-h-11 w-full rounded-full px-3 py-2.5 text-center text-xs leading-5 whitespace-normal"
              onClick={() => onChange(option.value)}
              size="sm"
              type="button"
              variant={isActive ? 'primary' : 'secondary'}
            >
              {option.label}
            </AppButton>
          )
        })}
      </div>
    </div>
  )
}

function StockSummaryCard({ label, value, tone = 'neutral' }) {
  return (
    <AppCard className="p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
        {label}
      </p>
      <p
        className={[
          'mt-2 text-xl font-semibold',
          tone === 'danger'
            ? 'text-[var(--app-destructive-color)]'
            : tone === 'warning'
              ? 'text-[var(--app-warning-color)]'
              : 'text-[var(--app-text-color)]',
        ].join(' ')}
      >
        {value}
      </p>
    </AppCard>
  )
}

function StockMaterialRow({ material, onOpen }) {
  const state = getStockState(material)
  const statusTone = getStockStateTone(state)
  const unit = normalizeText(material?.unit, '')
  const reorderPoint = toNumber(material?.reorder_point)
  const description = [
    unit ? `Satuan ${unit}` : null,
    reorderPoint > 0 ? `Min ${formatStockValue(reorderPoint)}` : null,
    material?.updated_at ? `Update ${formatStockDate(material.updated_at)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <AppListRow
      className="cursor-pointer rounded-[22px] border-b-0 px-3 py-3 transition active:bg-[var(--app-surface-low-color)]"
      leading={
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-surface-low-color)] text-[var(--app-hint-color)]">
          <Boxes className="h-4 w-4" />
        </span>
      }
      onClick={() => onOpen(material.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(material.id)
        }
      }}
      role="button"
      tabIndex={0}
      title={normalizeText(material?.name, 'Material')}
      description={description}
      trailing={
        <div className="flex items-start gap-2 text-right">
          <div>
            <p className="text-base font-semibold text-[var(--app-text-color)]">
              {formatStockValue(material?.current_stock)}
              {unit ? <span className="ml-1 text-xs text-[var(--app-hint-color)]">{unit}</span> : null}
            </p>
            <AppBadge tone={statusTone}>{getStockStateLabel(state)}</AppBadge>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 text-[var(--app-hint-color)]" />
        </div>
      }
    />
  )
}

function StockMovementCard({ transaction, onOpenDocument }) {
  const movementDirection = getMovementDirection(transaction)
  const movementDateTime = formatStockDateTime(transaction?.transaction_date ?? transaction?.created_at)
  const movementName = normalizeText(transaction?.material_name, 'Material')
  const movementQuantity = formatStockValue(transaction?.quantity)
  const movementUnit = normalizeText(transaction?.material_unit, '')
  const documentRoute = getMovementDocumentRoute(transaction)
  const projectName = normalizeText(transaction?.project_name, '')
  const sourceLabel = getMovementSourceLabel(transaction)
  const description = [movementDateTime, projectName, sourceLabel].filter(Boolean).join(' · ')

  return (
    <AppCard
      as={documentRoute ? 'button' : 'article'}
      className={[
        'w-full p-3 text-left transition active:scale-[0.99]',
        documentRoute ? 'cursor-pointer hover:bg-[var(--app-surface-low-color)]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={documentRoute ? () => onOpenDocument(documentRoute) : undefined}
      type={documentRoute ? 'button' : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className={[
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            movementDirection === 'out'
              ? 'bg-[var(--app-destructive-color)]/10 text-[var(--app-destructive-color)]'
              : 'bg-[var(--app-success-color)]/10 text-[var(--app-success-color)]',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {movementDirection === 'out' ? (
            <ArrowDownLeft className="h-4 w-4" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                {movementName}
              </h3>
              <p className="mt-1 truncate text-xs leading-5 text-[var(--app-hint-color)]">
                {description}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold text-[var(--app-text-color)]">
              {movementDirection === 'out' ? '-' : '+'}
              {movementQuantity}
              {movementUnit ? ' ' + movementUnit : ''}
            </p>
          </div>
        </div>
      </div>
    </AppCard>
  )
}

function StockPageContent() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const currentRole = useAuthStore((state) => state.role)

  const activeTab = searchParams.get('tab') === 'history' ? 'history' : 'stock'
  const [materialSearchTerm, setMaterialSearchTerm] = useState('')
  const [movementSearchTerm, setMovementSearchTerm] = useState('')
  const debouncedMaterialSearch = useDebouncedValue(materialSearchTerm)
  const debouncedMovementSearch = useDebouncedValue(movementSearchTerm)
  const [stockSummary, setStockSummary] = useState(emptySummary)
  const [materials, setMaterials] = useState([])
  const [materialPage, setMaterialPage] = useState(emptyPage)
  const [stockTransactions, setStockTransactions] = useState([])
  const [movementPage, setMovementPage] = useState({
    ...emptyPage,
    limit: MOVEMENT_PAGE_SIZE,
  })
  const [stockStatusFilter, setStockStatusFilter] = useState('all')
  const [stockSort, setStockSort] = useState('priority')
  const [movementDirectionFilter, setMovementDirectionFilter] = useState('all')
  const [isMaterialLoading, setIsMaterialLoading] = useState(false)
  const [isMovementLoading, setIsMovementLoading] = useState(false)
  const [hasLoadedMovements, setHasLoadedMovements] = useState(false)
  const [materialError, setMaterialError] = useState(null)
  const [movementError, setMovementError] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [isStockFilterSheetOpen, setIsStockFilterSheetOpen] = useState(false)
  const [isMovementFilterSheetOpen, setIsMovementFilterSheetOpen] = useState(false)
  const [detailMaterialId, setDetailMaterialId] = useState(null)
  const [projectOptions, setProjectOptions] = useState([])
  const [hasLoadedProjectOptions, setHasLoadedProjectOptions] = useState(false)
  const [isProjectOptionsLoading, setIsProjectOptionsLoading] = useState(false)
  const [projectOptionsError, setProjectOptionsError] = useState(null)
  const [isManualOutSheetOpen, setIsManualOutSheetOpen] = useState(false)
  const [manualOutProjectId, setManualOutProjectId] = useState('')
  const [manualOutMaterialId, setManualOutMaterialId] = useState('')
  const [manualOutQuantity, setManualOutQuantity] = useState('')
  const [isManualOutSubmitting, setIsManualOutSubmitting] = useState(false)
  const { begin, fail, succeed } = useMutationToast()
  const canManageManualStockOut = canUseCapability(
    currentRole,
    capabilityContracts.manual_stock_out.key
  )

  const selectedDetailMaterial = useMemo(() => {
    return materials.find((material) => material.id === detailMaterialId) ?? null
  }, [detailMaterialId, materials])

  const selectedManualOutMaterial = useMemo(() => {
    return materials.find((material) => material.id === manualOutMaterialId) ?? null
  }, [manualOutMaterialId, materials])

  const selectedManualOutProject = useMemo(() => {
    return projectOptions.find((project) => project.value === manualOutProjectId) ?? null
  }, [manualOutProjectId, projectOptions])

  const manualOutQuantityValue = useMemo(() => {
    const parsedValue = Number(manualOutQuantity)

    return Number.isFinite(parsedValue) ? parsedValue : 0
  }, [manualOutQuantity])

  const projectedRemainingStock = useMemo(() => {
    if (!selectedManualOutMaterial) {
      return null
    }

    return toNumber(selectedManualOutMaterial.current_stock) - Math.trunc(manualOutQuantityValue || 0)
  }, [manualOutQuantityValue, selectedManualOutMaterial])

  const setActiveTab = useCallback(
    (nextTab) => {
      const nextSearchParams = new URLSearchParams(searchParams)

      if (nextTab === 'history') {
        nextSearchParams.set('tab', 'history')
      } else {
        nextSearchParams.delete('tab')
      }

      setSearchParams(nextSearchParams, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const loadMaterials = useCallback(
    async ({ offset = 0, append = false } = {}) => {
      if (!currentTeamId) {
        setMaterials([])
        setStockSummary(emptySummary)
        setMaterialPage(emptyPage)
        setMaterialError(null)
        setLastUpdatedAt(null)
        return
      }

      setIsMaterialLoading(true)

      try {
        const result = await fetchStockOverviewFromApi(currentTeamId, {
          limit: STOCK_PAGE_SIZE,
          offset,
          search: debouncedMaterialSearch,
          status: stockStatusFilter,
          sort: stockSort,
        })
        const nextMaterials = Array.isArray(result.materials) ? result.materials : []

        setMaterials((current) => (append ? [...current, ...nextMaterials] : nextMaterials))
        setStockSummary(result.summary ?? emptySummary)
        setMaterialPage(normalizePage(result.page, STOCK_PAGE_SIZE))
        setMaterialError(null)
        setLastUpdatedAt(new Date().toISOString())
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : 'Gagal memuat data stok.'

        setMaterialError(message)
        if (!append) {
          setMaterials([])
          setMaterialPage(emptyPage)
        }
      } finally {
        setIsMaterialLoading(false)
      }
    },
    [currentTeamId, debouncedMaterialSearch, stockSort, stockStatusFilter]
  )

  const loadMovements = useCallback(
    async ({ offset = 0, append = false } = {}) => {
      if (!currentTeamId) {
        setStockTransactions([])
        setMovementPage({
          ...emptyPage,
          limit: MOVEMENT_PAGE_SIZE,
        })
        setMovementError(null)
        setHasLoadedMovements(false)
        return
      }

      setIsMovementLoading(true)

      try {
        const result = await fetchStockMovementsFromApi(currentTeamId, {
          limit: MOVEMENT_PAGE_SIZE,
          offset,
          search: debouncedMovementSearch,
          direction: movementDirectionFilter,
        })
        const nextRows = Array.isArray(result.stockTransactions) ? result.stockTransactions : []

        setStockTransactions((current) => (append ? [...current, ...nextRows] : nextRows))
        setMovementPage(normalizePage(result.page, MOVEMENT_PAGE_SIZE))
        setMovementError(null)
        setHasLoadedMovements(true)
        setLastUpdatedAt(new Date().toISOString())
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : 'Gagal memuat riwayat stok.'

        setMovementError(message)
        if (!append) {
          setStockTransactions([])
          setMovementPage({
            ...emptyPage,
            limit: MOVEMENT_PAGE_SIZE,
          })
        }
      } finally {
        setIsMovementLoading(false)
      }
    },
    [currentTeamId, debouncedMovementSearch, movementDirectionFilter]
  )

  useEffect(() => {
    void loadMaterials()
  }, [loadMaterials])

  useEffect(() => {
    setHasLoadedMovements(false)
    setStockTransactions([])
    setMovementPage({
      ...emptyPage,
      limit: MOVEMENT_PAGE_SIZE,
    })
  }, [currentTeamId, debouncedMovementSearch, movementDirectionFilter])

  useEffect(() => {
    if (activeTab !== 'history' || hasLoadedMovements || isMovementLoading) {
      return
    }

    void loadMovements()
  }, [activeTab, hasLoadedMovements, isMovementLoading, loadMovements])

  useEffect(() => {
    setHasLoadedProjectOptions(false)
    setProjectOptions([])
    setProjectOptionsError(null)
    setIsProjectOptionsLoading(false)
  }, [currentTeamId, canManageManualStockOut])

  const loadProjectOptions = useCallback(async () => {
    if (!canManageManualStockOut) {
      setProjectOptions([])
      setProjectOptionsError(null)
      setHasLoadedProjectOptions(false)
      return
    }

    if (!currentTeamId) {
      setProjectOptions([])
      setProjectOptionsError(null)
      setHasLoadedProjectOptions(false)
      return
    }

    setIsProjectOptionsLoading(true)

    try {
      const projects = await fetchStockProjectOptionsFromApi(currentTeamId)
      setProjectOptions((Array.isArray(projects) ? projects : []).map(normalizeProjectOption))
      setProjectOptionsError(null)
      setHasLoadedProjectOptions(true)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Gagal memuat Unit Kerja.'

      setProjectOptions([])
      setProjectOptionsError(message)
      setHasLoadedProjectOptions(false)
    } finally {
      setIsProjectOptionsLoading(false)
    }
  }, [canManageManualStockOut, currentTeamId])

  useEffect(() => {
    if (!isManualOutSheetOpen || hasLoadedProjectOptions || isProjectOptionsLoading) {
      return
    }

    void loadProjectOptions()
  }, [
    hasLoadedProjectOptions,
    isManualOutSheetOpen,
    isProjectOptionsLoading,
    loadProjectOptions,
  ])

  const openManualStockOutSheet = useCallback(
    (materialId = '') => {
      if (!canManageManualStockOut || !materialId) {
        return
      }

      setDetailMaterialId(null)
      setManualOutProjectId('')
      setManualOutMaterialId(materialId)
      setManualOutQuantity('')
      setIsManualOutSheetOpen(true)
    },
    [canManageManualStockOut]
  )

  const closeManualStockOutSheet = useCallback(() => {
    if (isManualOutSubmitting) {
      return
    }

    setIsManualOutSheetOpen(false)
    setManualOutProjectId('')
    setManualOutQuantity('')
    setManualOutMaterialId('')
  }, [isManualOutSubmitting])

  const submitManualStockOut = useCallback(
    async (event) => {
      event.preventDefault()

      if (!canManageManualStockOut) {
        fail({
          title: 'Stock-out gagal disimpan',
          message: 'Role Anda tidak diizinkan untuk stock-out manual.',
        })
        return
      }

      const selectedMaterial = materials.find((material) => material.id === manualOutMaterialId)
      const selectedProject = projectOptions.find((project) => project.value === manualOutProjectId)

      if (!selectedMaterial) {
        fail({
          title: 'Stock-out gagal disimpan',
          message: 'Material wajib dipilih.',
        })
        return
      }

      if (!selectedProject) {
        fail({
          title: 'Stock-out gagal disimpan',
          message: 'Unit Kerja wajib dipilih.',
        })
        return
      }

      const quantity = Math.trunc(Number(manualOutQuantity))

      if (!Number.isFinite(quantity) || quantity <= 0) {
        fail({
          title: 'Stock-out gagal disimpan',
          message: 'Qty keluar harus lebih dari 0.',
        })
        return
      }

      if (toNumber(selectedMaterial.current_stock) - quantity < 0) {
        fail({
          title: 'Stock-out gagal disimpan',
          message: 'Qty keluar melebihi stok saat ini.',
        })
        return
      }

      setIsManualOutSubmitting(true)

      begin({
        title: 'Menyimpan stock-out',
        message: 'Mohon tunggu sampai stok keluar manual selesai diproses.',
      })

      try {
        await createManualStockOutFromApi({
          teamId: currentTeamId,
          projectId: selectedProject.value,
          materialId: selectedMaterial.id,
          quantity,
          notes: `Stock-out manual untuk ${normalizeText(selectedMaterial.name, 'material')}`,
        })

        setIsManualOutSheetOpen(false)
        setManualOutProjectId('')
        setManualOutQuantity('')
        setManualOutMaterialId('')
        await Promise.all([
          loadMaterials(),
          hasLoadedMovements ? loadMovements() : Promise.resolve(),
        ])
        succeed({
          title: 'Stock-out tersimpan',
          message: 'Pergerakan stok berhasil diperbarui.',
        })
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Gagal menyimpan stock-out manual.'

        fail({
          title: 'Stock-out gagal disimpan',
          message,
        })
      } finally {
        setIsManualOutSubmitting(false)
      }
    },
    [
      begin,
      canManageManualStockOut,
      currentTeamId,
      fail,
      hasLoadedMovements,
      loadMaterials,
      loadMovements,
      manualOutMaterialId,
      manualOutProjectId,
      manualOutQuantity,
      materials,
      projectOptions,
      succeed,
    ]
  )

  const refreshCurrentTab = useCallback(() => {
    if (activeTab === 'history') {
      void loadMovements()
      return
    }

    void loadMaterials()
  }, [activeTab, loadMaterials, loadMovements])

  const openMovementSourceDocument = useCallback(
    (route) => {
      if (!route) {
        return
      }

      navigate(route)
    },
    [navigate]
  )

  const openStockInDocument = useCallback(() => {
    navigate('/material-invoice/new', {
      state: {
        returnTo: activeTab === 'history' ? '/stock?tab=history' : '/stock',
      },
    })
  }, [activeTab, navigate])

  const isInitialMaterialLoading = isMaterialLoading && materials.length === 0
  const isInitialMovementLoading = isMovementLoading && stockTransactions.length === 0
  const isMaterialEmpty = !isMaterialLoading && !materialError && stockSummary.total === 0
  const isMaterialFilteredEmpty =
    !isMaterialLoading && !materialError && stockSummary.total > 0 && materials.length === 0
  const isMovementEmpty =
    !isMovementLoading && !movementError && hasLoadedMovements && stockTransactions.length === 0

  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitoring"
        title="Stok Barang"
        backAction={() => navigate('/more')}
        action={
          <div className="flex items-center gap-2">
            <AppButton
              aria-label="Muat ulang"
              iconOnly
              onClick={refreshCurrentTab}
              size="sm"
              type="button"
              variant="secondary"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isMaterialLoading || isMovementLoading ? 'animate-spin' : ''
                }`}
              />
            </AppButton>
            <AppButton
              leadingIcon={<PackagePlus className="h-4 w-4" />}
              onClick={openStockInDocument}
              size="sm"
              type="button"
            >
              Tambah
            </AppButton>
          </div>
        }
      />

      <AppCardStrong className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <StockSummaryCard label="Barang" value={stockSummary.total} />
          <StockSummaryCard label="Rendah" value={stockSummary.low} tone="warning" />
          <StockSummaryCard label="Habis" value={stockSummary.empty} tone="danger" />
        </div>

        <ChipToggleRow
          ariaLabel="Tab stok"
          options={stockTabOptions}
          value={activeTab}
          onChange={setActiveTab}
        />
      </AppCardStrong>

      {activeTab === 'stock' ? (
        <>
          <AppCardStrong className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Cari material
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint-color)]" />
                <AppInput
                  className="pl-11"
                  placeholder="Nama material atau satuan"
                  value={materialSearchTerm}
                  onChange={(event) => setMaterialSearchTerm(event.target.value)}
                />
              </div>
            </label>

            <ChipToggleRow
              ariaLabel="Filter status stok"
              options={stockFilterOptions}
              value={stockStatusFilter}
              onChange={setStockStatusFilter}
            />
          </AppCardStrong>

          {materialError ? (
            <AppErrorState
              description={materialError}
              title="Stok gagal dimuat"
              action={
                <AppButton onClick={() => void loadMaterials()} size="sm" variant="secondary">
                  Coba lagi
                </AppButton>
              }
            />
          ) : null}

          {isInitialMaterialLoading ? (
            <AppEmptyState
              description="Menarik data stok terbaru dari server."
              icon={<Loader2 className="h-10 w-10 animate-spin" />}
              title="Memuat stok barang"
            />
          ) : null}

          {isMaterialEmpty ? (
            <AppEmptyState
              icon={<Boxes className="h-10 w-10" />}
              title="Belum ada material aktif"
            />
          ) : null}

          {materials.length > 0 ? (
            <PageSection
              eyebrow={`${materialPage.total} hasil`}
              title="Barang Aktif"
              action={
                <AppButton
                  leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
                  onClick={() => setIsStockFilterSheetOpen(true)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Urutkan
                </AppButton>
              }
            >
              <div className="space-y-2">
                {materials.map((material) => (
                  <StockMaterialRow
                    key={material.id}
                    material={material}
                    onOpen={setDetailMaterialId}
                  />
                ))}
              </div>

              {materialPage.hasMore ? (
                <AppButton
                  className="mt-3"
                  disabled={isMaterialLoading}
                  fullWidth
                  onClick={() => void loadMaterials({ offset: materials.length, append: true })}
                  type="button"
                  variant="secondary"
                >
                  {isMaterialLoading ? 'Memuat...' : 'Muat lagi'}
                </AppButton>
              ) : null}
            </PageSection>
          ) : null}

          {isMaterialFilteredEmpty ? (
            <AppEmptyState
              icon={<Search className="h-10 w-10" />}
              title="Tidak ada material yang cocok"
            />
          ) : null}
        </>
      ) : (
        <>
          <AppCardStrong className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Cari riwayat
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint-color)]" />
                <AppInput
                  className="pl-11"
                  placeholder="Material, Unit Kerja, atau catatan"
                  value={movementSearchTerm}
                  onChange={(event) => setMovementSearchTerm(event.target.value)}
                />
              </div>
            </label>
          </AppCardStrong>

          {movementError ? (
            <AppErrorState
              description={movementError}
              title="Riwayat stok gagal dimuat"
              action={
                <AppButton onClick={() => void loadMovements()} size="sm" variant="secondary">
                  Coba lagi
                </AppButton>
              }
            />
          ) : null}

          {isInitialMovementLoading ? (
            <AppEmptyState
              description="Menarik pergerakan stok terbaru."
              icon={<Loader2 className="h-10 w-10 animate-spin" />}
              title="Memuat riwayat stok"
            />
          ) : null}

          <PageSection
            eyebrow={`${movementPage.total} hasil`}
            title="Riwayat Stok"
            action={
              <AppButton
                leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
                onClick={() => setIsMovementFilterSheetOpen(true)}
                size="sm"
                type="button"
                variant="secondary"
              >
                Filter
              </AppButton>
            }
          >
            {stockTransactions.length > 0 ? (
              <div className="space-y-2">
                {stockTransactions.map((transaction) => (
                  <StockMovementCard
                    key={transaction.id}
                    onOpenDocument={openMovementSourceDocument}
                    transaction={transaction}
                  />
                ))}
              </div>
            ) : null}

            {movementPage.hasMore ? (
              <AppButton
                className="mt-3"
                disabled={isMovementLoading}
                fullWidth
                onClick={() =>
                  void loadMovements({ offset: stockTransactions.length, append: true })
                }
                type="button"
                variant="secondary"
              >
                {isMovementLoading ? 'Memuat...' : 'Muat lagi'}
              </AppButton>
            ) : null}

            {isMovementEmpty ? (
              <AppEmptyState
                icon={<History className="h-10 w-10" />}
                title="Belum ada pergerakan stok"
              />
            ) : null}
          </PageSection>
        </>
      )}

      <AppSheet
        contentClassName="px-4 py-3"
        onClose={() => setIsStockFilterSheetOpen(false)}
        open={isStockFilterSheetOpen}
        title="Urutkan Stok"
      >
        <div className="space-y-4">
          <ChipToggleRow
            ariaLabel="Urutkan stok"
            options={stockSortOptions}
            value={stockSort}
            onChange={setStockSort}
          />

          <div className="grid grid-cols-2 gap-2">
            <AppButton
              onClick={() => {
                setStockSort('priority')
                setIsStockFilterSheetOpen(false)
              }}
              size="sm"
              variant="secondary"
              fullWidth
            >
              Reset
            </AppButton>
            <AppButton onClick={() => setIsStockFilterSheetOpen(false)} size="sm" fullWidth>
              Terapkan
            </AppButton>
          </div>
        </div>
      </AppSheet>

      <AppSheet
        contentClassName="px-4 py-3"
        onClose={() => setIsMovementFilterSheetOpen(false)}
        open={isMovementFilterSheetOpen}
        title="Filter Riwayat"
      >
        <div className="space-y-4">
          <ChipToggleRow
            ariaLabel="Arah pergerakan"
            options={movementDirectionOptions}
            value={movementDirectionFilter}
            onChange={setMovementDirectionFilter}
          />

          <div className="grid grid-cols-2 gap-2">
            <AppButton
              onClick={() => {
                setMovementDirectionFilter('all')
                setIsMovementFilterSheetOpen(false)
              }}
              size="sm"
              variant="secondary"
              fullWidth
            >
              Reset
            </AppButton>
            <AppButton onClick={() => setIsMovementFilterSheetOpen(false)} size="sm" fullWidth>
              Terapkan
            </AppButton>
          </div>
        </div>
      </AppSheet>

      <AppSheet
        contentClassName="px-4 pt-2 pb-3"
        onClose={() => setDetailMaterialId(null)}
        open={Boolean(selectedDetailMaterial)}
        title={normalizeText(selectedDetailMaterial?.name, 'Detail Material')}
      >
        {selectedDetailMaterial ? (
          <div className="space-y-3">
            <AppCardDashed className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
                    Stok tersedia
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--app-text-color)]">
                    {formatStockValue(selectedDetailMaterial.current_stock)}
                    {selectedDetailMaterial.unit ? (
                      <span className="ml-1 text-sm text-[var(--app-hint-color)]">
                        {selectedDetailMaterial.unit}
                      </span>
                    ) : null}
                  </p>
                </div>
                <AppBadge tone={getStockStateTone(getStockState(selectedDetailMaterial))}>
                  {getStockStateLabel(getStockState(selectedDetailMaterial))}
                </AppBadge>
              </div>
            </AppCardDashed>

            <AppListCard className="space-y-0 overflow-hidden p-2">
              <AppListRow
                title="Batas minimum"
                trailing={
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    {formatStockValue(selectedDetailMaterial.reorder_point)}
                  </span>
                }
              />
              <AppListRow
                title="Update terakhir"
                trailing={
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    {formatStockDate(selectedDetailMaterial.updated_at)}
                  </span>
                }
              />
            </AppListCard>

            <div className="grid grid-cols-2 gap-2">
              <AppButton onClick={() => setDetailMaterialId(null)} size="sm" variant="secondary">
                Tutup
              </AppButton>
              <AppButton
                disabled={!selectedDetailMaterial || toNumber(selectedDetailMaterial.current_stock) <= 0}
                onClick={() => openManualStockOutSheet(selectedDetailMaterial?.id)}
                size="sm"
              >
                Stock keluar
              </AppButton>
            </div>
          </div>
        ) : null}
      </AppSheet>

      {canManageManualStockOut ? (
        <AppSheet
          contentClassName="px-4 pt-2 pb-3"
          onClose={closeManualStockOutSheet}
          open={isManualOutSheetOpen}
          title="Stok Keluar Manual"
        >
          <form className="space-y-4" id="manual-stock-out-form" onSubmit={submitManualStockOut}>
            {selectedManualOutMaterial ? (
              <AppCardDashed className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                      {normalizeText(selectedManualOutMaterial.name, 'Material')}
                    </p>
                    <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                      Stok saat ini {formatStockValue(selectedManualOutMaterial.current_stock)}
                      {selectedManualOutMaterial.unit ? ' ' + selectedManualOutMaterial.unit : ''}
                    </p>
                  </div>
                  <AppBadge tone={getStockStateTone(getStockState(selectedManualOutMaterial))}>
                    {getStockStateLabel(getStockState(selectedManualOutMaterial))}
                  </AppBadge>
                </div>
              </AppCardDashed>
            ) : null}

            <div className="space-y-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Unit Kerja
                </span>

                {projectOptionsError ? (
                  <AppErrorState
                    description={projectOptionsError}
                    title="Unit Kerja gagal dimuat"
                  />
                ) : null}

                {isProjectOptionsLoading ? (
                  <AppEmptyState
                    description="Menarik opsi Unit Kerja dari server."
                    icon={<Loader2 className="h-10 w-10 animate-spin" />}
                    title="Memuat Unit Kerja aktif"
                  />
                ) : projectOptions.length > 0 ? (
                  <AppSelect
                    value={manualOutProjectId}
                    onChange={(event) => setManualOutProjectId(event.target.value)}
                  >
                    <option value="">Pilih Unit Kerja</option>
                    {projectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        {option.description ? ` - ${option.description}` : ''}
                      </option>
                    ))}
                  </AppSelect>
                ) : (
                  <AppEmptyState
                    icon={<Boxes className="h-10 w-10" />}
                    title="Belum ada Unit Kerja aktif"
                  />
                )}

                {selectedManualOutProject ? (
                  <AppCardDashed className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
                      Unit Kerja terpilih
                    </p>
                    <p className="text-sm font-semibold text-[var(--app-text-color)]">
                      {selectedManualOutProject.label}
                    </p>
                  </AppCardDashed>
                ) : null}
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Qty keluar</span>
              <AppInput
                min="1"
                onChange={(event) => setManualOutQuantity(event.target.value)}
                placeholder="Contoh: 3"
                type="number"
                value={manualOutQuantity}
              />
            </label>

            {selectedManualOutMaterial ? (
              <AppCardDashed className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    Sisa setelah keluar
                  </span>
                  <span className="text-sm text-[var(--app-hint-color)]">
                    {manualOutQuantityValue > 0 ? formatStockValue(projectedRemainingStock) : '-'}
                  </span>
                </div>
                {manualOutQuantityValue > 0 &&
                projectedRemainingStock !== null &&
                projectedRemainingStock < 0 ? (
                  <p className="text-sm font-medium text-[var(--app-destructive-color)]">
                    Qty keluar melebihi stok saat ini.
                  </p>
                ) : null}
              </AppCardDashed>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <AppButton onClick={closeManualStockOutSheet} size="sm" variant="secondary">
                Batal
              </AppButton>
              <AppButton
                disabled={isManualOutSubmitting || !manualOutProjectId}
                size="sm"
                type="submit"
              >
                Simpan stock-out
              </AppButton>
            </div>
          </form>
        </AppSheet>
      ) : null}

      {lastUpdatedAt ? (
        <p className="px-1 text-xs text-[var(--app-hint-color)]">
          Diperbarui terakhir {formatStockDate(lastUpdatedAt)}
        </p>
      ) : null}
    </PageShell>
  )
}

function StockPage() {
  return (
    <ProtectedRoute
      requiredCapability={capabilityContracts.manual_stock_out.key}
      description="Stok Barang tersedia untuk Owner, Admin, dan Logistik."
    >
      <StockPageContent />
    </ProtectedRoute>
  )
}

export default StockPage
