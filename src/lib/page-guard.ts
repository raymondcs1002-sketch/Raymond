import { isMarketSlug, MARKET_TO_COUNTRY, getCountryRules, type CountryCode, type CountryRules, type MarketSlug } from "./countries";
import { getCountryContent, type SiteContent, type CountryContent } from "./config";

export interface ResolvedMarket {
  /** The public, currency-based URL slug, e.g. "sgd". */
  market: MarketSlug;
  /** Internal country code the slug maps to — used to look up content/rules. */
  country: CountryCode;
  content: CountryContent;
  rules: CountryRules;
}

/** Resolves the `[market]` route param, or null if it's invalid/disabled (caller should 404). */
export function resolveMarketParam(marketParam: string | undefined, siteContent: SiteContent): ResolvedMarket | null {
  if (!marketParam || !isMarketSlug(marketParam)) return null;

  const country = MARKET_TO_COUNTRY[marketParam];
  const content = getCountryContent(siteContent, country);
  if (!content.enabled) return null;

  return { market: marketParam, country, content, rules: getCountryRules(country) };
}
