import ProtectedRoute from '../components/ProtectedRoute'
import ProjectReport from '../components/ProjectReport'
import { PageHeader } from '../components/ui/AppPrimitives'

function ProjectsPage() {
  return (
    <section className="space-y-4 px-2 py-2">
      <PageHeader
        eyebrow="Pelaporan"
        title="Projects"
      />
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <ProjectReport />
      </ProtectedRoute>
    </section>
  )
}

export default ProjectsPage
