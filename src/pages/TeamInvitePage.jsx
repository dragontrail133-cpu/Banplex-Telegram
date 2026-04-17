import { useNavigate } from 'react-router-dom'
import TeamInviteManager from '../components/TeamInviteManager'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'

function TeamInvitePage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-4 px-2 py-2">
      <FormHeader onBack={() => navigate('/more')} title="Team Invite" />
      <ProtectedRoute allowedRoles={['Owner']}>
        <TeamInviteManager />
      </ProtectedRoute>
    </section>
  )
}

export default TeamInvitePage
