import ProtectedRoute from '../components/ProtectedRoute'
import ProjectReport from '../components/ProjectReport'
import { AppButton, PageHeader, PageShell } from '../components/ui/AppPrimitives'
import { Settings2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function ProjectsPage() {
  const navigate = useNavigate()

  return (
    <PageShell>
      <PageHeader
        eyebrow="Pelaporan"
        title="Unit Kerja"
        action={
          <AppButton
            aria-label="Pengaturan PDF"
            iconOnly
            variant="secondary"
            leadingIcon={<Settings2 className="h-4 w-4" />}
            onClick={() => navigate('/projects/pdf-settings')}
            type="button"
          />
        }
      />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <ProjectReport />
      </ProtectedRoute>
    </PageShell>
  )
}

export default ProjectsPage
