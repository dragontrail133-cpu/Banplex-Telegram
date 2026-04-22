create unique index if not exists attendance_records_team_worker_date_project_key
  on public.attendance_records (
    coalesce(team_id, '00000000-0000-0000-0000-000000000000'::uuid),
    worker_id,
    attendance_date,
    project_id
  )
  where deleted_at is null;
