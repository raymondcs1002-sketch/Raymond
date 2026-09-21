-- Loan applications (Malaysia + Singapore). No end-user accounts: applicants
-- never log in, and the team reviews/updates rows directly in the Supabase
-- dashboard (Table Editor / Storage), or later from an admin panel.
--
-- RLS is enabled on both tables with NO policies for anon/authenticated —
-- only the service role (used server-side by the Astro API routes) can
-- read or write. This is deliberate: there is no client-side Supabase
-- access at all except uploading to a signed Storage URL, which is
-- authorized by its token, not by table/bucket policies.

create extension if not exists pgcrypto;

create type application_status as enum (
  'pending_docs',
  'submitted',
  'in_review',
  'approved',
  'rejected',
  'cancelled'
);

create type id_type as enum ('mykad', 'nric', 'fin');

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  country text not null check (country in ('MY', 'SG')),
  status application_status not null default 'pending_docs',

  full_name text not null,
  id_type id_type not null,
  id_number text not null,
  date_of_birth date not null,
  whatsapp text not null,
  email text not null,

  employment_status text not null,
  employer_name text not null,
  monthly_income numeric(12, 2) not null,

  currency char(3) not null,
  loan_amount numeric(12, 2) not null,
  tenure_months integer not null,
  purpose text not null,

  consent_version text not null,
  consent_at timestamptz not null,
  utm jsonb,
  ip_hash text not null,
  user_agent text,

  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists applications_status_created_at_idx on applications (status, created_at desc);
create index if not exists applications_ip_hash_created_at_idx on applications (ip_hash, created_at desc);

create table if not exists application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  kind text not null check (kind in ('id_front', 'id_back', 'selfie', 'payslip')),
  storage_path text not null,
  mime text not null,
  size_bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists application_documents_application_id_idx on application_documents (application_id);

alter table applications enable row level security;
alter table application_documents enable row level security;
-- No policies added: anon/authenticated have zero access. Only the
-- service role (which bypasses RLS) can read/write, via the API routes.

-- Storage: private bucket for KYC documents. Create via the dashboard or:
--   insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
--   values ('kyc', 'kyc', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
--   on conflict (id) do nothing;
-- No storage.objects policies are added either — uploads only happen via
-- short-lived signed upload URLs created server-side with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
