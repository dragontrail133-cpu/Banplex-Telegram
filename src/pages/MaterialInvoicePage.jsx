import { useNavigate } from 'react-router-dom'
import { FileText, Package } from 'lucide-react'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import MaterialInvoiceForm from '../components/MaterialInvoiceForm'

function MaterialInvoicePage() {
  const navigate = useNavigate()
  const formId = 'material-invoice-form'

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin', 'Logistik']}
      description="Faktur material hanya tersedia untuk Owner, Admin, dan Logistik."
    >
      <FormLayout
        actionLabel="Simpan Faktur Material"
        formId={formId}
        onBack={() => navigate(-1)}
        title="Faktur Material"
      >
        <div className=" ">
          <section className=" ">
          </section>

          <MaterialInvoiceForm
            formId={formId}
            hideActions
            onSuccess={() => navigate(-1)}
          />
        </div>
      </FormLayout>
    </ProtectedRoute>
  )
}

export default MaterialInvoicePage
