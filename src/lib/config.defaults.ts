import type { RateSchedule } from "./repayment";
import { SGD_RATE_SCHEDULE } from "./repayment";

/**
 * Fallback content used whenever Global Config is unavailable or a key is
 * missing/invalid. Every value here is a placeholder — real business
 * content (loan limits, rates, licence numbers, contact details) is
 * meant to be set in Vercel Global Config so it can change without a
 * redeploy. See global-config.example.json for a ready-to-paste example.
 */

export interface CountryContent {
  enabled: boolean;
  entityName: string;
  licenseNo: string;
  loanMin: number;
  loanMax: number;
  loanStep: number;
  tenureMinMonths: number;
  tenureMaxMonths: number;
  /** Percent per month, e.g. 1.5 means 1.5%/month. Fallback only — see repaymentTable. */
  interestRatePerMonth: number;
  /** One-off fee, percent of principal. Fallback only — see repaymentTable. */
  processingFeePercent: number;
  minAge: number;
  maxAge: number;
  minMonthlyIncome: number;
  residency: string;
  approvalTime: string;
  /** Digits only, with dial code, e.g. "60123456789". */
  whatsappNumber: string;
  supportEmail: string;
  notifyEmail: string;
  officeAddress: string;
  /**
   * Rate schedule — amount bands, each with its own tenures/rates — the
   * actual pricing shown and applied. `loanMin`/`loanMax`/
   * `interestRatePerMonth`/`processingFeePercent` above only matter as a
   * fallback for a market that doesn't have one yet (see validate.ts).
   */
  repaymentTable: RateSchedule;
}

export interface SiteContent {
  siteName: string;
  siteUrl: string;
  countries: {
    MY: CountryContent;
    SG: CountryContent;
  };
}

// MYR is dormant (see MY_DEFAULTS.enabled below) — this is a placeholder
// example schedule only, not a real rate card, kept just so the shape is
// exercised. Replace with a real one before ever re-enabling MYR.
const MYR_PLACEHOLDER_SCHEDULE: RateSchedule = [
  { minAmount: 1000, maxAmount: 10000, tenures: [{ tenureMonths: 6, ratePercent: 8 }, { tenureMonths: 12, ratePercent: 14 }] },
];

const MY_DEFAULTS: CountryContent = {
  enabled: false,
  entityName: "TODO Sdn Bhd",
  licenseNo: "TODO — Moneylender's licence number (KPKT)",
  loanMin: 1000,
  loanMax: 10000,
  loanStep: 100,
  tenureMinMonths: 1,
  tenureMaxMonths: 12,
  interestRatePerMonth: 1.5,
  processingFeePercent: 0,
  minAge: 21,
  maxAge: 60,
  minMonthlyIncome: 2000,
  residency: "Malaysian citizens and permanent residents",
  approvalTime: "TODO",
  whatsappNumber: "60TODO",
  supportEmail: "support@TODO",
  notifyEmail: "leads@TODO",
  officeAddress: "TODO",
  repaymentTable: MYR_PLACEHOLDER_SCHEDULE,
};

const SG_DEFAULTS: CountryContent = {
  enabled: true,
  entityName: "TODO Pte Ltd",
  licenseNo: "TODO — Moneylender's licence number (Registry of Moneylenders)",
  loanMin: 1000,
  loanMax: 30000,
  loanStep: 500,
  tenureMinMonths: 8,
  tenureMaxMonths: 60,
  interestRatePerMonth: 4,
  processingFeePercent: 0,
  minAge: 21,
  maxAge: 60,
  minMonthlyIncome: 1500,
  residency: "Singapore citizens, permanent residents, and valid work pass holders (Employment Pass / S Pass / Work Permit)",
  approvalTime: "TODO",
  whatsappNumber: "6585784648",
  supportEmail: "support@TODO",
  notifyEmail: "leads@TODO",
  officeAddress: "TODO",
  repaymentTable: SGD_RATE_SCHEDULE,
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  siteName: "TODO Brand",
  siteUrl: "https://TODO.example.com",
  countries: {
    MY: MY_DEFAULTS,
    SG: SG_DEFAULTS,
  },
};
