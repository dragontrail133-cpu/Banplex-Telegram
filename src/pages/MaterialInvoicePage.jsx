import { useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import MaterialInvoiceForm from '../components/MaterialInvoiceForm'

function MaterialInvoicePage() {
  const navigate = useNavigate()
  const handleFormSuccess = async () => {}

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin', 'Logistik']}
      description="Faktur material hanya tersedia untuk Owner, Admin, dan Logistik."
    >
      <FormLayout onBack={() => navigate(-1)} title="Faktur Material">
        <MaterialInvoiceForm onClose={() => navigate(-1)} onSuccess={handleFormSuccess} />
      </FormLayout>
    </ProtectedRoute>
  )
}

export default MaterialInvoicePage
