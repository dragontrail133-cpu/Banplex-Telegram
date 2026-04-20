import { useNavigate } from 'react-router-dom'
import BeneficiaryList from '../components/BeneficiaryList'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'
import { AppViewportSafeArea, PageShell } from '../components/ui/AppPrimitives'

function BeneficiariesPage() {
  const navigate = useNavigate()

  return (
    <AppViewportSafeArea as="main" className="min-h-screen sm:mx-auto sm:max-w-md">
      <PageShell className="px-0 py-0">
        <FormHeader
          eyebrow="More"
          onBack={() => navigate('/more')}
          title="Penerima Manfaat"
        />
        <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
          <BeneficiaryList />
        </ProtectedRoute>
      </PageShell>
    </AppViewportSafeArea>
  )
}

export default BeneficiariesPage
