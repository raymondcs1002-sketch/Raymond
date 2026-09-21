import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "astro:env/server";

/**
 * Thin wrapper around Supabase's REST (PostgREST) and Storage APIs using
 * the service role key. We deliberately avoid the `@supabase/supabase-js`
 * client at runtime to keep the serverless function lean — plain `fetch`
 * is enough for the handful of operations we need.
 *
 * All functions are no-ops that log to the console when Supabase isn't
 * configured, so local dev works without a project ("dry run" mode).
 */

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function insertRow<T extends Record<string, unknown>>(
  table: string,
  row: T | T[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    console.log(`[supabase:dry-run] insert into ${table}:`, row);
    return { ok: true };
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[supabase] insert into ${table} failed (${res.status}):`, text);
    return { ok: false, error: text || `HTTP ${res.status}` };
  }

  return { ok: true };
}

export async function updateRow(
  table: string,
  match: Record<string, string>,
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    console.log(`[supabase:dry-run] update ${table} where`, match, "set", patch);
    return { ok: true };
  }

  const query = Object.entries(match)
    .map(([key, value]) => `${key}=eq.${encodeURIComponent(value)}`)
    .join("&");

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: restHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[supabase] update ${table} failed (${res.status}):`, text);
    return { ok: false, error: text || `HTTP ${res.status}` };
  }

  return { ok: true };
}

export async function selectRows<T = Record<string, unknown>>(
  table: string,
  query: string,
): Promise<T[]> {
  if (!isSupabaseConfigured()) {
    console.log(`[supabase:dry-run] select from ${table}?${query}`);
    return [];
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: restHeaders(),
  });

  if (!res.ok) return [];
  return (await res.json()) as T[];
}

/** Creates a signed upload URL for the private `kyc` storage bucket. */
export async function createSignedUploadUrl(
  path: string,
): Promise<{ ok: true; signedUrl: string; token: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    console.log(`[supabase:dry-run] signed upload url for kyc/${path}`);
    return { ok: true, signedUrl: `dry-run://kyc/${path}`, token: "dry-run" };
  }

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/kyc/${path}`, {
    method: "POST",
    headers: restHeaders(),
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[supabase] signed upload url for kyc/${path} failed (${res.status}):`, text);
    return { ok: false, error: text || `HTTP ${res.status}` };
  }

  const data = (await res.json()) as { url: string; token: string };
  // The storage API returns a relative URL like "/object/upload/sign/kyc/...".
  const signedUrl = data.url.startsWith("http") ? data.url : `${SUPABASE_URL}/storage/v1${data.url}`;
  return { ok: true, signedUrl, token: data.token };
}

/** Creates a short-lived signed READ URL for a file in the private `kyc` bucket (for the review page). */
export async function createSignedReadUrl(path: string, expiresInSeconds = 600): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    console.log(`[supabase:dry-run] signed read url for kyc/${path}`);
    return null;
  }

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/kyc/${path}`, {
    method: "POST",
    headers: restHeaders(),
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });

  if (!res.ok) {
    console.error(`[supabase] signed read url for kyc/${path} failed (${res.status})`);
    return null;
  }

  const data = (await res.json()) as { signedURL: string };
  return data.signedURL.startsWith("http") ? data.signedURL : `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

/** Best-effort link to the Supabase dashboard table editor, for notification emails. */
export function getSupabaseDashboardUrl(): string | undefined {
  if (!SUPABASE_URL) return undefined;
  try {
    const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
    return `https://supabase.com/dashboard/project/${projectRef}/editor`;
  } catch {
    return undefined;
  }
}

/** Lists object names under a prefix in the `kyc` bucket. */
export async function listKycObjects(prefix: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/kyc`, {
    method: "POST",
    headers: restHeaders(),
    body: JSON.stringify({ prefix, limit: 100 }),
  });

  if (!res.ok) return [];
  const items = (await res.json()) as { name: string }[];
  return items.map((item) => item.name);
}
