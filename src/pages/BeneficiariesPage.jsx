import { useNavigate } from 'react-router-dom'
import BeneficiaryList from '../components/BeneficiaryList'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'

function BeneficiariesPage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-4 px-2 py-2">
      <FormHeader onBack={() => navigate('/more')} title="Penerima Manfaat" />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <BeneficiaryList />
      </ProtectedRoute>
    </section>
  )
}

export default BeneficiariesPage
