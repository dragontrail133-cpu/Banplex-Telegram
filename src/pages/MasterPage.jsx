import ProtectedRoute from '../components/ProtectedRoute'
import MasterDataManager from '../components/MasterDataManager'
import { PageHeader } from '../components/ui/AppPrimitives'

function MasterPage() {
  return (
    <section className="space-y-4 px-2 py-2">
      <PageHeader
        eyebrow="Data Referensi"
        title="Master"
      />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <MasterDataManager />
      </ProtectedRoute>
    </section>
  )
}

export default MasterPage
