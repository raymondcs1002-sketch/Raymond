-- Per-application "review link" so the team can view an application's
-- data and KYC documents from the notification email, without opening
-- Supabase directly. Security is entirely by possession of this token
-- (a random UUID, ~122 bits of entropy) — there's no login. It's only
-- ever sent in the notification email, never shown to the applicant.
-- The /review/[token] page itself sets Cache-Control: no-store and
-- noindex, and only ever generates short-lived signed URLs for the
-- documents (10 minutes) rather than exposing the storage paths.

alter table applications
  add column if not exists view_token uuid not null default gen_random_uuid();

create unique index if not exists applications_view_token_idx on applications (view_token);
