import { useLocation, useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import MaterialInvoiceForm from '../components/MaterialInvoiceForm'
import { formShellRegistry, resolveFormBackRoute } from '../lib/form-shell'

function MaterialInvoicePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const handleFormSuccess = async () => {}
  const materialInvoiceShell = formShellRegistry.materialInvoice
  const backRoute = resolveFormBackRoute('materialInvoice', {
    locationState: location.state,
    fallbackRoute: materialInvoiceShell.defaultBackRoute,
  })

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin', 'Logistik']}
      description={materialInvoiceShell.description}
    >
      <FormLayout
        onBack={() => navigate(backRoute, { replace: true })}
        title={materialInvoiceShell.title}
      >
        <MaterialInvoiceForm
          onClose={() => navigate(backRoute, { replace: true })}
          onSuccess={handleFormSuccess}
        />
      </FormLayout>
    </ProtectedRoute>
  )
}

export default MaterialInvoicePage
