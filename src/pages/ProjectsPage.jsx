import { useEffect } from 'react'
import ProtectedRoute from '../components/ProtectedRoute'
import ProjectReport from '../components/ProjectReport'
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

    navigate('/reports/pdf-settings', {
      replace: true,
    })
  }, [location.hash, navigate])

  return (
    <PageShell>
      <PageHeader
        eyebrow="Pelaporan"
        title="Unit Kerja"
        action={
          <AppButton
            aria-label="Pengaturan PDF"
            leadingIcon={<Settings2 className="h-4 w-4" />}
            size="sm"
            variant="secondary"
            onClick={() => navigate('/reports/pdf-settings')}
            type="button"
          >
            Pengaturan PDF
          </AppButton>
        }
      />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <ProjectReport />
      </ProtectedRoute>
    </PageShell>
  )
}

export default ProjectsPage
