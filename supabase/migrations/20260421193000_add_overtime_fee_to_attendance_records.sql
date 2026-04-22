alter table public.attendance_records
  add column if not exists overtime_fee numeric;
