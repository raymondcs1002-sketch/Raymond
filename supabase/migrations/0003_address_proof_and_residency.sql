-- Adds two things to the application form:
--   1. "address_proof" as a required KYC document kind (photo of a
--      utility bill / bank statement / tenancy agreement, etc.)
--   2. resides_locally: whether the applicant currently resides in
--      Singapore — required, ties directly into the residency
--      eligibility criteria shown on the site.

alter table application_documents
  drop constraint if exists application_documents_kind_check;

alter table application_documents
  add constraint application_documents_kind_check
  check (kind in ('id_front', 'id_back', 'selfie', 'address_proof', 'payslip'));

alter table applications
  add column if not exists resides_locally boolean not null default true;
