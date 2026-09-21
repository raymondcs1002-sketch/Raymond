# myloan

A personal loan application platform, in the spirit of timepecash.com —
but applicants apply directly with us instead of being redirected to a
partner. No accounts: applicants submit a form + KYC documents, and the
team follows up on WhatsApp.

- **Stack:** Astro (SSR) on Vercel, Vercel Global Config for content, Supabase for data + private document storage, Resend for email notifications.
- **No login.** The team reviews applications and documents directly in the Supabase dashboard.
- **Currency, not country.** The product is presented by currency (MYR/SGD), not by naming a country, outside the legal pages (which must disclose jurisdiction). URLs use a currency slug — `/sgd/...`, `/myr/...` — not `/my`/`/sg`. See `src/lib/countries.ts` (`MarketSlug`).
- **SGD-only for now.** MYR is disabled (`countries.MY.enabled: false` in Global Config) but the code path stays intact — flip that one field to bring it back, no redeploy needed. `/` and the short paths (`/apply`, `/about`, ...) transparently serve `/sgd/...` (`Astro.rewrite`, not a redirect — the address bar stays clean).
- **Pricing is a fixed rate card, not a formula.** `src/lib/repayment.ts` holds the loan-amount × tenure × instalment table the lender actually offers (`repaymentTable` in Global Config) — the calculator and apply form look values up, they don't compute them. `src/lib/calc.ts` (percentage-based) is kept only as a fallback for a market without a table.

## Why Global Config?

Loan terms, licence numbers, and contact details change more often than the
code does. They live in **Vercel Global Config** (renamed from "Edge
Config" on 2026-07-29 — same product, same dashboard tab, new name), not
in environment variables or the codebase, so the team can update them from
the Vercel dashboard and see the change live within about a minute — **no
redeploy, no rebuild.** See `src/lib/config.ts` / `src/lib/config.defaults.ts`.

Everything else (validation rules, phone/ID formats, UI copy) is in code,
because those are structural, not day-to-day content.

## Getting started

```bash
npm install
npm run dev
```

Without any environment variables set, the site runs in **dry-run mode**:
Global Config falls back to placeholder content (clearly marked `TODO`),
and Supabase/email calls just log to the console instead of failing. This
is enough to develop and test the whole flow locally.

## Environment variables

Copy `.env.example` to `.env` and fill in what you have. See that file for
the full list and where to find each value. In short:

| Variable | Used for | Exposed to browser? |
|---|---|---|
| `GLOBAL_CONFIG` | Content (loan terms, contacts, etc.) | No |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Saving applications, creating signed upload URLs | No |
| `PUBLIC_SUPABASE_ANON_KEY` | Uploading KYC files directly to Storage | **Yes — by design**, this key is meant to be public |
| `RESEND_API_KEY` / `NOTIFY_FROM_EMAIL` | New-application email notifications | No |
| `IP_HASH_SALT` | Hashing IPs for rate limiting (raw IPs are never stored) | No |

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in a `PUBLIC_`-prefixed variable —
it grants full access to your database and storage, bypassing RLS. In the
Vercel dashboard, add it (and `RESEND_API_KEY` / `IP_HASH_SALT`) as
**Sensitive**; leave `PUBLIC_SUPABASE_ANON_KEY` as a normal/plain variable
— Vercel rejects marking a `PUBLIC_`-prefixed variable as Sensitive, since
it's meant to reach the browser anyway.

## Setting up Vercel Global Config

1. In the Vercel dashboard: **Storage → Create → Global Config**.
2. Connect it to this project — Vercel sets the `GLOBAL_CONFIG` environment
   variable automatically. (A store connected before 2026-07-29 sets the
   older `EDGE_CONFIG` name instead — the app checks both, so either works.)
3. Open the store's **Items** editor and paste the contents of
   [`global-config.example.json`](./global-config.example.json), replacing
   every `TODO` with real values (loan limits, interest rate, licence
   number, WhatsApp number, etc.) for each country.
4. To change content later (e.g. adjust `loanMax` for MY), edit the value
   in the same editor. The live site picks it up within ~60 seconds —
   no redeploy needed.

If a key is missing or has the wrong type, that key (and only that key)
falls back to the built-in default — see `src/lib/config.ts`.

## Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration in `supabase/migrations/0001_init.sql` (SQL Editor, or
   `supabase db push` if you use the CLI). It creates the `applications` /
   `application_documents` tables and the private `kyc` storage bucket.
3. Copy **Project Settings → API → Project URL** into `SUPABASE_URL`, the
   **service_role** key into `SUPABASE_SERVICE_ROLE_KEY`, and the **anon
   public** key into `PUBLIC_SUPABASE_ANON_KEY`.
4. Row Level Security is enabled with **no policies** for `anon`/
   `authenticated` — all reads/writes happen server-side with the service
   role. The only client-side Supabase interaction is uploading to a
   signed URL, authorized by its own token.

### Reviewing applications

There's no admin panel in this MVP. To process applications:

1. Open **Table Editor → applications** in Supabase, sorted by
   `created_at`. New submissions have `status = 'submitted'`.
2. Open **Storage → kyc → `{application_id}`** to view uploaded documents.
3. Contact the applicant on WhatsApp (their number is in the `whatsapp`
   column) and update `status` (`in_review` / `approved` / `rejected`)
   as you go.

You'll also get an email at each country's `notifyEmail` (from Global
Config) when a new application is submitted — it links to the applicant's
key details but never attaches KYC documents.

## Setting up email (Resend)

1. Create an account at [resend.com](https://resend.com) and go to **API
   Keys → Create API Key**. Copy it into `RESEND_API_KEY`.
2. `NOTIFY_FROM_EMAIL` is the **sender** address and must be on a domain
   you've verified in Resend (**Domains → Add Domain**) — it **cannot** be
   a personal address like Gmail. For local testing without a domain, use
   the built-in sandbox sender `onboarding@resend.dev`, which can send to
   the email address you signed up to Resend with.
3. The **recipient** is separate: it's each country's `notifyEmail` field
   in Global Config (or the placeholder default), not `NOTIFY_FROM_EMAIL`.

Without `RESEND_API_KEY`/`NOTIFY_FROM_EMAIL` set, notifications are just
logged to the server console — useful for local development.

## Deploying to Vercel

```bash
vercel link
vercel env pull      # optional: syncs GLOBAL_CONFIG + any env vars you've set in the dashboard
vercel deploy --prod
```

Set the environment variables from the table above in **Project Settings →
Environment Variables** (Production and Preview). If you connect the
Global Config store *after* the first deploy, redeploy once more so the
new `GLOBAL_CONFIG` variable is picked up — after that, editing content
inside the store never needs a redeploy.

## Testing

```bash
npm test
```

Unit tests cover phone/ID validation (including the Malaysian MyKad DOB
cross-check and Singapore NRIC/FIN checksum) and the loan repayment
estimate — see `tests/`.

## Compliance — read before launch

This repository ships with **placeholder** loan terms and **draft** legal
pages (`/privacy`, `/terms`, `/disclaimer`, marked with a
`<!-- DRAFT: requires legal review -->` comment). Before launch:

- **Malaysia**: moneylending is regulated under the Moneylenders Act 1951
  (KPKT). You need a valid licence, and the licence number must be shown
  on the site (`licenseNo` in Global Config).
- **Singapore**: moneylending is regulated under the Moneylenders Act 2008
  (Registry of Moneylenders), which also caps interest, fees, and
  regulates advertising content.
- Collecting identity and KYC data is subject to Malaysia's PDPA 2010 and
  Singapore's PDPA 2012 — review the draft Privacy Policy with counsel.
- Have a lawyer confirm final interest rates, fees, and all legal page
  copy before going live in either country.

## Project structure

```
src/
  lib/            Config loading, validation, loan calculations, Supabase/email clients
  i18n/en.ts      All UI copy (add ms.ts / zh.ts here for more locales)
  components/     Landing page sections + apply-form pieces
  layouts/Base.astro
  middleware.ts   Loads Global Config content per request, sets cache headers
  pages/
    index.astro, apply.astro, about.astro, ...  Thin rewrites to /sgd/... (see below)
    404.astro, offline.astro
    [market]/           myr / sgd — home, about, contact, legal, apply
    api/applications/   Application submit + document-upload endpoints
supabase/migrations/      Database schema
global-config.example.json  Paste into your Global Config store
```
# Raymond
