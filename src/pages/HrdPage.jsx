import { useNavigate } from 'react-router-dom'
import HrdPipeline from '../components/HrdPipeline'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'
import { AppViewportSafeArea, PageShell } from '../components/ui/AppPrimitives'

function HrdPage() {
  const navigate = useNavigate()

  return (
    <AppViewportSafeArea as="main" className="min-h-screen sm:mx-auto sm:max-w-md">
      <PageShell className="px-0 py-0">
        <FormHeader
          eyebrow="More"
          onBack={() => navigate('/more')}
          title="HRD & Rekrutmen"
        />
        <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
          <HrdPipeline />
        </ProtectedRoute>
      </PageShell>
    </AppViewportSafeArea>
  )
}

export default HrdPage
