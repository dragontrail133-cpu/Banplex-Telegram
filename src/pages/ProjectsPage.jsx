import ProtectedRoute from '../components/ProtectedRoute'
import ProjectReport from '../components/ProjectReport'
import { PageHeader, PageShell } from '../components/ui/AppPrimitives'

function ProjectsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Pelaporan"
        title="Unit Kerja"
      />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <ProjectReport />
      </ProtectedRoute>
    </PageShell>
  )
}

export default ProjectsPage
