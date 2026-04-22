import ProtectedRoute from '../components/ProtectedRoute'
import FrozenRoutePlaceholder from '../components/ui/FrozenRoutePlaceholder'

function BeneficiariesPage() {
  return (
    <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
      <FrozenRoutePlaceholder description="Data penerima manfaat belum dibuka di freeze ini." />
    </ProtectedRoute>
  )
}

export default BeneficiariesPage
