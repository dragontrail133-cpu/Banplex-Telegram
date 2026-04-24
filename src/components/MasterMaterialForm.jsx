import { useState } from 'react'
import useMasterStore from '../store/useMasterStore'
import useMutationToast from '../hooks/useMutationToast'
import { AppButton, AppDialog, AppInput } from './ui/AppPrimitives'

function createInitialFormData() {
  return {
    materialName: '',
    unit: '',
    currentStock: '0',
  }
}

function MasterMaterialForm({ isOpen, onClose }) {
  const [formData, setFormData] = useState(createInitialFormData)
  const addMaterial = useMasterStore((state) => state.addMaterial)
  const isSubmitting = useMasterStore((state) => state.isLoading)
  const storeError = useMasterStore((state) => state.error)
  const clearError = useMasterStore((state) => state.clearError)
  const { begin, fail, succeed } = useMutationToast()
  const formId = 'master-material-form'

  const resetFormState = () => {
    setFormData(createInitialFormData())
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
      fail({
        title: 'Material gagal disimpan',
        message: 'Nama material wajib diisi.',
      })
      return
    }

    if (!normalizedUnit) {
      fail({
        title: 'Material gagal disimpan',
        message: 'Satuan material wajib diisi.',
      })
      return
    }

    try {
      begin({
        title: 'Menyimpan material',
        message: 'Mohon tunggu sampai material baru selesai disimpan.',
      })

      await addMaterial({
        material_name: normalizedMaterialName,
        unit: normalizedUnit,
        current_stock:
          normalizedCurrentStock.length > 0 ? normalizedCurrentStock : 0,
      })

      handleClose()
      succeed({
        title: 'Material tersimpan',
        message: 'Material baru berhasil disimpan.',
      })
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan material.'

      fail({
        title: 'Material gagal disimpan',
        message,
      })
      clearError()
    }
  }

  return (
    <AppDialog
      open={isOpen}
      onClose={handleClose}
      title="Tambah Material Baru"
      description="Material baru akan langsung muncul di dropdown modul material setelah tersimpan."
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AppButton onClick={handleClose} type="button" variant="secondary">
            Batal
          </AppButton>
          <AppButton
            disabled={isSubmitting}
            form={formId}
            type="submit"
          >
            Simpan Material
          </AppButton>
        </div>
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Nama Material
          </span>
          <AppInput
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
          <AppInput
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
          <AppInput
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

      </form>
    </AppDialog>
  )
}

export default MasterMaterialForm
