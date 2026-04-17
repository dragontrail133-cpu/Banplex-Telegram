import { useState } from 'react'
import { CheckSquare2, FileText, Layers3 } from 'lucide-react'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppErrorState,
  AppInput,
  AppSelect,
  AppTextarea,
} from '../ui/AppPrimitives'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()
  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function buildFormState(fields, initialData = null) {
  return fields.reduce((state, field) => {
    const rawValue = initialData?.[field.sourceKey ?? field.name]

    if (field.type === 'checkbox') {
      state[field.name] = Boolean(rawValue ?? field.defaultValue ?? false)
      return state
    }

    if (rawValue == null || rawValue === '') {
      state[field.name] =
        field.defaultValue == null ? '' : String(field.defaultValue)
      return state
    }

    state[field.name] = field.type === 'number' ? String(rawValue) : rawValue
    return state
  }, {})
}

function parseFormValues(fields, formState) {
  const payload = {}

  for (const field of fields) {
    const value = formState[field.name]

    if (field.type === 'checkbox') {
      payload[field.name] = Boolean(value)
      continue
    }

    if (field.required && !normalizeText(value)) {
      throw new Error(`${field.label} wajib diisi.`)
    }

    if (field.type === 'number') {
      const normalizedValue = normalizeText(value)

      if (!normalizedValue) {
        payload[field.name] = field.allowNull ? null : 0
        continue
      }

      const parsedValue = Number(normalizedValue)

      if (!Number.isFinite(parsedValue)) {
        throw new Error(`${field.label} harus berupa angka yang valid.`)
      }

      payload[field.name] = parsedValue
      continue
    }

    payload[field.name] = normalizeText(value, null)
  }

  return payload
}

function getFieldIcon(fieldType) {
  if (fieldType === 'textarea') {
    return FileText
  }

  if (fieldType === 'checkbox') {
    return CheckSquare2
  }

  return Layers3
}

function GenericMasterForm({
  config,
  initialData = null,
  isSubmitting = false,
  formId = null,
  hideActions = false,
  onSubmit,
}) {
  const [formState, setFormState] = useState(() =>
    buildFormState(config.fields, initialData)
  )
  const [localError, setLocalError] = useState(null)

  const handleChange = (fieldName, nextValue) => {
    setFormState((current) => ({
      ...current,
      [fieldName]: nextValue,
    }))

    if (localError) {
      setLocalError(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      const payload = parseFormValues(config.fields, formState)
      await onSubmit(payload)
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Gagal menyimpan master data.'
      )
    }
  }

  return (
    <form id={formId ?? undefined} className="space-y-4" onSubmit={handleSubmit}>
      <AppCard className="space-y-4 bg-[var(--app-surface-strong-color)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="app-meta">Field Master</p>
            <p className="text-base font-semibold text-[var(--app-text-color)]">
              Lengkapi data {config.label.toLowerCase()}
            </p>
          </div>
          <AppBadge>{config.fields.length} field</AppBadge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {config.fields.map((field) => {
            const FieldIcon = getFieldIcon(field.type)

            if (field.type === 'textarea') {
              return (
                <AppCard
                  key={field.name}
                  className={`space-y-3 bg-white ${field.fullWidth ? 'sm:col-span-2' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                      <FieldIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--app-text-color)]">
                        {field.label}
                      </p>
                      {field.placeholder ? (
                        <p className="text-xs text-[var(--app-hint-color)]">
                          {field.placeholder}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <AppTextarea
                    name={field.name}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                    placeholder={field.placeholder}
                    value={formState[field.name] ?? ''}
                  />
                </AppCard>
              )
            }

            if (field.type === 'select') {
              return (
                <AppCard key={field.name} className="space-y-3 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                      <FieldIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--app-text-color)]">
                        {field.label}
                      </p>
                      <p className="text-xs text-[var(--app-hint-color)]">
                        Pilih opsi yang sesuai.
                      </p>
                    </div>
                  </div>
                  <AppSelect
                    name={field.name}
                    onChange={(event) => handleChange(field.name, event.target.value)}
                    value={formState[field.name] ?? ''}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </AppSelect>
                </AppCard>
              )
            }

            if (field.type === 'checkbox') {
              return (
                <AppCard
                  key={field.name}
                  className={`space-y-3 bg-white ${field.fullWidth ? 'sm:col-span-2' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                      <FieldIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--app-text-color)]">
                        {field.label}
                      </p>
                      <p className="text-xs text-[var(--app-hint-color)]">
                        Aktifkan jika opsi ini perlu dipakai dalam flow operasional.
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-3 rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-3 text-sm font-medium text-[var(--app-text-color)]">
                    <input
                      checked={Boolean(formState[field.name])}
                      className="h-4 w-4 rounded border-slate-300 text-[var(--app-accent-color)] focus:ring-[var(--app-accent-color)]"
                      name={field.name}
                      onChange={(event) =>
                        handleChange(field.name, event.target.checked)
                      }
                      type="checkbox"
                    />
                    {field.label}
                  </label>
                </AppCard>
              )
            }

            return (
              <AppCard
                key={field.name}
                className={`space-y-3 bg-white ${field.fullWidth ? 'sm:col-span-2' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                    <FieldIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--app-text-color)]">
                      {field.label}
                    </p>
                    {field.placeholder ? (
                      <p className="text-xs text-[var(--app-hint-color)]">
                        {field.placeholder}
                      </p>
                    ) : null}
                  </div>
                </div>
                <AppInput
                  inputMode={field.inputMode}
                  min={field.min}
                  name={field.name}
                  onChange={(event) => handleChange(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  step={field.step}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={formState[field.name] ?? ''}
                />
              </AppCard>
            )
          })}
        </div>
      </AppCard>

      {localError ? (
        <AppErrorState
          title="Form master belum valid"
          description={localError}
        />
      ) : null}

      {hideActions ? null : (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AppButton type="button" variant="secondary">
            Batal
          </AppButton>

          <AppButton disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </AppButton>
        </div>
      )}
    </form>
  )
}

export default GenericMasterForm
