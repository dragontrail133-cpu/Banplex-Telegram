import { useState } from 'react'
import { X } from 'lucide-react'
import useMasterStore from '../store/useMasterStore'

function createInitialFormData() {
  return {
    materialName: '',
    unit: '',
    currentStock: '0',
  }
}

function MasterMaterialForm({ isOpen, onClose }) {
  const [formData, setFormData] = useState(createInitialFormData)
  const [localError, setLocalError] = useState(null)
  const addMaterial = useMasterStore((state) => state.addMaterial)
  const isSubmitting = useMasterStore((state) => state.isLoading)
  const storeError = useMasterStore((state) => state.error)
  const clearError = useMasterStore((state) => state.clearError)

  const resetFormState = () => {
    setFormData(createInitialFormData())
    setLocalError(null)
    clearError()
  }

  const handleClose = () => {
    resetFormState()
    onClose?.()
  }

  if (!isOpen) {
    return null
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (localError) {
      setLocalError(null)
    }

    if (storeError) {
      clearError()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const normalizedMaterialName = String(formData.materialName ?? '').trim()
    const normalizedUnit = String(formData.unit ?? '').trim()
    const normalizedCurrentStock = String(formData.currentStock ?? '').trim()

    if (!normalizedMaterialName) {
      setLocalError('Nama material wajib diisi.')
      return
    }

    if (!normalizedUnit) {
      setLocalError('Satuan material wajib diisi.')
      return
    }

    try {
      await addMaterial({
        material_name: normalizedMaterialName,
        unit: normalizedUnit,
        current_stock:
          normalizedCurrentStock.length > 0 ? normalizedCurrentStock : 0,
      })

      handleClose()
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan material.'

      setLocalError(message)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-3 py-4 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose()
        }
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/60 bg-[var(--app-surface-color)] shadow-telegram backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/70 px-5 py-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-[var(--app-accent-color)]">
              Master Data Material
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
              Tambah Material Baru
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
              Material baru akan langsung muncul di dropdown Modul 9 setelah tersimpan.
            </p>
          </div>

          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-[var(--app-text-color)] transition hover:bg-white"
            onClick={handleClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Nama Material
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="materialName"
              onChange={handleChange}
              placeholder="Contoh: Semen Holcim"
              required
              type="text"
              value={formData.materialName}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Satuan
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="unit"
              onChange={handleChange}
              placeholder="Contoh: Sak, Kg, Dus, Batang"
              required
              type="text"
              value={formData.unit}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Stok Awal
            </span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              inputMode="decimal"
              min="0"
              name="currentStock"
              onChange={handleChange}
              placeholder="0"
              step="0.01"
              type="number"
              value={formData.currentStock}
            />
          </label>

          {localError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {localError}
            </div>
          ) : null}

          {storeError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              {storeError}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="inline-flex items-center justify-center rounded-[22px] border border-slate-200 bg-white/85 px-5 py-4 text-base font-semibold text-[var(--app-text-color)] transition hover:bg-white"
              onClick={handleClose}
              type="button"
            >
              Batal
            </button>

            <button
              className="inline-flex items-center justify-center rounded-[22px] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default MasterMaterialForm
