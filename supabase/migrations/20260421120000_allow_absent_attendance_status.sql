alter table public.attendance_records
  drop constraint if exists attendance_records_attendance_status_check;

alter table public.attendance_records
  add constraint attendance_records_attendance_status_check
  check (attendance_status in ('full_day', 'half_day', 'overtime', 'absent'));
