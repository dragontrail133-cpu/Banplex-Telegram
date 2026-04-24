import { Suspense, lazy, useEffect, useRef } from 'react'
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import MainLayout from './components/layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import BrandLoader from './components/ui/BrandLoader'
import GlobalToast from './components/ui/GlobalToast'
import useTelegram from './hooks/useTelegram'
import useTelegramThemeSync from './hooks/useTelegramThemeSync'
import { parseTelegramAssistantStartParam } from './lib/telegram-assistant-links'
import { capabilityContracts } from './lib/capabilities'
import useAuthStore from './store/useAuthStore'

const DashboardPage = lazy(() => import('./pages/Dashboard'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const BeneficiariesPage = lazy(() => import('./pages/BeneficiariesPage'))
const DeletedTransactionDetailPage = lazy(() => import('./pages/DeletedTransactionDetailPage'))
const EditRecordPage = lazy(() => import('./pages/EditRecordPage'))
const HrdPage = lazy(() => import('./pages/HrdPage'))
const MasterPage = lazy(() => import('./pages/MasterPage'))
const MasterFormPage = lazy(() => import('./pages/MasterFormPage'))
const MasterRecycleBinPage = lazy(() => import('./pages/MasterRecycleBinPage'))
const MaterialInvoicePage = lazy(() => import('./pages/MaterialInvoicePage'))
const MaterialInvoiceDetailPage = lazy(() => import('./pages/MaterialInvoiceDetailPage'))
const MorePage = lazy(() => import('./pages/MorePage'))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'))
const PaymentPage = lazy(() => import('./pages/PaymentPage'))
const PayrollPage = lazy(() => import('./pages/PayrollPage'))
const PayrollWorkerDetailPage = lazy(() => import('./pages/PayrollWorkerDetailPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const StockPage = lazy(() => import('./pages/StockPage'))
const TeamInvitePage = lazy(() => import('./pages/TeamInvitePage'))
const TransactionDetailPage = lazy(() => import('./pages/TransactionDetailPage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const TransactionsRecycleBinPage = lazy(() => import('./pages/TransactionsRecycleBinPage'))

function StatusScreen({
  eyebrow = null,
  title,
  description,
  loading = false,
  loaderContext = 'global',
  variant = 'standalone',
}) {
  const isStandalone = variant === 'standalone'
  const shellClassName = isStandalone
    ? 'app-shell mx-auto flex h-screen max-w-md flex-col justify-center overflow-hidden px-2 py-2'
    : 'flex min-h-full items-center justify-center py-8'
  const widthClassName = isStandalone ? 'w-full' : 'mx-auto w-full max-w-xl'

  return (
    <main className={shellClassName}>
      <section className={`${widthClassName} flex flex-col items-center justify-center px-4 text-center`}>
        <div className="flex items-center justify-center">
          {loading ? (
            <BrandLoader size={isStandalone ? 'hero' : 'compact'} context={loaderContext} />
          ) : null}
        </div>
        {eyebrow ? (
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-hint-color)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={`text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)] ${loading ? 'mt-5' : 'mt-0'}`}>
          {title}
        </h1>
        <p className="mt-2 max-w-[26rem] text-sm leading-6 text-[var(--app-hint-color)]">{description}</p>
      </section>
    </main>
  )
}

function renderStandaloneLazyRoute(PageComponent, pageProps = {}) {
  return (
    <>
      <GlobalToast />
      <Suspense
        fallback={
          <StatusScreen
            description="Menyiapkan tampilan halaman."
            loading
            loaderContext="global"
            title="Sedang memuat halaman"
            variant="standalone"
          />
        }
      >
        <PageComponent {...pageProps} />
      </Suspense>
    </>
  )
}

function renderOwnerStandaloneLazyRoute(PageComponent, pageProps = {}) {
  return (
    <ProtectedRoute allowedRoles={['Owner']}>
      {renderStandaloneLazyRoute(PageComponent, pageProps)}
    </ProtectedRoute>
  )
}

function PaymentRouteRedirect({ to }) {
  const { id } = useParams()

  return <Navigate replace to={to.replace(':id', id ?? '')} />
}

function App() {
  const { tg, startParam } = useTelegram()
  useTelegramThemeSync(tg)
  const location = useLocation()
  const navigate = useNavigate()
  const handledAssistantStartParamRef = useRef('')
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

  const assistantStartRoute = parseTelegramAssistantStartParam(startParam)

  useEffect(() => {
    if (!isRegistered || !assistantStartRoute) {
      return
    }

    const handledKey = `${startParam ?? ''}::${assistantStartRoute}`

    if (handledAssistantStartParamRef.current === handledKey) {
      return
    }

    handledAssistantStartParamRef.current = handledKey

    const currentRoute = `${location.pathname}${location.search}${location.hash}`

    if (currentRoute !== assistantStartRoute) {
      navigate(assistantStartRoute, { replace: true })
    }
  }, [
    assistantStartRoute,
    isRegistered,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    startParam,
  ])

  if (isLoading) {
    return (
      <>
        <StatusScreen
          description="Menyiapkan sesi dan data awal."
          loading
          loaderContext="global"
          title="Sedang memuat workspace"
          variant="standalone"
        />
        <GlobalToast />
      </>
    )
  }

  if (!isRegistered) {
    return (
      <>
        <StatusScreen
          description={error || 'Hubungi Admin untuk aktivasi akses.'}
          eyebrow="Akses Ditolak"
          title="Akses belum tersedia"
          variant="standalone"
        />
        <GlobalToast />
      </>
    )
  }

  return (
    <Routes>
      <Route
        element={
          <MainLayout
            routeFallback={
              <StatusScreen
                description="Mengambil data terbaru."
                loading
                loaderContext="global"
                title="Sedang memuat halaman"
                variant="layout"
              />
            }
          />
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route
          path="/payroll/worker/:workerId"
          element={
            <ProtectedRoute requiredCapability={capabilityContracts.payroll_access.key}>
              <PayrollWorkerDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/transactions/history" element={<Navigate to="/transactions?tab=history" replace />} />
        <Route path="/transactions/recycle-bin" element={<TransactionsRecycleBinPage />} />
        <Route
          path="/transactions/recycle-bin/:transactionId"
          element={<DeletedTransactionDetailPage />}
        />
        <Route path="/transactions/:transactionId" element={<TransactionDetailPage />} />
        <Route path="/tagihan" element={<Navigate to="/transactions?tab=tagihan" replace />} />
        <Route path="/pembayaran" element={<PaymentsPage />} />
        <Route path="/tagihan/:id" element={<PaymentRouteRedirect to="/payment/:id" />} />
        <Route
          path="/pembayaran/tagihan/:id"
          element={<PaymentRouteRedirect to="/payment/:id" />}
        />
        <Route path="/pembayaran/pinjaman/:id" element={<PaymentPage paymentType="loan" />} />
        <Route path="/reports" element={<ProjectsPage />} />
        <Route path="/projects" element={<Navigate to="/reports" replace />} />
        <Route
          path="/projects/pdf-settings"
          element={
            <Navigate replace to="/reports#pdf-settings" />
          }
        />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/master" element={<MasterPage />} />
        <Route path="/master/recycle-bin" element={<MasterRecycleBinPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/material-invoice/:id" element={<MaterialInvoiceDetailPage />} />
        <Route path="/history" element={<Navigate to="/transactions?tab=history" replace />} />
        <Route path="/riwayat" element={<Navigate to="/transactions?tab=history" replace />} />
        <Route path="/attendance" element={<Navigate to="/payroll" replace />} />
        <Route path="/transaksi" element={<Navigate to="/transactions" replace />} />
        <Route path="/proyek" element={<Navigate to="/reports" replace />} />
        <Route path="/lainnya" element={<Navigate to="/more" replace />} />
      </Route>
      <Route path="/attendance/new" element={renderStandaloneLazyRoute(AttendancePage)} />
      <Route path="/more/payroll" element={<Navigate to="/payroll" replace />} />
      <Route path="/more/hrd" element={renderStandaloneLazyRoute(HrdPage)} />
      <Route path="/more/beneficiaries" element={renderStandaloneLazyRoute(BeneficiariesPage)} />
      <Route path="/more/team-invite" element={renderStandaloneLazyRoute(TeamInvitePage)} />
      <Route path="/material-invoice/new" element={renderStandaloneLazyRoute(MaterialInvoicePage)} />
      <Route path="/edit/:type/:id" element={renderStandaloneLazyRoute(EditRecordPage)} />
      <Route
        path="/transactions/:transactionId/technical"
        element={renderOwnerStandaloneLazyRoute(TransactionDetailPage, { technicalView: true })}
      />
      <Route
        path="/edit/:type/:id/technical"
        element={renderOwnerStandaloneLazyRoute(EditRecordPage, { technicalView: true })}
      />
      <Route
        path="/payment/:id"
        element={renderStandaloneLazyRoute(PaymentPage, { paymentType: 'bill' })}
      />
      <Route
        path="/payment/:id/technical"
        element={renderOwnerStandaloneLazyRoute(PaymentPage, {
          paymentType: 'bill',
          technicalView: true,
        })}
      />
      <Route
        path="/loan-payment/:id"
        element={renderStandaloneLazyRoute(PaymentPage, { paymentType: 'loan' })}
      />
      <Route
        path="/loan-payment/:id/technical"
        element={renderOwnerStandaloneLazyRoute(PaymentPage, {
          paymentType: 'loan',
          technicalView: true,
        })}
      />
      <Route path="/master/:tab/add" element={renderStandaloneLazyRoute(MasterFormPage)} />
      <Route path="/master/:tab/edit/:id" element={renderStandaloneLazyRoute(MasterFormPage)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
