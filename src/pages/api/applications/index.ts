import type { APIRoute } from "astro";
import { isCountryCode, getCountryRules } from "../../../lib/countries";
import { getCountryContent } from "../../../lib/config";
import {
  validateApplication,
  deriveIdType,
  isPassStatus,
  usesNextOfKin,
  RESIDENCY_STATUSES,
  type ApplicationInput,
  type CountryLimits,
} from "../../../lib/validate";
import { generateRefCode } from "../../../lib/refcode";
import { insertRow, createSignedUploadUrl } from "../../../lib/supabase";
import { hashIp, isRateLimited, getClientIp } from "../../../lib/ratelimit";
import { parseDocumentRefs, validateDocumentSet, storagePath, type DocumentKind } from "../../../lib/documents";
import { jsonResponse } from "../../../lib/http";

interface RequestBody {
  country?: string;
  fullName?: string;
  idNumber?: string;
  dateOfBirth?: string;
  whatsapp?: string;
  email?: string;
  employmentStatus?: string;
  employerName?: string;
  monthlyIncome?: unknown;
  loanAmount?: unknown;
  tenureMonths?: unknown;
  purpose?: string;
  residesLocally?: unknown;
  residencyStatus?: unknown;
  passIssueDate?: unknown;
  passExpiryDate?: unknown;
  emergencyContact1Name?: unknown;
  emergencyContact1Relationship?: unknown;
  emergencyContact1Phone?: unknown;
  emergencyContact2Name?: unknown;
  emergencyContact2Relationship?: unknown;
  emergencyContact2Phone?: unknown;
  officePhone?: unknown;
  bankName?: unknown;
  bankAccountNumber?: unknown;
  nextOfKin1Name?: unknown;
  nextOfKin1Relationship?: unknown;
  nextOfKin1Phone?: unknown;
  nextOfKin2Name?: unknown;
  nextOfKin2Relationship?: unknown;
  nextOfKin2Phone?: unknown;
  consent?: unknown;
  honeypot?: unknown;
  documents?: unknown;
  utm?: Record<string, string>;
}

export const POST: APIRoute = async ({ request, locals }) => {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, errors: { generic: "Invalid request body." } }, 400);
  }

  if (!body.country || !isCountryCode(body.country)) {
    return jsonResponse({ ok: false, errors: { generic: "Invalid or unsupported country." } }, 400);
  }
  const country = body.country;

  const content = getCountryContent(locals.siteContent, country);
  if (!content.enabled) {
    return jsonResponse({ ok: false, errors: { generic: "Applications are not available in this country yet." } }, 400);
  }

  const limits: CountryLimits = {
    loanMin: content.loanMin,
    loanMax: content.loanMax,
    tenureMinMonths: content.tenureMinMonths,
    tenureMaxMonths: content.tenureMaxMonths,
    minAge: content.minAge,
    maxAge: content.maxAge,
    minMonthlyIncome: content.minMonthlyIncome,
  };

  const residencyStatus =
    typeof body.residencyStatus === "string" && (RESIDENCY_STATUSES as readonly string[]).includes(body.residencyStatus)
      ? (body.residencyStatus as ApplicationInput["residencyStatus"])
      : null;

  // Pass dates belong to a work pass only. Don't trust the client to have
  // cleared them after switching status — the DB constraint rejects the row.
  const passDate = (value: unknown) => (isPassStatus(residencyStatus) && typeof value === "string" && value ? value : null);
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  // The two family contacts go by one name per market — never both. Drop
  // whichever set this market doesn't use rather than trusting the client.
  const kin = usesNextOfKin(country);
  const kinText = (value: unknown) => (kin ? text(value) : "");
  const emergencyText = (value: unknown) => (kin ? "" : text(value));

  const input: ApplicationInput = {
    country,
    fullName: String(body.fullName ?? ""),
    idNumber: String(body.idNumber ?? ""),
    dateOfBirth: String(body.dateOfBirth ?? ""),
    whatsapp: String(body.whatsapp ?? ""),
    email: String(body.email ?? ""),
    employmentStatus: String(body.employmentStatus ?? ""),
    employerName: String(body.employerName ?? ""),
    monthlyIncome: Number(body.monthlyIncome),
    loanAmount: Number(body.loanAmount),
    tenureMonths: Number(body.tenureMonths),
    purpose: String(body.purpose ?? ""),
    residesLocally: typeof body.residesLocally === "boolean" ? body.residesLocally : null,
    residencyStatus,
    passIssueDate: passDate(body.passIssueDate),
    passExpiryDate: passDate(body.passExpiryDate),
    emergencyContact1Name: emergencyText(body.emergencyContact1Name),
    emergencyContact1Relationship: emergencyText(body.emergencyContact1Relationship),
    emergencyContact1Phone: emergencyText(body.emergencyContact1Phone),
    emergencyContact2Name: emergencyText(body.emergencyContact2Name),
    emergencyContact2Relationship: emergencyText(body.emergencyContact2Relationship),
    emergencyContact2Phone: emergencyText(body.emergencyContact2Phone),
    officePhone: text(body.officePhone),
    bankName: text(body.bankName),
    bankAccountNumber: text(body.bankAccountNumber),
    nextOfKin1Name: kinText(body.nextOfKin1Name),
    nextOfKin1Relationship: kinText(body.nextOfKin1Relationship),
    nextOfKin1Phone: kinText(body.nextOfKin1Phone),
    nextOfKin2Name: kinText(body.nextOfKin2Name),
    nextOfKin2Relationship: kinText(body.nextOfKin2Relationship),
    nextOfKin2Phone: kinText(body.nextOfKin2Phone),
    consent: Boolean(body.consent),
    honeypot: typeof body.honeypot === "string" ? body.honeypot : "",
  };

  const result = validateApplication(input, limits, content.repaymentTable);
  if (!result.valid || !result.normalized) {
    return jsonResponse({ ok: false, errors: result.errors }, 400);
  }
  const normalized = result.normalized;

  const documents = parseDocumentRefs(body.documents);

  const docError = validateDocumentSet(documents);
  if (docError) {
    return jsonResponse({ ok: false, errors: { generic: docError } }, 400);
  }

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip);
  if (await isRateLimited(ipHash)) {
    return jsonResponse(
      { ok: false, errors: { generic: "Too many applications submitted recently. Please try again later." } },
      429,
    );
  }

  const id = crypto.randomUUID();
  const refCode = generateRefCode(country);
  const now = new Date().toISOString();
  const rules = getCountryRules(country);

  const insert = await insertRow("applications", {
    id,
    ref_code: refCode,
    country: country.toUpperCase(),
    status: "pending_docs",
    full_name: input.fullName.trim(),
    id_type: deriveIdType(country, normalized.idNumber),
    id_number: normalized.idNumber,
    date_of_birth: input.dateOfBirth,
    whatsapp: normalized.whatsappE164,
    email: input.email.trim().toLowerCase(),
    employment_status: input.employmentStatus,
    employer_name: input.employerName.trim(),
    monthly_income: input.monthlyIncome,
    currency: rules.currency,
    loan_amount: input.loanAmount,
    tenure_months: input.tenureMonths,
    purpose: input.purpose.trim(),
    resides_locally: input.residesLocally,
    residency_status: input.residencyStatus,
    pass_issue_date: input.passIssueDate,
    pass_expiry_date: input.passExpiryDate,
    emergency_contact_1_name: kin ? null : input.emergencyContact1Name!.trim(),
    emergency_contact_1_relationship: kin ? null : input.emergencyContact1Relationship,
    emergency_contact_1_phone: normalized.emergencyContactPhonesE164?.[0] ?? null,
    emergency_contact_2_name: kin ? null : input.emergencyContact2Name!.trim(),
    emergency_contact_2_relationship: kin ? null : input.emergencyContact2Relationship,
    emergency_contact_2_phone: normalized.emergencyContactPhonesE164?.[1] ?? null,
    office_phone: normalized.officePhoneE164,
    bank_name: input.bankName.trim(),
    bank_account_number: input.bankAccountNumber.replace(/[^0-9]/g, ""),
    next_of_kin_1_name: kin ? input.nextOfKin1Name!.trim() : null,
    next_of_kin_1_relationship: kin ? input.nextOfKin1Relationship : null,
    next_of_kin_1_phone: normalized.nextOfKinPhonesE164?.[0] ?? null,
    next_of_kin_2_name: kin ? input.nextOfKin2Name!.trim() : null,
    next_of_kin_2_relationship: kin ? input.nextOfKin2Relationship : null,
    next_of_kin_2_phone: normalized.nextOfKinPhonesE164?.[1] ?? null,
    consent_version: "2026-09-15",
    consent_at: now,
    utm: body.utm ?? null,
    ip_hash: ipHash,
    user_agent: request.headers.get("user-agent") ?? null,
    created_at: now,
  });

  if (!insert.ok) {
    return jsonResponse(
      { ok: false, errors: { generic: "Something went wrong saving your application. Please try again." } },
      500,
    );
  }

  const signedResults = await Promise.all(
    documents.map(async (doc) => {
      const path = storagePath(id, doc);
      return { doc, path, signed: await createSignedUploadUrl(path) };
    }),
  );
  const uploads: { kind: DocumentKind; index: number; path: string; signedUrl: string }[] = [];
  for (const { doc, path, signed } of signedResults) {
    if (!signed.ok) {
      return jsonResponse(
        { ok: false, errors: { generic: "Could not prepare document upload. Please try again." } },
        500,
      );
    }
    uploads.push({ kind: doc.kind, index: doc.index, path, signedUrl: signed.signedUrl });
  }

  return jsonResponse({ ok: true, id, refCode, uploads });
};
