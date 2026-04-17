import { useNavigate } from 'react-router-dom'
import PayrollManager from '../components/PayrollManager'
import ProtectedRoute from '../components/ProtectedRoute'
import FormHeader from '../components/layouts/FormHeader'

function PayrollPage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-4 px-2 py-2">
      <FormHeader onBack={() => navigate('/more')} title="SDM & Payroll" />
      <ProtectedRoute allowedRoles={['Owner', 'Admin', 'Payroll']}>
        <PayrollManager />
      </ProtectedRoute>
    </section>
  )
}

export default PayrollPage
