import { useEffect, useEffectEvent, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import useTransactionStore from '../store/useTransactionStore'
import { AppButton, AppCardDashed, AppInput, AppSelect, AppTextarea } from './ui/AppPrimitives'

const transactionTypes = [
  { value: 'income', label: 'Pemasukan' },
  { value: 'expense', label: 'Pengeluaran' },
]

function getUserDisplayName(user, authUser) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  if (user?.username) {
    return `@${user.username}`
  }

  if (authUser?.name) {
    return authUser.name
  }

  if (authUser?.telegram_user_id) {
    return authUser.telegram_user_id
  }

  return 'Pengguna Telegram'
}

function createInitialFormData(initialType = 'income') {
  return {
    type: initialType === 'expense' ? 'expense' : 'income',
    projectId: '',
    categoryId: '',
    amount: '',
    date: '',
    description: '',
    notes: '',
  }
}

function InlineSelectLoader() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center gap-2 text-xs font-medium text-[var(--app-hint-color)]">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-border-color)] border-t-[var(--app-accent-color)]" />
      <span className="hidden sm:inline">Memuat data...</span>
    </div>
  )
}

function TransactionForm({ initialType = 'income', onSuccess }) {
  const [formData, setFormData] = useState(() => createInitialFormData(initialType))
  const [successMessage, setSuccessMessage] = useState(null)
  const { tg, user, haptic } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const categories = useMasterStore((state) => state.categories)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const submitTransaction = useTransactionStore((state) => state.submitTransaction)
  const isSubmitting = useTransactionStore((state) => state.isSubmitting)
  const error = useTransactionStore((state) => state.error)
  const clearError = useTransactionStore((state) => state.clearError)
  const hasMainButton = Boolean(tg?.MainButton)
  const selectedProject = projects.find((project) => project.id === formData.projectId)
  const selectedCategory = categories.find((category) => category.id === formData.categoryId)
  const isMasterDataReady = !isMasterLoading && projects.length > 0 && categories.length > 0
  const isProjectDisabled = isSubmitting || isMasterLoading || projects.length === 0
  const isCategoryDisabled = isSubmitting || isMasterLoading || categories.length === 0

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const saveTransaction = async () => {
    if (isSubmitting || !isMasterDataReady) {
      return
    }

    try {
      setSuccessMessage(null)

      await submitTransaction({
        telegram_user_id: user?.id ?? authUser?.telegram_user_id ?? null,
        userName: getUserDisplayName(user, authUser),
        type: formData.type,
        project_id: formData.projectId,
        project_name: selectedProject?.name ?? null,
        expense_category_id: formData.categoryId,
        category_name: selectedCategory?.name ?? null,
        amount: formData.amount,
        transaction_date: formData.date,
        description: formData.description,
        notes: formData.notes,
      })

      if (tg?.close) {
        haptic?.notificationOccurred('success')
        tg.close()
        return
      }

      haptic?.notificationOccurred('success')
      await onSuccess?.()
      setFormData(createInitialFormData())
      setSuccessMessage('Transaksi berhasil disimpan ke database.')
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan transaksi.'

      haptic?.notificationOccurred('error')
      tg?.showAlert?.(message)
    }
  }

  const handleSave = useEffectEvent(() => {
    void saveTransaction()
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    void saveTransaction()
  }

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data transaksi:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => {
    if (!tg?.MainButton) {
      return undefined
    }

    tg.MainButton.setText('SIMPAN TRANSAKSI')
    tg.MainButton.show()
    tg.onEvent?.('mainButtonClicked', handleSave)

    return () => {
      tg.offEvent?.('mainButtonClicked', handleSave)
      tg.MainButton.hide()
    }
  }, [tg])

  useEffect(() => {
    if (!tg?.MainButton) {
      return
    }

    if (!isMasterDataReady) {
      tg.MainButton.setText('MEMUAT DATA...')
      tg.MainButton.disable()
      return
    }

    if (isSubmitting) {
      tg.MainButton.setText('MENYIMPAN...')
      tg.MainButton.disable()
      return
    }

    tg.MainButton.setText('SIMPAN TRANSAKSI')
    tg.MainButton.enable()
  }, [isMasterDataReady, isSubmitting, tg])

  useEffect(() => () => clearError(), [clearError])

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <fieldset className="space-y-5" disabled={isSubmitting}>
        <section className="space-y-2">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Tipe Transaksi
          </p>
          <div className="grid grid-cols-2 gap-3">
            {transactionTypes.map((type) => {
              const isSelected = formData.type === type.value

              return (
                <AppButton
                  key={type.value}
                  aria-pressed={isSelected}
                  className="rounded-[22px]"
                  onClick={() =>
                    setFormData((current) => ({
                      ...current,
                      type: type.value,
                    }))
                  }
                  size="lg"
                  type="button"
                  variant={isSelected ? 'primary' : 'secondary'}
                >
                  {type.label}
                </AppButton>
              )
            })}
          </div>
        </section>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Proyek
          </span>
          <div className="relative">
            <AppSelect
              className={isMasterLoading ? 'animate-pulse pr-14' : 'pr-14'}
              disabled={isProjectDisabled}
              name="projectId"
              onChange={handleChange}
              required
              value={formData.projectId}
            >
              {isMasterLoading ? (
                <option value="">Memuat data...</option>
              ) : projects.length > 0 ? (
                <>
                  <option value="">Pilih proyek</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Data proyek belum tersedia</option>
              )}
            </AppSelect>

            {isMasterLoading ? <InlineSelectLoader /> : null}
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Kategori
          </span>
          <div className="relative">
            <AppSelect
              className={isMasterLoading ? 'animate-pulse pr-14' : 'pr-14'}
              disabled={isCategoryDisabled}
              name="categoryId"
              onChange={handleChange}
              required
              value={formData.categoryId}
            >
              {isMasterLoading ? (
                <option value="">Memuat data...</option>
              ) : categories.length > 0 ? (
                <>
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Data kategori belum tersedia</option>
              )}
            </AppSelect>

            {isMasterLoading ? <InlineSelectLoader /> : null}
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Nominal
          </span>
          <AppInput
            inputMode="decimal"
            min="0.01"
            name="amount"
            onChange={handleChange}
            placeholder="Rp 0"
            required
            step="0.01"
            type="number"
            value={formData.amount}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Tanggal
          </span>
          <AppInput
            name="date"
            onChange={handleChange}
            required
            type="date"
            value={formData.date}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Deskripsi Singkat
          </span>
          <AppInput
            name="description"
            onChange={handleChange}
            placeholder="Contoh: Pembayaran invoice proyek"
            type="text"
            value={formData.description}
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            Catatan Tambahan
          </span>
          <AppTextarea
            name="notes"
            onChange={handleChange}
            placeholder="Tambahkan konteks singkat untuk transaksi ini."
            value={formData.notes}
          />
        </label>

        <AppCardDashed className={`px-4 py-3 text-sm leading-6 ${
          hasMainButton
            ? 'border-[var(--app-tone-info-border)] text-[var(--app-tone-info-text)]'
            : 'border-[var(--app-tone-warning-border)] text-[var(--app-tone-warning-text)]'
        }`}>
          {hasMainButton
            ? 'Gunakan MainButton Telegram untuk menyimpan transaksi ini.'
            : 'MainButton Telegram tidak tersedia di browser. Gunakan tombol manual di bawah untuk menyimpan transaksi.'}
        </AppCardDashed>

        {error ? (
          <div className="app-card-dashed border-[var(--app-tone-danger-border)] px-4 py-3 text-sm leading-6 text-[var(--app-tone-danger-text)]">
            {error}
          </div>
        ) : null}

        {masterError ? (
          <div className="app-card-dashed border-[var(--app-tone-warning-border)] px-4 py-3 text-sm leading-6 text-[var(--app-tone-warning-text)]">
            {masterError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="app-card-dashed border-[var(--app-tone-success-border)] px-4 py-3 text-sm leading-6 text-[var(--app-tone-success-text)]">
            {successMessage}
          </div>
        ) : null}

        {!hasMainButton ? (
          <AppButton disabled={isSubmitting || !isMasterDataReady} type="submit" variant="primary">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
          </AppButton>
        ) : null}
      </fieldset>
    </form>
  )
}

export default TransactionForm
