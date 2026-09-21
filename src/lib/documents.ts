/**
 * KYC document rules shared between the client (file picker + compression)
 * and the server (`/api/applications`), so both agree on what's allowed.
 */

export type DocumentKind = "id_front" | "id_back" | "selfie" | "address_proof" | "emergency_proof" | "payslip";

export const MAX_PAYSLIPS = 3;
/** One chat screenshot per family contact (emergency contact / next of kin). */
export const EMERGENCY_PROOF_COUNT = 2;

/**
 * How many of each kind an application carries. Every list of kinds (API
 * input filters, the DB check constraint) must follow this — a kind missing
 * from one of them silently drops that document and blocks submission.
 */
const DOCUMENT_RULES: Record<DocumentKind, { label: string; min: number; max: number }> = {
  id_front: { label: "ID front", min: 1, max: 1 },
  id_back: { label: "ID back", min: 1, max: 1 },
  selfie: { label: "selfie", min: 1, max: 1 },
  address_proof: { label: "address proof", min: 1, max: 1 },
  emergency_proof: { label: "contact chat screenshot", min: EMERGENCY_PROOF_COUNT, max: EMERGENCY_PROOF_COUNT },
  payslip: { label: "payslip", min: 1, max: MAX_PAYSLIPS },
};

export const DOCUMENT_KINDS = Object.keys(DOCUMENT_RULES) as DocumentKind[];

export function isDocumentKind(value: unknown): value is DocumentKind {
  return typeof value === "string" && (DOCUMENT_KINDS as string[]).includes(value);
}

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PDF_MIME_TYPE = "application/pdf";
export const ALLOWED_MIME_TYPES: readonly string[] = [...IMAGE_MIME_TYPES, PDF_MIME_TYPE];

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // after client-side compression
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export interface DocumentRef {
  kind: DocumentKind;
  /** 0 for single-kind documents; 0-based index for payslips / emergency screenshots. */
  index: number;
  mime: string;
}

/** Keeps the well-formed document refs from an untrusted request body. */
export function parseDocumentRefs(raw: unknown): DocumentRef[] {
  if (!Array.isArray(raw)) return [];
  const refs: DocumentRef[] = [];
  for (const item of raw) {
    const { kind, index, mime } = (item ?? {}) as { kind?: unknown; index?: unknown; mime?: unknown };
    if (isDocumentKind(kind) && Number.isInteger(index) && typeof mime === "string") {
      refs.push({ kind, index: index as number, mime });
    }
  }
  return refs;
}

export function isAllowedMime(kind: DocumentKind, mime: string): boolean {
  if (kind === "payslip") return ALLOWED_MIME_TYPES.includes(mime);
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export function maxBytesFor(mime: string): number {
  return mime === PDF_MIME_TYPE ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

export function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case PDF_MIME_TYPE:
      return "pdf";
    default:
      return "jpg";
  }
}

export function storagePath(applicationId: string, ref: DocumentRef): string {
  return `${applicationId}/${ref.kind}-${ref.index}.${extensionFor(ref.mime)}`;
}

/** Validates a full set of document refs against DOCUMENT_RULES: counts, distinct in-range indices, allowed mimes. */
export function validateDocumentSet(docs: DocumentRef[]): string | null {
  for (const kind of DOCUMENT_KINDS) {
    const { label, min, max } = DOCUMENT_RULES[kind];
    const matches = docs.filter((d) => d.kind === kind);

    if (matches.length < min || matches.length > max) {
      if (min !== max) return `Please upload between ${min} and ${max} ${label} documents.`;
      return min === 1 ? `Exactly one ${label} document is required.` : `Exactly ${min} ${label} documents are required.`;
    }
    const indices = new Set(matches.map((d) => d.index));
    if (indices.size !== matches.length || matches.some((d) => d.index < 0 || d.index >= max)) {
      return `Invalid ${label} document.`;
    }
    if (matches.some((d) => !isAllowedMime(kind, d.mime))) {
      return `Invalid file type for ${label}.`;
    }
  }

  return null;
}
