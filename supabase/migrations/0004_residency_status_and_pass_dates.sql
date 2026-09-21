-- Singapore applicants now declare which status they hold, rather than it
-- being inferred from the NRIC/FIN prefix alone:
--   * singaporean / pr        -> NRIC, no pass dates
--   * work_permit / s_pass /
--     employment_pass /
--     long_term_pass          -> Work Pass, plus its issue + expiry dates
--
-- All three columns are nullable: Malaysian applications never set them, and
-- rows created before this migration have no value to backfill.

alter table applications
  add column if not exists residency_status text,
  add column if not exists pass_issue_date date,
  add column if not exists pass_expiry_date date;

alter table applications
  drop constraint if exists applications_residency_status_check;

alter table applications
  add constraint applications_residency_status_check
  check (
    residency_status is null
    or residency_status in ('singaporean', 'pr', 'work_permit', 's_pass', 'employment_pass', 'long_term_pass')
  );

-- A pass holder must carry both dates; a citizen/PR must carry neither.
alter table applications
  drop constraint if exists applications_pass_dates_check;

alter table applications
  add constraint applications_pass_dates_check
  check (
    residency_status in ('work_permit', 's_pass', 'employment_pass', 'long_term_pass')
    and pass_issue_date is not null
    and pass_expiry_date is not null
    or residency_status not in ('work_permit', 's_pass', 'employment_pass', 'long_term_pass')
    and pass_issue_date is null
    and pass_expiry_date is null
    or residency_status is null
  );
