import type { APIRoute } from "astro";
import { getCountryContent } from "../../../../lib/config";
import { isCountryCode } from "../../../../lib/countries";
import { parseDocumentRefs, validateDocumentSet, storagePath } from "../../../../lib/documents";
import { insertRow, listKycObjects, selectRows, updateRow, getSupabaseDashboardUrl, isSupabaseConfigured } from "../../../../lib/supabase";
import { sendApplicationNotification } from "../../../../lib/email";
import { jsonResponse } from "../../../../lib/http";

const MAX_APPLICATION_AGE_MS = 60 * 60 * 1000; // 1 hour

interface ApplicationRow {
  id: string;
  ref_code: string;
  view_token: string;
  country: string;
  status: string;
  full_name: string;
  id_number: string;
  whatsapp: string;
  email: string;
  employer_name: string;
  monthly_income: number;
  currency: string;
  loan_amount: number;
  tenure_months: number;
  purpose: string;
  created_at: string;
}

export const POST: APIRoute = async ({ params, request, locals, url }) => {
  const id = params.id;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return jsonResponse({ ok: false, error: "Invalid application id." }, 400);
  }

  let body: { documents?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400);
  }

  const documents = parseDocumentRefs(body.documents);

  const docError = validateDocumentSet(documents);
  if (docError) {
    return jsonResponse({ ok: false, error: docError }, 400);
  }

  // Dry-run mode (no Supabase configured): nothing to verify server-side, just acknowledge.
  if (!isSupabaseConfigured()) {
    console.log(`[applications:dry-run] submit ${id}`, documents);
    return jsonResponse({ ok: true, refCode: "DRY-RUN" });
  }

  // Independent lookups — fetch together instead of back to back.
  const [rows, uploadedNames] = await Promise.all([
    selectRows<ApplicationRow>("applications", `id=eq.${id}&select=*`),
    listKycObjects(id),
  ]);
  const application = rows[0];
  if (!application) {
    return jsonResponse({ ok: false, error: "Application not found." }, 404);
  }

  if (application.status !== "pending_docs") {
    return jsonResponse({ ok: false, error: "This application has already been submitted." }, 409);
  }

  const ageMs = Date.now() - new Date(application.created_at).getTime();
  if (ageMs > MAX_APPLICATION_AGE_MS) {
    return jsonResponse({ ok: false, error: "This application has expired. Please start a new one." }, 409);
  }

  // Defense in depth: confirm the files actually landed in storage before marking as submitted.
  const missing = documents.filter((doc) => !uploadedNames.includes(storagePath(id, doc).split("/")[1]));
  if (missing.length > 0) {
    return jsonResponse({ ok: false, error: "Some documents failed to upload. Please try again." }, 409);
  }

  const documentRows = documents.map((doc) => ({
    application_id: id,
    kind: doc.kind,
    storage_path: storagePath(id, doc),
    mime: doc.mime,
  }));

  const insertDocs = await insertRow("application_documents", documentRows);
  if (!insertDocs.ok) {
    return jsonResponse({ ok: false, error: "Could not save your documents. Please try again." }, 500);
  }

  const now = new Date().toISOString();
  const statusUpdate = updateRow("applications", { id }, { status: "submitted", submitted_at: now });

  // Send the notification alongside the status update rather than after it.
  const countryLower = application.country.toLowerCase();
  if (isCountryCode(countryLower)) {
    const content = getCountryContent(locals.siteContent, countryLower);
    const notification = sendApplicationNotification(content.notifyEmail, {
      refCode: application.ref_code,
      country: application.country,
      fullName: application.full_name,
      idNumber: application.id_number,
      whatsapp: application.whatsapp,
      email: application.email,
      loanAmount: application.loan_amount,
      currency: application.currency,
      tenureMonths: application.tenure_months,
      employerName: application.employer_name,
      monthlyIncome: application.monthly_income,
      purpose: application.purpose,
      supabaseTableUrl: getSupabaseDashboardUrl(),
      reviewUrl: `${url.origin}/review/${application.view_token}`,
    });
    await Promise.all([statusUpdate, notification]);
  } else {
    await statusUpdate;
  }

  return jsonResponse({ ok: true, refCode: application.ref_code });
};
