import { useNavigate } from 'react-router-dom'
import { CalendarCheck2, Users } from 'lucide-react'
import ProtectedRoute from '../components/ProtectedRoute'
import FormLayout from '../components/layouts/FormLayout'
import AttendanceForm from '../components/AttendanceForm'
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
        <div className=" ">
          <section className=" ">
          </section>

          <AttendanceForm formId={formId} hideActions />
        </div>
      </FormLayout>
    </ProtectedRoute>
  )
}

export default AttendancePage
