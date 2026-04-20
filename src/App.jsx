import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import useTelegram from './hooks/useTelegram'
import useTelegramThemeSync from './hooks/useTelegramThemeSync'
import Dashboard from './pages/Dashboard'
import AttendancePage from './pages/AttendancePage'
import BeneficiariesPage from './pages/BeneficiariesPage'
import BillsPage from './pages/BillsPage'
import DeletedTransactionDetailPage from './pages/DeletedTransactionDetailPage'
import EditRecordPage from './pages/EditRecordPage'
import MainLayout from './components/layouts/MainLayout'
import HrdPage from './pages/HrdPage'
import MasterPage from './pages/MasterPage'
import MasterFormPage from './pages/MasterFormPage'
import MasterRecycleBinPage from './pages/MasterRecycleBinPage'
import MaterialInvoicePage from './pages/MaterialInvoicePage'
import MorePage from './pages/MorePage'
import ProjectsPage from './pages/ProjectsPage'
import PaymentPage from './pages/PaymentPage'
import PaymentsPage from './pages/PaymentsPage'
import PayrollPage from './pages/PayrollPage'
import StockPage from './pages/StockPage'
import HistoryPage from './pages/HistoryPage'
import TransactionDetailPage from './pages/TransactionDetailPage'
import TransactionsRecycleBinPage from './pages/TransactionsRecycleBinPage'
import TransactionsPage from './pages/TransactionsPage'
import TeamInvitePage from './pages/TeamInvitePage'
import useAuthStore from './store/useAuthStore'

function LoadingScreen() {
  return (
    <main className="app-shell mx-auto flex h-screen max-w-md flex-col justify-center overflow-hidden px-2 py-2">
      <section className="app-page-surface w-full p-6 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
        <p className="mt-4 text-sm font-medium text-[var(--app-text-color)]">
          Memuat workspace...
        </p>
      </section>
    </main>
  )
}

function UnregisteredScreen({ message }) {
  return (
    <main className="app-shell mx-auto flex h-screen max-w-md flex-col justify-center overflow-hidden px-2 py-2">
      <section className="app-page-surface w-full p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
          Akses Ditolak
        </p>
        <h1 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
          Aplikasi ini belum bisa membuka workspace untuk akun Anda.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--app-hint-color)]">
          {message || 'Hubungi Admin untuk aktivasi akses Telegram Mini App.'}
        </p>
      </section>
    </main>
  )
}

function App() {
  const { tg, startParam } = useTelegram()
  useTelegramThemeSync(tg)
  const initializeTelegramAuth = useAuthStore(
    (state) => state.initializeTelegramAuth
  )
  const isLoading = useAuthStore((state) => state.isLoading)
  const isRegistered = useAuthStore((state) => state.isRegistered)
  const error = useAuthStore((state) => state.error)

  useEffect(() => {
    tg?.ready()
    tg?.expand()
  }, [tg])

  useEffect(() => {
    initializeTelegramAuth({
      initData: tg?.initData ?? '',
      startParam,
    }).catch((authError) => {
      console.error('Gagal memverifikasi Telegram auth:', authError)
    })
  }, [initializeTelegramAuth, startParam, tg?.initData])

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isRegistered) {
    return <UnregisteredScreen message={error} />
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/history" element={<HistoryPage />} />
        <Route path="/transactions/recycle-bin" element={<TransactionsRecycleBinPage />} />
        <Route
          path="/transactions/recycle-bin/:transactionId"
          element={<DeletedTransactionDetailPage />}
        />
        <Route path="/transactions/:transactionId" element={<TransactionDetailPage />} />
        <Route path="/tagihan" element={<BillsPage />} />
        <Route path="/tagihan/:id" element={<PaymentPage paymentType="bill" />} />
        <Route path="/pembayaran" element={<PaymentsPage />} />
        <Route path="/pembayaran/tagihan/:id" element={<PaymentPage paymentType="bill" />} />
        <Route path="/pembayaran/pinjaman/:id" element={<PaymentPage paymentType="loan" />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/master" element={<MasterPage />} />
        <Route path="/master/recycle-bin" element={<MasterRecycleBinPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/history" element={<Navigate to="/transactions/history" replace />} />
        <Route path="/riwayat" element={<Navigate to="/transactions/history" replace />} />
        <Route path="/attendance" element={<Navigate to="/payroll" replace />} />
        <Route path="/transaksi" element={<Navigate to="/transactions" replace />} />
        <Route path="/proyek" element={<Navigate to="/projects" replace />} />
        <Route path="/lainnya" element={<Navigate to="/more" replace />} />
      </Route>
      <Route path="/attendance/new" element={<AttendancePage />} />
      <Route path="/more/payroll" element={<Navigate to="/payroll" replace />} />
      <Route path="/more/hrd" element={<HrdPage />} />
      <Route path="/more/beneficiaries" element={<BeneficiariesPage />} />
      <Route path="/more/team-invite" element={<TeamInvitePage />} />
      <Route path="/material-invoice/new" element={<MaterialInvoicePage />} />
      <Route path="/edit/:type/:id" element={<EditRecordPage />} />
      <Route path="/payment/:id" element={<PaymentPage paymentType="bill" />} />
      <Route path="/loan-payment/:id" element={<PaymentPage paymentType="loan" />} />
      <Route path="/master/:tab/add" element={<MasterFormPage />} />
      <Route path="/master/:tab/edit/:id" element={<MasterFormPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
