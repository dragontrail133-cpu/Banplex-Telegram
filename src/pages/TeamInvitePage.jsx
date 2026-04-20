import { useNavigate } from 'react-router-dom'
import TeamInviteManager from '../components/TeamInviteManager'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'
import { AppViewportSafeArea, PageShell } from '../components/ui/AppPrimitives'

function TeamInvitePage() {
  const navigate = useNavigate()

  return (
    <AppViewportSafeArea as="main" className="min-h-screen sm:mx-auto sm:max-w-md">
      <PageShell className="px-0 py-0">
        <FormHeader
          eyebrow="More"
          onBack={() => navigate('/more')}
          title="Tim"
        />
        <ProtectedRoute requiredCapability="team_invite">
          <TeamInviteManager />
        </ProtectedRoute>
      </PageShell>
    </AppViewportSafeArea>
  )
}

export default TeamInvitePage
