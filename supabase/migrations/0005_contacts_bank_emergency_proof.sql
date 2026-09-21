-- Adds, per client request:
--   * Two emergency contacts (family members) for every applicant, each
--     backed by an "emergency_proof" document — a screenshot of the
--     applicant's chat with that contact.
--   * The applicant's office / supervisor number and bank account.
--   * Two next of kin for Singapore citizens and PRs (not work pass holders).
--
-- All columns are nullable: rows created before this migration have no
-- value to backfill. Required-ness is enforced by the API (src/lib/validate.ts).

alter table applications
  add column if not exists emergency_contact_1_name text,
  add column if not exists emergency_contact_1_relationship text,
  add column if not exists emergency_contact_1_phone text,
  add column if not exists emergency_contact_2_name text,
  add column if not exists emergency_contact_2_relationship text,
  add column if not exists emergency_contact_2_phone text,
  add column if not exists office_phone text,
  add column if not exists bank_name text,
  add column if not exists bank_account_number text,
  add column if not exists next_of_kin_1_name text,
  add column if not exists next_of_kin_1_phone text,
  add column if not exists next_of_kin_2_name text,
  add column if not exists next_of_kin_2_phone text;

alter table application_documents
  drop constraint if exists application_documents_kind_check;

alter table application_documents
  add constraint application_documents_kind_check
  check (kind in ('id_front', 'id_back', 'selfie', 'address_proof', 'emergency_proof', 'payslip'));
