import { IP_HASH_SALT } from "astro:env/server";
import { selectRows } from "./supabase";

/** Hashes an IP address with a server-side salt — raw IPs are never stored. */
export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${IP_HASH_SALT}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Returns true if this IP has already submitted 5+ applications in the last hour. */
export async function isRateLimited(ipHash: string, maxPerHour = 5): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const rows = await selectRows(
    "applications",
    `select=id&ip_hash=eq.${encodeURIComponent(ipHash)}&created_at=gte.${encodeURIComponent(since)}`,
  );
  return rows.length >= maxPerHour;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}
