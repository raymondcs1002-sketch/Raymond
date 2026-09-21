/** Captures utm_* query params on any landing page so the apply form can attach them later. */
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const STORAGE_KEY = "myloan_utm";

const params = new URLSearchParams(window.location.search);
const utm: Record<string, string> = {};
let hasAny = false;

for (const key of UTM_KEYS) {
  const value = params.get(key);
  if (value) {
    utm[key.replace("utm_", "")] = value;
    hasAny = true;
  }
}

if (hasAny) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
  } catch {
    // sessionStorage may be unavailable (private browsing); UTM attribution is best-effort.
  }
}
