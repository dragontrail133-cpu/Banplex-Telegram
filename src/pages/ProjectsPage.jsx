import { useEffect } from 'react'
import ProtectedRoute from '../components/ProtectedRoute'
import ProjectReport from '../components/ProjectReport'
import { ProjectPdfSettingsSection } from './ProjectPdfSettingsPage'
import { AppButton, PageHeader, PageShell } from '../components/ui/AppPrimitives'
import { Settings2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

function ProjectsPage() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.hash !== '#pdf-settings') {
      return
    }

    document.getElementById('pdf-settings')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [location.hash])

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
            onClick={() => navigate('/reports#pdf-settings')}
            type="button"
          />
        }
      />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <div className="space-y-4">
          <ProjectReport />
          <ProjectPdfSettingsSection />
        </div>
      </ProtectedRoute>
    </PageShell>
  )
}

export default ProjectsPage
