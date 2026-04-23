import { useNavigate } from 'react-router-dom'
import TeamInviteManager from '../components/TeamInviteManager'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'
import { AppViewportSafeArea, PageShell } from '../components/ui/AppPrimitives'
import { capabilityContracts } from '../lib/capabilities'

function TeamInvitePage() {
  const navigate = useNavigate()

  return (
    <AppViewportSafeArea as="main" className="min-h-screen sm:mx-auto sm:max-w-md">
      <PageShell className="px-0 py-0">
        <FormHeader onBack={() => navigate('/more')} title="Tim" />
        <ProtectedRoute requiredCapability={capabilityContracts.team_invite.key}>
          <TeamInviteManager />
        </ProtectedRoute>
      </PageShell>
    </AppViewportSafeArea>
  )
}

export default TeamInvitePage
