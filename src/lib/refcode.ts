import type { CountryCode } from "./countries";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

/** Generates a short, human-readable reference code like "MY-7K3F9Q". */
export function generateRefCode(country: CountryCode): string {
  let suffix = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    suffix += ALPHABET[byte % ALPHABET.length];
  }
  return `${country.toUpperCase()}-${suffix}`;
}
