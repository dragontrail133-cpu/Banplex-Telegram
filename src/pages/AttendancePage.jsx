import { useNavigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import AttendanceForm from '../components/AttendanceForm'
import { AppButton } from '../components/ui/AppPrimitives'
import useAttendanceStore from '../store/useAttendanceStore'

function AttendancePage() {
  const navigate = useNavigate()
  const formId = 'attendance-form'
  const isSheetSaving = useAttendanceStore((state) => state.isSheetSaving)

  return (
    <ProtectedRoute
      allowedRoles={['Owner', 'Admin', 'Payroll']}
      description="Absensi hanya tersedia untuk Owner, Admin, dan Payroll."
    >
      <FormLayout
        actionLabel="Simpan Sheet Absensi"
        formId={formId}
        isSubmitting={isSheetSaving}
        onBack={() => navigate(-1)}
        title="Absensi Harian"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <AppButton
              onClick={() => navigate('/payroll')}
              size="sm"
              type="button"
              variant="secondary"
            >
              Catatan Absensi
            </AppButton>
          </div>
          <AttendanceForm formId={formId} hideActions />
        </div>
      </FormLayout>
    </ProtectedRoute>
  )
}

export default AttendancePage
