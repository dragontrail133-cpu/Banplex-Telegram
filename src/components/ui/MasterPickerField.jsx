import { useMemo, useState } from 'react'
import { AppButton, AppInput, AppSheet } from './AppPrimitives'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizePickerOption(option = {}) {
  const value = normalizeText(option?.value ?? option?.id, '')
  const label = normalizeText(option?.label ?? option?.name, '')
  const description = normalizeText(option?.description, '')
  const searchText = normalizeText(
    option?.searchText ?? [label, description].filter(Boolean).join(' '),
    ''
  )

  return {
    value,
    label,
    description,
    searchText,
  }
}

function MasterPickerField({
  label,
  value = '',
  options = [],
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Pilih data',
  searchPlaceholder = 'Cari data...',
  emptyMessage = 'Data belum tersedia.',
  helperText = null,
  title = null,
  name = null,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const normalizedOptions = useMemo(
    () => options.map((option) => normalizePickerOption(option)).filter((option) => option.value),
    [options]
  )

  const selectedOption = useMemo(
    () => normalizedOptions.find((option) => option.value === normalizeText(value, '')),
    [normalizedOptions, value]
  )

  const filteredOptions = useMemo(() => {
    const normalizedSearchTerm = normalizeText(searchTerm, '').toLowerCase()

    if (!normalizedSearchTerm) {
      return normalizedOptions
    }

    return normalizedOptions.filter((option) =>
      [option.label, option.description, option.searchText]
        .filter(Boolean)
        .some((item) => item.toLowerCase().includes(normalizedSearchTerm))
    )
  }, [normalizedOptions, searchTerm])

  const handleSelect = (nextValue) => {
    if (disabled) {
      return
    }

    onChange?.(nextValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--app-text-color)]">
          {label}
          {required ? <span className="ml-1 text-[var(--app-destructive-color)]">*</span> : null}
        </span>
      </div>

      <button
        className={[
          'flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left outline-none transition',
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            : 'border-slate-200 bg-white/90 text-[var(--app-text-color)] hover:border-sky-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200',
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-base font-semibold">
            {selectedOption?.label ?? placeholder}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-accent-color)]">
          Ubah
        </span>
      </button>

      {name ? (
        <input
          aria-hidden="true"
          className="sr-only"
          name={name}
          onChange={() => {}}
          tabIndex={-1}
          type="text"
          value={value ?? ''}
          required={required}
        />
      ) : null}

      {helperText && !selectedOption?.description ? (
        <p className="text-sm leading-6 text-[var(--app-hint-color)]">{helperText}</p>
      ) : null}

      <AppSheet
        description={title ?? label}
        open={isOpen}
        onClose={() => {
          setIsOpen(false)
          setSearchTerm('')
        }}
        title={title ?? label}
      >
        <div className="space-y-4">
          <AppInput
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
            value={searchTerm}
          />

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isActive = option.value === normalizeText(value, '')

                return (
                  <button
                    key={option.value}
                    className={[
                      'w-full rounded-[20px] border px-4 py-3 text-left transition',
                      isActive
                        ? 'border-[var(--app-accent-color)] bg-[var(--app-accent-color)]/10'
                        : 'border-[var(--app-outline-soft)] bg-[var(--app-surface-strong-color)]',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleSelect(option.value)}
                    type="button"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                        {option.label}
                      </p>
                      {option.description ? (
                        <p className="text-xs leading-5 text-[var(--app-hint-color)]">
                          {option.description}
                        </p>
                      ) : null}
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="rounded-[20px] border border-dashed border-[var(--app-outline-soft)] px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
                {emptyMessage}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <AppButton
              fullWidth
              onClick={() => {
                setIsOpen(false)
                setSearchTerm('')
              }}
              type="button"
              variant="secondary"
            >
              Tutup
            </AppButton>
          </div>
        </div>
      </AppSheet>
    </div>
  )
}

export default MasterPickerField
