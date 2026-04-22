import ProtectedRoute from '../components/ProtectedRoute'
import FrozenRoutePlaceholder from '../components/ui/FrozenRoutePlaceholder'

function HrdPage() {
  return (
    <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
      <FrozenRoutePlaceholder description="Modul HRD & Rekrutmen masih dibekukan di freeze ini." />
    </ProtectedRoute>
  )
}

export default HrdPage
