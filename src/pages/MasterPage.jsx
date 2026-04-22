import { Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import MasterDataManager from '../components/MasterDataManager'
import { AppButton, PageHeader, PageShell } from '../components/ui/AppPrimitives'
import { capabilityContracts } from '../lib/capabilities'

function MasterPage() {
  const navigate = useNavigate()

  return (
    <PageShell>
      <PageHeader
        eyebrow="Data Referensi"
        title="Master"
        action={
          <AppButton
            leadingIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => navigate('/master/recycle-bin')}
            size="sm"
            type="button"
            variant="secondary"
          >
            Recycle Bin
          </AppButton>
        }
      />
      <ProtectedRoute requiredCapability={capabilityContracts.master_data_admin.key}>
        <MasterDataManager />
      </ProtectedRoute>
    </PageShell>
  )
}

export default MasterPage
