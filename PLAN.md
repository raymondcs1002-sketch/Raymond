# Project Spec: Loan Application Platform (Malaysia & Singapore)

> **Superseded 2026-09-15 (v1):** the original version of this document scoped a
> lead-capture site that redirected applicants to a partner (TimePeCash).
> That's no longer the plan — see below.
>
> **Amended 2026-09-15 (v2), per client:** the product is now presented by
> **currency, not country** — no "Malaysia"/"Singapore" outside the legal
> pages, URLs use `/myr`/`/sgd`. **SGD is the only active market** for now
> (MYR disabled in Global Config, code kept dormant). Pricing is a **fixed
> rate card** (`src/lib/repayment.ts` / `repaymentTable` in Global Config),
> not the `interestRatePerMonth` formula described below — that formula is
> now only a fallback for a market without a table. SG eligibility also
> includes work pass holders (Employment Pass/S Pass/Work Permit), not just
> citizens/PRs. The rest of this document (data model, compliance notes,
> Supabase/Global Config setup) still applies.

## 1. Overview

A mobile-first personal loan application platform, in the spirit of
timepecash.com's UX, for our own lending operation in **Malaysia (MYR)**
and **Singapore (SGD)**. Applicants apply directly with us — there is no
redirect to a third-party lender.

**In scope:** eligibility presentation, a multi-step application form,
KYC document upload, and storing the application for the team to review.
**Not in scope (MVP):** applicant accounts/login, an admin panel, in-app
approval decisions, repayment scheduling/tracking, and payment gateway
integration. Follow-up happens over WhatsApp; the team reviews
applications and documents directly in the Supabase dashboard.

## 2. Goals

- Visitor understands the offer and eligibility within seconds of landing.
- A single guided application flow: loan details → personal details →
  employment → KYC documents → review & consent.
- Fast load on 3G; light, trustworthy visual tone (teal accent, generous
  whitespace); mobile-first, installable as a PWA.
- Content (loan limits, rates, licence numbers, contacts) editable by the
  team **without a redeploy**.

## 3. Site map

| Page | Purpose |
| --- | --- |
| `/` | Redirects to `/my` or `/sg` by IP geolocation, or shows a country picker |
| `/{my,sg}/` | Home: hero, product terms, how it works, eligibility, documents required, risk disclosure, calculator, FAQ, contact |
| `/{my,sg}/apply` | Multi-step application form + KYC upload |
| `/{my,sg}/apply/success` | Confirmation + reference code + WhatsApp link |
| `/{my,sg}/about`, `/contact` | Company info, support contact |
| `/{my,sg}/privacy`, `/terms`, `/disclaimer` | Legal (draft, pending legal review) |

## 4. Core user flow

1. Visitor lands on `/{country}/`, sees loan terms and eligibility.
2. Clicks **Apply for Loan** → `/{country}/apply`.
3. Fills in loan amount/tenure, personal details, employment details.
4. Uploads KYC documents (ID front/back, selfie, 1–3 payslips) — compressed
   client-side, uploaded directly to a private Supabase Storage bucket via
   short-lived signed URLs (never through the app server).
5. Reviews a summary, accepts consent, submits.
6. Sees a reference code and a **"Chat on WhatsApp"** link.
7. The team gets an email notification (no documents attached), reviews
   the application + documents in the Supabase dashboard, and follows up
   with the applicant on WhatsApp.

## 5. Data handling

- Applications and KYC documents are stored in Supabase (Postgres +
  private Storage), with Row Level Security enabled and **no policies**
  for anonymous/authenticated roles — only the server (service role) can
  read/write. The only client-side Supabase access is uploading to a
  signed URL authorized by its own token.
- No PAN/Aadhaar — the equivalents here are MyKad (Malaysia) and
  NRIC/FIN (Singapore), validated client- and server-side (including the
  Singapore NRIC/FIN checksum and MyKad↔DOB cross-check).
- IP addresses are hashed (salted) for rate limiting, never stored raw.
- Email notifications summarize the application but never attach KYC
  documents.

## 6. Content model (Vercel Global Config)

Loan limits, interest/fees, age & income eligibility, licence numbers,
entity names, and contact details live in **Vercel Global Config**
(renamed from "Edge Config" on 2026-07-29), keyed per country (`MY` /
`SG`), so the team can change them from the Vercel dashboard with changes
visible in ~60 seconds and **no redeploy**. See
`global-config.example.json` and `src/lib/config.ts`. Everything
currently in there is a `TODO` placeholder — see the checklist below.

## 7. Content still needed from Product/Fendi

- [ ] Loan amount range, interest rate, processing fee — per country
- [ ] Tenure options — per country
- [ ] Typical response time to advertise
- [ ] Eligibility (age, residency, income floor) — per country
- [ ] Legal entity name + moneylender's licence number — per country
      (Malaysia: KPKT licence under the Moneylenders Act 1951; Singapore:
      Registry of Moneylenders licence under the Moneylenders Act 2008)
- [ ] WhatsApp number, support email, office address — per country
- [ ] Legal review of `/privacy`, `/terms`, `/disclaimer` (currently
      drafts) and confirmation of final rates/fees before launch

## 8. Design direction

- Light background, teal accent (`#0f766e`), high-contrast text, generous
  whitespace, SVG icons (no icon font, no heavy imagery).
- Mobile-first; sticky bottom CTA (Apply + WhatsApp) on mobile.
- Installable as a PWA (manifest + minimal offline fallback), English UI
  with all copy centralized in `src/i18n/` for future locales.

## 9. Performance targets

- Static-leaning SSR (Astro, `output: "server"`) with CDN caching
  (`s-maxage=60, stale-while-revalidate=300`) on HTML; `/api/*` uncached.
- Initial JS/CSS payload target: <150KB. Lighthouse mobile: 90+
  Performance, 100 Accessibility.

## 10. Tech stack

- **Frontend:** Astro (SSR) + vanilla client scripts, no UI framework.
- **Hosting:** Vercel (adapter `@astrojs/vercel`).
- **Content:** Vercel Global Config (formerly "Edge Config").
- **Data + storage:** Supabase (Postgres + private Storage for KYC docs).
- **Email:** Resend (new-application notifications).

## 11. Open questions

- [ ] Final loan product details per country (see §7).
- [ ] Confirmed moneylender's licences for MY and SG before launch.
- [ ] Domain name(s) for MY/SG (single domain with `/my` `/sg`, or
      separate domains per country?).
- [ ] When to add an admin panel / repayment tracking / payment gateway
      (explicitly out of MVP scope, see §1).

## 12. Milestones

1. ~~Architecture + scaffold (Astro/Vercel/Global Config/Supabase), landing
   pages, multi-step apply form + KYC upload, legal draft pages.~~ (done)
2. Fill in real content in Global Config (§7) and get legal sign-off on
   licences + legal pages.
3. QA on 3G throttling + real mobile devices, both countries.
4. Connect Resend, verify Supabase in production, deploy.
5. Launch + connect analytics.
6. Post-launch: consider admin panel, repayment tracking, payment
   gateway integration.
