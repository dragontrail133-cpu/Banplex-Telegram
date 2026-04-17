import { useNavigate } from 'react-router-dom'
import HrdPipeline from '../components/HrdPipeline'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'

function HrdPage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-4 px-2 py-2">
      <FormHeader onBack={() => navigate('/more')} title="HRD & Rekrutmen" />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <HrdPipeline />
      </ProtectedRoute>
    </section>
  )
}

export default HrdPage
