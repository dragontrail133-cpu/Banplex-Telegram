import { Navigate, useLocation, useParams } from 'react-router-dom'

function MaterialInvoiceDetailPage() {
  const location = useLocation()
  const { id: expenseId = '' } = useParams()

  if (!expenseId) {
    return <Navigate replace to="/transactions" state={location.state ?? null} />
  }

  return <Navigate replace to={`/transactions/${expenseId}`} state={location.state ?? null} />
}

export default MaterialInvoiceDetailPage
