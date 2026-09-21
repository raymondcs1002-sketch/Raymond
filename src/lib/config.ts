import { z } from "astro/zod";
// Vercel renamed "Edge Config" to "Global Config" (2026-07-29); this is the
// new SDK, used as a drop-in replacement for @vercel/edge-config.
import { createClient } from "@vercel/global-config";
import { GLOBAL_CONFIG, EDGE_CONFIG } from "astro:env/server";
import { DEFAULT_SITE_CONTENT, type CountryContent, type SiteContent } from "./config.defaults";
import type { CountryCode } from "./countries";

const tenureRateSchema = z.object({
  tenureMonths: z.number().int().positive(),
  ratePercent: z.number().positive(),
});

const rateBandSchema = z.object({
  minAmount: z.number().positive(),
  maxAmount: z.number().positive(),
  tenures: z.array(tenureRateSchema).min(1),
});

const countrySchema = z.object({
  enabled: z.boolean(),
  entityName: z.string().min(1),
  licenseNo: z.string().min(1),
  loanMin: z.number().positive(),
  loanMax: z.number().positive(),
  loanStep: z.number().positive(),
  tenureMinMonths: z.number().int().positive(),
  tenureMaxMonths: z.number().int().positive(),
  interestRatePerMonth: z.number().nonnegative(),
  processingFeePercent: z.number().nonnegative(),
  minAge: z.number().int().positive(),
  maxAge: z.number().int().positive(),
  minMonthlyIncome: z.number().nonnegative(),
  residency: z.string().min(1),
  approvalTime: z.string().min(1),
  whatsappNumber: z.string().min(1),
  supportEmail: z.string().min(1),
  notifyEmail: z.string().min(1),
  officeAddress: z.string().min(1),
  repaymentTable: z.array(rateBandSchema).min(1),
});

const siteContentSchema = z.object({
  siteName: z.string().min(1),
  siteUrl: z.string().min(1),
  countries: z.object({
    MY: countrySchema,
    SG: countrySchema,
  }),
});

/**
 * Validates a single country's content, falling back key-by-key to the
 * default when a value is missing or the wrong type/shape — so one bad
 * key in Edge Config never breaks the whole country.
 */
function mergeCountry(candidate: unknown, fallback: CountryContent): CountryContent {
  if (typeof candidate !== "object" || candidate === null) return fallback;

  const merged: Record<string, unknown> = { ...fallback, ...(candidate as Record<string, unknown>) };
  const result = countrySchema.safeParse(merged);
  if (result.success) return result.data;

  // Fall back key-by-key for whichever fields failed validation.
  const perKey: Record<string, unknown> = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof CountryContent)[]) {
    const single = { ...fallback, [key]: merged[key] };
    if (countrySchema.safeParse(single).success) {
      perKey[key] = merged[key];
    } else {
      console.warn(`[config] Edge Config key "${key}" is invalid, using default.`);
    }
  }
  return perKey as unknown as CountryContent;
}

function mergeSiteContent(raw: Record<string, unknown>): SiteContent {
  const siteName = typeof raw.siteName === "string" && raw.siteName.trim() ? raw.siteName : DEFAULT_SITE_CONTENT.siteName;
  const siteUrl = typeof raw.siteUrl === "string" && raw.siteUrl.trim() ? raw.siteUrl : DEFAULT_SITE_CONTENT.siteUrl;
  const countriesRaw = typeof raw.countries === "object" && raw.countries !== null ? (raw.countries as Record<string, unknown>) : {};

  const merged: SiteContent = {
    siteName,
    siteUrl,
    countries: {
      MY: mergeCountry(countriesRaw.MY, DEFAULT_SITE_CONTENT.countries.MY),
      SG: mergeCountry(countriesRaw.SG, DEFAULT_SITE_CONTENT.countries.SG),
    },
  };

  const validated = siteContentSchema.safeParse(merged);
  return validated.success ? validated.data : DEFAULT_SITE_CONTENT;
}

let warnedAboutMissingStore = false;

/**
 * Loads site content from Vercel Global Config (formerly "Edge Config"),
 * merged over local defaults. Never throws — any failure (no store
 * connected, network error, invalid data) falls back to
 * `DEFAULT_SITE_CONTENT` and says so on the console.
 */
export async function loadSiteContent(): Promise<SiteContent> {
  const connectionString = GLOBAL_CONFIG || EDGE_CONFIG;
  if (!connectionString) {
    // Middleware calls this per request, so say it once — but do say it. A
    // silent fallback here is indistinguishable from a Global Config edit
    // that didn't take, since both just serve the defaults below.
    if (!warnedAboutMissingStore) {
      warnedAboutMissingStore = true;
      console.warn("[config] No GLOBAL_CONFIG/EDGE_CONFIG connection string — serving built-in defaults.");
    }
    return DEFAULT_SITE_CONTENT;
  }

  try {
    const client = createClient(connectionString);
    const raw = await client.getAll();
    return mergeSiteContent(raw as Record<string, unknown>);
  } catch (error) {
    console.warn("[config] Failed to load Global Config, using defaults:", error);
    return DEFAULT_SITE_CONTENT;
  }
}

const COUNTRY_KEY: Record<CountryCode, keyof SiteContent["countries"]> = {
  my: "MY",
  sg: "SG",
};

export function getCountryContent(content: SiteContent, country: CountryCode): CountryContent {
  return content.countries[COUNTRY_KEY[country]];
}

/** Countries currently enabled in Global Config — used to decide whether to show a currency switcher at all. */
export function getEnabledCountries(content: SiteContent): CountryCode[] {
  return (Object.keys(COUNTRY_KEY) as CountryCode[]).filter((country) => getCountryContent(content, country).enabled);
}

export type { SiteContent, CountryContent };
