create table if not exists public.file_assets (
  id uuid primary key default gen_random_uuid(),
  bucket_name text not null default 'hrd_documents',
  storage_path text not null unique,
  file_name text not null,
  public_url text not null,
  mime_type text,
  file_size bigint,
  uploaded_by text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.hrd_applicants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position text not null,
  status_aplikasi text not null default 'screening',
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint hrd_applicants_status_check
    check (status_aplikasi in ('screening', 'interview_hr', 'offering', 'diterima', 'ditolak'))
);

create table if not exists public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nik text,
  institution text,
  status text not null default 'active',
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint beneficiaries_status_check
    check (status in ('active', 'pending', 'inactive'))
);

create table if not exists public.hrd_applicant_documents (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.hrd_applicants(id) on delete cascade,
  file_asset_id uuid not null references public.file_assets(id) on delete cascade,
  document_type text not null,
  created_at timestamp with time zone not null default now(),
  constraint hrd_applicant_documents_type_check
    check (document_type in ('cv', 'ktp', 'other')),
  constraint hrd_applicant_documents_unique
    unique (applicant_id, file_asset_id, document_type)
);

create index if not exists idx_file_assets_bucket_name
  on public.file_assets (bucket_name);

create index if not exists idx_hrd_applicants_status
  on public.hrd_applicants (status_aplikasi);

create index if not exists idx_beneficiaries_status
  on public.beneficiaries (status);

create index if not exists idx_hrd_applicant_documents_applicant_id
  on public.hrd_applicant_documents (applicant_id);

create index if not exists idx_hrd_applicant_documents_file_asset_id
  on public.hrd_applicant_documents (file_asset_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hrd_documents',
  'hrd_documents',
  true,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant select, insert, update, delete on table public.file_assets to anon, authenticated;
grant select, insert, update, delete on table public.hrd_applicants to anon, authenticated;
grant select, insert, update, delete on table public.beneficiaries to anon, authenticated;
grant select, insert, update, delete on table public.hrd_applicant_documents to anon, authenticated;

do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  begin
    execute 'alter table storage.objects enable row level security';
    execute 'drop policy if exists "hrd_documents_select" on storage.objects';
    execute $policy$
      create policy "hrd_documents_select"
        on storage.objects
        for select
        to anon, authenticated
        using (bucket_id = 'hrd_documents')
    $policy$;
    execute 'drop policy if exists "hrd_documents_insert" on storage.objects';
    execute $policy$
      create policy "hrd_documents_insert"
        on storage.objects
        for insert
        to anon, authenticated
        with check (bucket_id = 'hrd_documents')
    $policy$;
    execute 'drop policy if exists "hrd_documents_update" on storage.objects';
    execute $policy$
      create policy "hrd_documents_update"
        on storage.objects
        for update
        to anon, authenticated
        using (bucket_id = 'hrd_documents')
        with check (bucket_id = 'hrd_documents')
    $policy$;
    execute 'drop policy if exists "hrd_documents_delete" on storage.objects';
    execute $policy$
      create policy "hrd_documents_delete"
        on storage.objects
        for delete
        to anon, authenticated
        using (bucket_id = 'hrd_documents')
    $policy$;
  exception
    when insufficient_privilege then
      raise notice 'Skipping storage.objects policy setup in 20260411173000 due to ownership mismatch.';
  end;
end
$$;
