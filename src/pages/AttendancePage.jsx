import { useLocation, useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import AttendanceForm from '../components/AttendanceForm'
import { formShellRegistry, resolveFormBackRoute } from '../lib/form-shell'
import useAttendanceStore from '../store/useAttendanceStore'

function AttendancePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const formId = 'attendance-form'
  const isSheetSaving = useAttendanceStore((state) => state.isSheetSaving)
  const attendanceShell = formShellRegistry.attendance
  const backRoute = resolveFormBackRoute('attendance', {
    locationState: location.state,
    fallbackRoute: attendanceShell.defaultBackRoute,
  })

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin', 'Payroll']}
      description={attendanceShell.description}
    >
      <FormLayout
        actionLabel={attendanceShell.submitLabel}
        formId={formId}
        isSubmitting={isSheetSaving}
        onBack={() => navigate(backRoute, { replace: true })}
        title={attendanceShell.title}
      >
        <AttendanceForm formId={formId} hideActions />
      </FormLayout>
    </ProtectedRoute>
  )
}

export default AttendancePage
