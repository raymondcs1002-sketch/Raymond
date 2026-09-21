/**
 * Country-specific formatting/validation rules.
 *
 * These are structural rules (phone format, ID format, currency), not
 * business content — business content (loan limits, rates, contact info)
 * lives in Edge Config, see `config.ts` / `config.defaults.ts`.
 */

export const COUNTRY_CODES = ["my", "sg"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

/**
 * "Market slug" — the public, user-facing identifier used in URLs and the
 * currency switcher. Deliberately currency-based, not country-based (the
 * product doesn't name which country it operates in outside legal pages).
 * Internally still maps 1:1 to a `CountryCode`, which stays untouched so
 * the DB, Global Config shape, and MyKad/NRIC validation logic don't need
 * to change.
 */
export const MARKET_SLUGS = ["myr", "sgd"] as const;
export type MarketSlug = (typeof MARKET_SLUGS)[number];

export function isMarketSlug(value: string): value is MarketSlug {
  return (MARKET_SLUGS as readonly string[]).includes(value);
}

export const MARKET_TO_COUNTRY: Record<MarketSlug, CountryCode> = {
  myr: "my",
  sgd: "sg",
};

export const COUNTRY_TO_MARKET: Record<CountryCode, MarketSlug> = {
  my: "myr",
  sg: "sgd",
};

export type IdType = "mykad" | "nric" | "fin";

export interface CountryRules {
  code: CountryCode;
  label: string;
  currency: "MYR" | "SGD";
  currencySymbol: string;
  locale: string;
  /** International dialing code, no leading "+". */
  dialCode: string;
  /** Matches the *national* number, i.e. without the dial code. */
  phonePattern: RegExp;
  phoneExample: string;
  /** Mobile or landline (national number) — for third-party contacts like an office or family member. */
  contactPhonePattern: RegExp;
  idTypes: IdType[];
  idLabel: string;
  idExample: string;
  /** Example FIN — markets where work-pass holders use a separate ID format (SG). */
  finExample?: string;
}

export const COUNTRY_RULES: Record<CountryCode, CountryRules> = {
  my: {
    code: "my",
    // Deliberately the currency, not the country name — see MarketSlug above.
    label: "MYR",
    currency: "MYR",
    currencySymbol: "RM",
    locale: "en-MY",
    dialCode: "60",
    // Malaysian mobile numbers: 1 followed by 8-9 digits (e.g. 123456789, 1123456789)
    phonePattern: /^1\d{8,9}$/,
    phoneExample: "12 345 6789",
    // Mobiles as above, or landlines like 3-1234 5678 / 4-123 4567
    contactPhonePattern: /^(1\d{8,9}|[3-9]\d{7,8})$/,
    idTypes: ["mykad"],
    idLabel: "MyKad number",
    idExample: "900101-14-5678",
  },
  sg: {
    code: "sg",
    label: "SGD",
    currency: "SGD",
    currencySymbol: "S$",
    locale: "en-SG",
    dialCode: "65",
    // Singapore mobile numbers start with 8 or 9, 8 digits total
    phonePattern: /^[89]\d{7}$/,
    phoneExample: "9123 4567",
    // Mobiles (8/9), landlines (6), and 3xxx numbers used by some offices
    contactPhonePattern: /^[3689]\d{7}$/,
    idTypes: ["nric", "fin"],
    idLabel: "NRIC/FIN number",
    idExample: "S1234567D",
    finExample: "G1234567X",
  },
};

export function getCountryRules(code: CountryCode): CountryRules {
  return COUNTRY_RULES[code];
}

/**
 * Every ITU-assigned country calling code, without the leading "+".
 *
 * An overseas number is only accepted when it starts with one of these, so a
 * number typed without its country code (or with a made-up one) is rejected
 * rather than stored as an unreachable "+" string. Codes are 1-3 digits and
 * no shorter code is a prefix of a longer one, so longest-match-first is
 * unambiguous — see `findCallingCode`.
 */
const CALLING_CODES = new Set<string>([
  // North America
  "1",
  // Africa
  "20", "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
  "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "245",
  "246", "247", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262",
  "263", "264", "265", "266", "267", "268", "269", "27", "290", "291", "297", "298", "299",
  // Europe
  "30", "31", "32", "33", "34", "350", "351", "352", "353", "354", "355", "356", "357", "358", "359", "36",
  "370", "371", "372", "373", "374", "375", "376", "377", "378", "379", "380", "381", "382", "383", "385", "386",
  "387", "389", "39", "40", "41", "420", "421", "423", "43", "44", "45", "46", "47", "48", "49",
  // Latin America & the Caribbean
  "500", "501", "502", "503", "504", "505", "506", "507", "508", "509", "51", "52", "53", "54", "55", "56", "57",
  "58", "590", "591", "592", "593", "594", "595", "596", "597", "598", "599",
  // Southeast Asia & Oceania
  "60", "61", "62", "63", "64", "65", "66", "670", "672", "673", "674", "675", "676", "677", "678", "679",
  "680", "681", "682", "683", "685", "686", "687", "688", "689", "690", "691", "692",
  // Russia & Kazakhstan
  "7",
  // East & South Asia
  "81", "82", "84", "850", "852", "853", "855", "856", "86", "870", "880", "881", "882", "883", "886", "888",
  // West, Central & South Asia
  "90", "91", "92", "93", "94", "95", "960", "961", "962", "963", "964", "965", "966", "967", "968",
  "970", "971", "972", "973", "974", "975", "976", "977", "98", "992", "993", "994", "995", "996", "998",
]);

/** The calling code an international number starts with, or null if it starts with none. */
export function findCallingCode(digits: string): string | null {
  for (const length of [3, 2, 1]) {
    const prefix = digits.slice(0, length);
    if (CALLING_CODES.has(prefix)) return prefix;
  }
  return null;
}
