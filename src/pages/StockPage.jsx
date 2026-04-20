import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, AlertTriangle, Boxes, RefreshCw, Search, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppInput,
  AppListCard,
  AppListRow,
  AppSheet,
  AppWrapToggleGroup,
  PageHeader,
  PageSection,
  PageShell,
} from '../components/ui/AppPrimitives'
import {
  createManualStockOutFromApi,
  fetchStockOverviewFromApi,
  fetchStockProjectOptionsFromApi,
} from '../lib/records-api'
import { canUseCapability } from '../lib/capabilities'
import useAuthStore from '../store/useAuthStore'

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

const stockFilterOptions = [
  { label: 'Semua', value: 'all' },
  { label: 'Normal', value: 'normal' },
  { label: 'Rendah', value: 'low' },
  { label: 'Habis', value: 'empty' },
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

function normalizeProjectOption(project) {
  const projectName = normalizeText(project?.project_name ?? project?.name, 'Unit Kerja')
  const projectType = normalizeText(project?.project_type, null)
  const statusLabel = normalizeText(project?.status, null)
  const labels = [projectType, statusLabel]
    .filter(Boolean)
    .join(' · ')

  return {
    value: normalizeText(project?.id, ''),
    label: projectName,
    description: labels || (project?.is_active ? 'Aktif' : null),
    searchText: [projectName, projectType, statusLabel].filter(Boolean).join(' '),
  }
}

function sortMaterials(left, right) {
  const leftState = getStockState(left)
  const rightState = getStockState(right)
  const stateRank = {
    empty: 0,
    low: 1,
    normal: 2,
  }

  if (stateRank[leftState] !== stateRank[rightState]) {
    return stateRank[leftState] - stateRank[rightState]
  }

  const stockComparison = toNumber(left?.current_stock) - toNumber(right?.current_stock)

  if (stockComparison !== 0) {
    return stockComparison
  }

  return normalizeText(left?.name, '').localeCompare(normalizeText(right?.name, ''), 'id', {
    sensitivity: 'base',
  })
}

function StockMovementCard({ transaction, onOpenDocument }) {
  const movementDirection = getMovementDirection(transaction)
  const movementDateTime = formatStockDateTime(transaction?.transaction_date ?? transaction?.created_at)
  const movementName = normalizeText(transaction?.material_name, 'Material')
  const movementQuantity = formatStockValue(transaction?.quantity)
  const movementUnit = normalizeText(transaction?.material_unit, '')
  const documentRoute = getMovementDocumentRoute(transaction)

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
            <h3 className="truncate text-sm font-semibold text-[var(--app-text-color)]">
              {movementName}
            </h3>
            <p className="shrink-0 text-sm font-semibold text-[var(--app-text-color)]">
              {movementDirection === 'out' ? '-' : '+'}
              {movementQuantity}
              {movementUnit ? ' ' + movementUnit : ''}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">{movementDateTime}</p>
        </div>
      </div>
    </AppCard>
  )
}

function StockPageContent() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const currentRole = useAuthStore((state) => state.role)
  const [materials, setMaterials] = useState([])
  const [stockTransactions, setStockTransactions] = useState([])
  const [projectOptions, setProjectOptions] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [isProjectOptionsLoading, setIsProjectOptionsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [projectOptionsError, setProjectOptionsError] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [isManualOutSheetOpen, setIsManualOutSheetOpen] = useState(false)
  const [manualOutProjectId, setManualOutProjectId] = useState('')
  const [manualOutProjectSearch, setManualOutProjectSearch] = useState('')
  const [manualOutMaterialId, setManualOutMaterialId] = useState('')
  const [manualOutQuantity, setManualOutQuantity] = useState('')
  const [isManualOutSubmitting, setIsManualOutSubmitting] = useState(false)
  const [manualOutError, setManualOutError] = useState(null)
  const canManageManualStockOut = canUseCapability(currentRole, 'manual_stock_out')


  const filteredProjectOptions = useMemo(() => {
    const search = manualOutProjectSearch.trim().toLowerCase()

    if (!search) {
      return projectOptions
    }

    return projectOptions.filter((option) =>
      [option.label, option.description, option.searchText]
        .filter(Boolean)
        .some((item) => item.toLowerCase().includes(search))
    )
  }, [manualOutProjectSearch, projectOptions])

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

  const openManualStockOutSheet = useCallback(
    (materialId = '') => {
      if (!canManageManualStockOut || !materialId) {
        return
      }

      setManualOutError(null)
      setManualOutProjectId('')
      setManualOutProjectSearch('')
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
    setManualOutError(null)
    setManualOutProjectId('')
    setManualOutProjectSearch('')
    setManualOutQuantity('')
    setManualOutMaterialId('')
  }, [isManualOutSubmitting])

  const loadProjectOptions = useCallback(async () => {
    if (!canManageManualStockOut) {
      setProjectOptions([])
      setProjectOptionsError(null)
      return
    }

    if (!currentTeamId) {
      setProjectOptions([])
      setProjectOptionsError(null)
      return
    }

    setIsProjectOptionsLoading(true)

    try {
      const result = await fetchStockProjectOptionsFromApi(currentTeamId)
      setProjectOptions(Array.isArray(result) ? result.map(normalizeProjectOption) : [])
      setProjectOptionsError(null)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Gagal memuat Unit Kerja aktif.'

      setProjectOptions([])
      setProjectOptionsError(message)
    } finally {
      setIsProjectOptionsLoading(false)
    }
  }, [canManageManualStockOut, currentTeamId])

  const loadOverview = useCallback(
    async ({ preserveSearch = true } = {}) => {
      if (!currentTeamId) {
        setMaterials([])
        setStockTransactions([])
        setError(null)
        setLastUpdatedAt(null)
        return
      }

      setIsLoading(true)

      try {
        const result = await fetchStockOverviewFromApi(currentTeamId, { limit: 8 })
        setMaterials(Array.isArray(result.materials) ? result.materials : [])
        setStockTransactions(Array.isArray(result.stockTransactions) ? result.stockTransactions : [])
        setError(null)
        setLastUpdatedAt(new Date().toISOString())
        if (!preserveSearch) {
          setSearchTerm('')
          setFilter('all')
        }
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Gagal memuat data stok.'

        setError(message)
        setMaterials([])
        setStockTransactions([])
      } finally {
        setIsLoading(false)
      }
    },
    [currentTeamId]
  )

  useEffect(() => {
    void loadOverview()
  }, [loadOverview])

  useEffect(() => {
    void loadProjectOptions()
  }, [loadProjectOptions])
  const submitManualStockOut = useCallback(
    async (event) => {
      event.preventDefault()

      if (!canManageManualStockOut) {
        setManualOutError('Role Anda tidak diizinkan untuk stock-out manual.')
        return
      }

      const selectedMaterial = materials.find((material) => material.id === manualOutMaterialId)
      const selectedProject = projectOptions.find((project) => project.value === manualOutProjectId)

      if (!selectedMaterial) {
        setManualOutError('Material wajib dipilih.')
        return
      }

      if (!selectedProject) {
        setManualOutError('Unit Kerja wajib dipilih.')
        return
      }

      const quantity = Math.trunc(Number(manualOutQuantity))

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setManualOutError('Qty keluar harus lebih dari 0.')
        return
      }

      setIsManualOutSubmitting(true)
      setManualOutError(null)

      try {
        await createManualStockOutFromApi({
          teamId: currentTeamId,
          projectId: selectedProject.value,
          materialId: selectedMaterial.id,
          quantity,
          notes: "Stock-out manual untuk " + normalizeText(selectedMaterial.name, "material"),
        })

        setIsManualOutSheetOpen(false)
        setManualOutProjectId('')
        setManualOutProjectSearch('')
        setManualOutQuantity('')
        setManualOutMaterialId('')
        await loadOverview({ preserveSearch: true })
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'Gagal menyimpan stock-out manual.'

        setManualOutError(message)
      } finally {
        setIsManualOutSubmitting(false)
      }
    },
    [
      canManageManualStockOut,
      currentTeamId,
      loadOverview,
      manualOutMaterialId,
      manualOutProjectId,
      manualOutQuantity,
      materials,
      projectOptions,
    ]
  )

  const filteredMaterials = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return [...materials]
      .filter((material) => {
        const stockState = getStockState(material)

        if (filter !== 'all' && stockState !== filter) {
          return false
        }

        if (!search) {
          return true
        }

        const haystack = [
          material?.name,
          material?.material_name,
          material?.unit,
        ]
          .map((value) => normalizeText(value, '').toLowerCase())
          .join(' ')

        return haystack.includes(search)
      })
      .sort(sortMaterials)
  }, [filter, materials, searchTerm])

  const materialStats = useMemo(() => {
    return materials.reduce(
      (accumulator, material) => {
        const state = getStockState(material)
        accumulator.total += 1
        accumulator[state] += 1
        return accumulator
      },
      {
        total: 0,
        normal: 0,
        low: 0,
        empty: 0,
      }
    )
  }, [materials])

  const movementRows = useMemo(() => {
    return [...stockTransactions].sort((left, right) => {
      const leftDate = new Date(left?.transaction_date ?? left?.created_at ?? 0).getTime()
      const rightDate = new Date(right?.transaction_date ?? right?.created_at ?? 0).getTime()

      return rightDate - leftDate
    })
  }, [stockTransactions])

  const openMovementSourceDocument = useCallback(
    (route) => {
      if (!route) {
        return
      }

      navigate(route)
    },
    [navigate]
  )

  const isEmptyState = !isLoading && materials.length === 0 && !error

  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitoring"
        title="Stok Barang"
        backAction={() => navigate('/more')}
        action={
          <AppButton
            leadingIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={() => void loadOverview({ preserveSearch: true })}
            size="sm"
            type="button"
            variant="secondary"
          >
            Muat ulang
          </AppButton>
        }
      />

      <AppCardStrong className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <AppCard className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
              Total barang
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--app-text-color)]">
              {materialStats.total}
            </p>
          </AppCard>
          <AppCard className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
              Rendah
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--app-text-color)]">
              {materialStats.low}
            </p>
          </AppCard>
          <AppCard className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
              Habis
            </p>
            <p className="mt-2 text-xl font-semibold text-[var(--app-text-color)]">
              {materialStats.empty}
            </p>
          </AppCard>
        </div>

        <div className="space-y-3">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Cari material
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint-color)]" />
              <AppInput
                className="pl-11"
                placeholder="Nama material, satuan, atau status"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </label>

          <AppWrapToggleGroup
            label="Filter status"
            options={stockFilterOptions}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </AppCardStrong>

      {error ? (
        <AppCard className="app-tone-danger space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Gagal memuat stok</p>
              <p className="text-sm leading-6">{error}</p>
            </div>
          </div>
        </AppCard>
      ) : null}

      {isLoading && materials.length === 0 ? (
        <AppCardDashed className="py-10 text-center text-sm text-[var(--app-hint-color)]">
          Memuat stok barang...
        </AppCardDashed>
      ) : null}

      {isEmptyState ? (
        <AppEmptyState
          icon={<Boxes className="h-10 w-10" />}
          title="Belum ada material aktif"
        />
      ) : null}

      {filteredMaterials.length > 0 ? (
        <PageSection eyebrow="Daftar Stok" title="Barang Aktif">
          <div className="space-y-2">
            {filteredMaterials.map((material) => {
              const state = getStockState(material)
              const statusTone = getStockStateTone(state)
              return (
                <AppListRow
                  key={material.id}
                  className="cursor-pointer active:bg-[var(--app-surface-low-color)]"
                  onClick={() => openManualStockOutSheet(material.id)}
                  leading={
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-surface-low-color)] text-[var(--app-hint-color)]">
                      <Boxes className="h-4 w-4" />
                    </span>
                  }
                  title={normalizeText(material?.name, 'Material')}
                  trailing={
                    <div className="text-right">
                      <p className="text-base font-semibold text-[var(--app-text-color)]">
                        {formatStockValue(material?.current_stock)}
                      </p>
                      <AppBadge tone={statusTone}>{getStockStateLabel(state)}</AppBadge>
                    </div>
                  }
                />
              )
            })}
          </div>
        </PageSection>
      ) : !isLoading && materials.length > 0 ? (
        <AppEmptyState
          icon={<Search className="h-10 w-10" />}
          title="Tidak ada material yang cocok"
        />
      ) : null}

      <PageSection eyebrow="Pergerakan" title="Riwayat Stok Terbaru">
        {movementRows.length > 0 ? (
          <div className="space-y-2">
            {movementRows.map((transaction) => (
              <StockMovementCard
                key={transaction.id}
                onOpenDocument={openMovementSourceDocument}
                transaction={transaction}
              />
            ))}
          </div>
        ) : (
          <AppEmptyState icon={<TrendingUp className="h-10 w-10" />} title="Belum ada pergerakan stok" />
        )}
      </PageSection>

      {canManageManualStockOut ? (
        <AppSheet
          className="mb-3 sm:mb-6"
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AppButton onClick={closeManualStockOutSheet} size="sm" variant="secondary">
                Batal
              </AppButton>
              <AppButton
                form="manual-stock-out-form"
                disabled={isManualOutSubmitting || !manualOutProjectId}
                size="sm"
                type="submit"
              >
                {isManualOutSubmitting ? 'Menyimpan...' : 'Simpan stock-out'}
              </AppButton>
            </div>
          }
          onClose={closeManualStockOutSheet}
          open={isManualOutSheetOpen}
          title="Stok Keluar Manual"
        >
          <form className="space-y-4 pt-2" id="manual-stock-out-form" onSubmit={submitManualStockOut}>
            {manualOutError ? (
              <AppCard className="app-tone-danger">
                <p className="text-sm leading-6">{manualOutError}</p>
              </AppCard>
            ) : null}

          <div className="space-y-2">
            <div className="space-y-1">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Unit Kerja
              </span>
            </div>

            <AppInput
              onChange={(event) => setManualOutProjectSearch(event.target.value)}
              placeholder="Cari Unit Kerja"
              value={manualOutProjectSearch}
            />

            {projectOptionsError ? (
              <AppCard className="app-tone-danger">
                <p className="text-sm leading-6">{projectOptionsError}</p>
              </AppCard>
            ) : null}

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

            {isProjectOptionsLoading ? (
              <AppCardDashed className="py-6 text-center text-sm text-[var(--app-hint-color)]">
                Memuat Unit Kerja aktif...
              </AppCardDashed>
            ) : filteredProjectOptions.length > 0 ? (
              <AppListCard className="space-y-0 overflow-hidden p-2">
                {filteredProjectOptions.map((option) => {
                  const isSelected = option.value === manualOutProjectId

                  return (
                    <button
                      key={option.value}
                      className={[
                        'flex w-full items-start justify-between gap-3 border-b border-[var(--app-border-color)] px-2 py-3 text-left last:border-b-0',
                        isSelected ? 'bg-[var(--app-accent-color)]/10' : 'hover:bg-[var(--app-surface-low-color)]',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        setManualOutProjectId(option.value)
                        setManualOutError(null)
                      }}
                      type="button"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                          {option.label}
                        </p>
                        {option.description ? (
                          <p className="truncate text-xs leading-5 text-[var(--app-hint-color)]">
                            {option.description}
                          </p>
                        ) : null}
                      </div>
                      <AppBadge tone={isSelected ? 'success' : 'neutral'}>
                        {isSelected ? 'Dipilih' : 'Pilih'}
                      </AppBadge>
                    </button>
                  )
                })}
              </AppListCard>
            ) : projectOptions.length > 0 && manualOutProjectSearch.trim() ? (
              <AppEmptyState icon={<Search className="h-10 w-10" />} title="Tidak ada Unit Kerja yang cocok" />
            ) : (
              <AppEmptyState icon={<Boxes className="h-10 w-10" />} title="Belum ada Unit Kerja aktif" />
            )}
          </div>

            <div className="space-y-2">
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
            </div>

            {selectedManualOutMaterial ? (
              <AppCardDashed className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    Stok saat ini
                  </span>
                  <span className="text-sm text-[var(--app-hint-color)]">
                    {normalizeText(selectedManualOutMaterial.unit, '-')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    {formatStockValue(selectedManualOutMaterial.current_stock)}
                  </span>
                  <span className="text-sm text-[var(--app-hint-color)]">
                    Sisa setelah keluar:{' '}
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
      requiredCapability="manual_stock_out"
      description="Stok Barang tersedia untuk Owner, Admin, dan Logistik."
    >
      <StockPageContent />
    </ProtectedRoute>
  )
}

export default StockPage
