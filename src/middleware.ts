import { defineMiddleware } from "astro:middleware";
import { loadSiteContent } from "./lib/config";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.siteContent = await loadSiteContent();

  const response = await next();

  const isApi = context.url.pathname.startsWith("/api/");
  // Per-application review pages carry applicant PII and signed document
  // URLs — never cache or share these across viewers, unlike marketing pages.
  const isPrivate = context.url.pathname.startsWith("/review/");
  const isHtml = response.headers.get("content-type")?.includes("text/html");

  if (isPrivate) {
    response.headers.set("Cache-Control", "no-store");
  } else if (!isApi && isHtml) {
    // Edge Config changes should show up quickly, but we still want CDN
    // caching for speed — 60s fresh, then serve stale while revalidating.
    // Not in dev: "public" + stale-while-revalidate lets the browser keep
    // serving the page from before a Global Config edit, which looks exactly
    // like the edit never took effect.
    response.headers.set(
      "Cache-Control",
      import.meta.env.DEV ? "no-store" : "public, s-maxage=60, stale-while-revalidate=300",
    );
  } else if (isApi) {
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
});
