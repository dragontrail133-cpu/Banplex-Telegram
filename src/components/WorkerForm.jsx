import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, CircleDollarSign, Plus, Trash2, UserRound } from 'lucide-react'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppErrorState,
  AppInput,
  AppSelect,
  AppTextarea,
} from './ui/AppPrimitives'
import useMasterStore from '../store/useMasterStore'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function createEmptyWageRate() {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    projectId: '',
    roleName: '',
    wageAmount: '',
    isDefault: false,
  }
}

function buildInitialState(worker, wageRates = []) {
  return {
    name: worker?.worker_name ?? worker?.name ?? '',
    telegramUserId: worker?.telegram_user_id ?? '',
    professionId: worker?.profession_id ?? '',
    status: worker?.status ?? 'active',
    defaultProjectId: worker?.default_project_id ?? '',
    defaultRoleName: worker?.default_role_name ?? '',
    notes: worker?.notes ?? '',
    wageRates:
      wageRates.length > 0
        ? wageRates.map((rate) => ({
            id: rate.id ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            projectId: rate.project_id ?? '',
            roleName: rate.role_name ?? '',
            wageAmount: rate.wage_amount != null ? String(rate.wage_amount) : '',
            isDefault: Boolean(rate.is_default),
          }))
        : [createEmptyWageRate()],
  }
}

function getProjectName(project) {
  return project?.project_name ?? project?.name ?? 'Proyek'
}

function getProfessionName(profession) {
  return profession?.profession_name ?? profession?.name ?? 'Profesi'
}

function WorkerForm({
  initialWorker = null,
  initialWageRates = [],
  isSubmitting = false,
  onCancel,
  formId = null,
  hideActions = false,
  onSubmit,
}) {
  const [formState, setFormState] = useState(() =>
    buildInitialState(initialWorker, initialWageRates)
  )
  const [localError, setLocalError] = useState(null)
  const projects = useMasterStore((state) => state.projects)
  const professions = useMasterStore((state) => state.professions)
  const fetchProjects = useMasterStore((state) => state.fetchProjects)
  const fetchProfessions = useMasterStore((state) => state.fetchProfessions)

  useEffect(() => {
    void Promise.all([
      fetchProjects().catch((error) => {
        console.error('Gagal memuat proyek untuk form pekerja:', error)
      }),
      fetchProfessions().catch((error) => {
        console.error('Gagal memuat profesi untuk form pekerja:', error)
      }),
    ])
  }, [fetchProfessions, fetchProjects])

  const selectedDefaultProjectName = useMemo(() => {
    return (
      projects.find((project) => project.id === formState.defaultProjectId)
        ?.project_name ??
      projects.find((project) => project.id === formState.defaultProjectId)?.name ??
      null
    )
  }, [formState.defaultProjectId, projects])

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    setFormState((current) => ({
      ...current,
      [name]: value,
    }))

    if (localError) {
      setLocalError(null)
    }
  }

  const handleWageRateChange = (rateId, field, value) => {
    setFormState((current) => ({
      ...current,
      wageRates: current.wageRates.map((rate) => {
        if (rate.id !== rateId) {
          return field === 'isDefault' && value ? { ...rate, isDefault: false } : rate
        }

        return {
          ...rate,
          [field]: value,
        }
      }),
    }))

    if (localError) {
      setLocalError(null)
    }
  }

  const handleAddWageRate = () => {
    setFormState((current) => ({
      ...current,
      wageRates: [...current.wageRates, createEmptyWageRate()],
    }))
  }

  const handleRemoveWageRate = (rateId) => {
    setFormState((current) => ({
      ...current,
      wageRates:
        current.wageRates.length > 1
          ? current.wageRates.filter((rate) => rate.id !== rateId)
          : current.wageRates,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const workerName = normalizeText(formState.name)

    if (!workerName) {
      setLocalError('Nama pekerja wajib diisi.')
      return
    }

    const normalizedWageRates = formState.wageRates
      .map((rate) => ({
        project_id: normalizeText(rate.projectId),
        role_name: normalizeText(rate.roleName),
        wage_amount: Number(rate.wageAmount),
        is_default: Boolean(rate.isDefault),
      }))
      .filter((rate) => rate.project_id || rate.role_name || rate.wage_amount)

    for (const [index, rate] of normalizedWageRates.entries()) {
      if (!rate.project_id) {
        setLocalError(`Proyek pada baris upah ${index + 1} wajib dipilih.`)
        return
      }

      if (!rate.role_name) {
        setLocalError(`Role pada baris upah ${index + 1} wajib diisi.`)
        return
      }

      if (!Number.isFinite(rate.wage_amount) || rate.wage_amount <= 0) {
        setLocalError(`Nominal upah pada baris ${index + 1} harus lebih dari 0.`)
        return
      }
    }

    try {
      await onSubmit?.({
        worker_name: workerName,
        telegram_user_id: normalizeText(formState.telegramUserId, null),
        profession_id: normalizeText(formState.professionId, null),
        status: normalizeText(formState.status, 'active'),
        default_project_id: normalizeText(formState.defaultProjectId, null),
        default_role_name: normalizeText(formState.defaultRoleName, null),
        notes: normalizeText(formState.notes, null),
        wage_rates: normalizedWageRates,
      })
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Gagal menyimpan data pekerja.'
      )
    }
  }

  return (
    <form id={formId ?? undefined} className="space-y-4" onSubmit={handleSubmit}>
      <AppCard className="space-y-4 bg-[var(--app-surface-strong-color)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="app-meta">Profil Pekerja</p>
            <p className="text-base font-semibold text-[var(--app-text-color)]">
              Identitas dan penugasan default
            </p>
          </div>
          <AppBadge tone="info" icon={UserRound}>
            Worker Profile
          </AppBadge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AppCard className="space-y-3 bg-white">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Nama Pekerja
            </p>
            <AppInput
              name="name"
              onChange={handleFieldChange}
              placeholder="Contoh: Budi Santoso"
              value={formState.name}
            />
          </AppCard>

          <AppCard className="space-y-3 bg-white">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Telegram User ID
            </p>
            <AppInput
              name="telegramUserId"
              onChange={handleFieldChange}
              placeholder="Opsional"
              value={formState.telegramUserId}
            />
          </AppCard>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AppCard className="space-y-3 bg-white">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Profesi
            </p>
            <AppSelect
              name="professionId"
              onChange={handleFieldChange}
              value={formState.professionId}
            >
              <option value="">Pilih profesi</option>
              {professions.map((profession) => (
                <option key={profession.id} value={profession.id}>
                  {getProfessionName(profession)}
                </option>
              ))}
            </AppSelect>
          </AppCard>

          <AppCard className="space-y-3 bg-white">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Status
            </p>
            <AppSelect
              name="status"
              onChange={handleFieldChange}
              value={formState.status}
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </AppSelect>
          </AppCard>
        </div>
      </AppCard>

      <AppCard className="space-y-4 bg-[var(--app-surface-strong-color)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="app-meta">Penugasan Default</p>
            <p className="text-base font-semibold text-[var(--app-text-color)]">
              Proyek dan role utama
            </p>
          </div>
          <AppBadge icon={BriefcaseBusiness}>Assignment</AppBadge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AppCard className="space-y-3 bg-white">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Proyek Default
            </p>
            <AppSelect
              name="defaultProjectId"
              onChange={handleFieldChange}
              value={formState.defaultProjectId}
            >
              <option value="">Pilih proyek default</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectName(project)}
                </option>
              ))}
            </AppSelect>
          </AppCard>

          <AppCard className="space-y-3 bg-white">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Role Default
            </p>
            <AppInput
              name="defaultRoleName"
              onChange={handleFieldChange}
              placeholder={
                selectedDefaultProjectName
                  ? `Contoh role di ${selectedDefaultProjectName}`
                  : 'Contoh: Tukang Besi'
              }
              value={formState.defaultRoleName}
            />
          </AppCard>
        </div>

        <AppCard className="space-y-3 bg-white">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Catatan
          </p>
          <AppTextarea
            name="notes"
            onChange={handleFieldChange}
            placeholder="Tambahkan catatan jika diperlukan."
            value={formState.notes}
          />
        </AppCard>
      </AppCard>

      <AppCard className="space-y-4 bg-[var(--app-surface-strong-color)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="app-meta">Skema Upah</p>
            <p className="text-base font-semibold text-[var(--app-text-color)]">
              Upah per proyek dan role
            </p>
            <p className="text-sm leading-6 text-[var(--app-hint-color)]">
              Tambahkan kombinasi proyek-role dengan nominal yang berlaku untuk pekerja ini.
            </p>
          </div>

          <AppButton
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={handleAddWageRate}
            type="button"
          >
            Tambah Upah
          </AppButton>
        </div>

        <div className="space-y-3">
          {formState.wageRates.map((rate, index) => (
            <AppCard
              key={rate.id}
              className="space-y-4 bg-white px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--app-text-color)]">
                    Upah #{index + 1}
                  </p>
                  <p className="text-xs text-[var(--app-hint-color)]">
                    Atur proyek, role, dan nominal.
                  </p>
                </div>

                <AppButton
                  iconOnly
                  variant="secondary"
                  className="rounded-[18px]"
                  disabled={formState.wageRates.length === 1}
                  onClick={() => handleRemoveWageRate(rate.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </AppButton>
              </div>

              <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Proyek
                </p>
                <AppSelect
                  onChange={(event) =>
                    handleWageRateChange(rate.id, 'projectId', event.target.value)
                  }
                  value={rate.projectId}
                >
                  <option value="">Pilih proyek</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {getProjectName(project)}
                    </option>
                  ))}
                </AppSelect>
              </AppCard>

              <div className="grid gap-4 sm:grid-cols-2">
                <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
                  <p className="text-sm font-semibold text-[var(--app-text-color)]">
                    Role
                  </p>
                  <AppInput
                    onChange={(event) =>
                      handleWageRateChange(rate.id, 'roleName', event.target.value)
                    }
                    placeholder="Contoh: Tukang"
                    value={rate.roleName}
                  />
                </AppCard>

                <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-[var(--app-accent-color)]" />
                    <p className="text-sm font-semibold text-[var(--app-text-color)]">
                      Nominal Upah
                    </p>
                  </div>
                  <AppInput
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      handleWageRateChange(rate.id, 'wageAmount', event.target.value)
                    }
                    placeholder="0"
                    step="0.01"
                    type="number"
                    value={rate.wageAmount}
                  />
                </AppCard>
              </div>

              <label className="inline-flex items-center gap-3 rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-3 text-sm font-medium text-[var(--app-text-color)]">
                <input
                  checked={rate.isDefault}
                  className="h-4 w-4 rounded border-slate-300 text-[var(--app-accent-color)] focus:ring-[var(--app-accent-color)]"
                  onChange={(event) =>
                    handleWageRateChange(rate.id, 'isDefault', event.target.checked)
                  }
                  type="checkbox"
                />
                Jadikan default untuk kombinasi proyek-role ini
              </label>
            </AppCard>
          ))}
        </div>
      </AppCard>

      {localError ? (
        <AppErrorState
          title="Form pekerja belum valid"
          description={localError}
        />
      ) : null}

      {hideActions ? null : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AppButton onClick={onCancel} type="button" variant="secondary">
            Batal
          </AppButton>

          <AppButton disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Pekerja'}
          </AppButton>
        </div>
      )}
    </form>
  )
}

export default WorkerForm
