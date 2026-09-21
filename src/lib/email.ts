import { NOTIFY_FROM_EMAIL, RESEND_API_KEY } from "astro:env/server";

export interface ApplicationSummary {
  refCode: string;
  country: string;
  fullName: string;
  idNumber: string;
  whatsapp: string;
  email: string;
  loanAmount: number;
  currency: string;
  tenureMonths: number;
  employerName: string;
  monthlyIncome: number;
  purpose: string;
  supabaseTableUrl?: string;
  /** Per-application review page — view data + KYC documents, no login required. */
  reviewUrl: string;
}

function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && NOTIFY_FROM_EMAIL);
}

/**
 * Notifies the team by email that a new application was submitted.
 * Deliberately excludes KYC documents — those stay in Supabase Storage.
 * No-ops (logs to console) when Resend isn't configured.
 */
export async function sendApplicationNotification(
  to: string,
  summary: ApplicationSummary,
): Promise<void> {
  const subject = `New loan application ${summary.refCode} (${summary.country})`;
  const whatsappLink = `https://wa.me/${summary.whatsapp.replace(/[^0-9]/g, "")}`;

  const html = `
    <h2>New application: ${escapeHtml(summary.refCode)}</h2>
    <p>
      <a href="${summary.reviewUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
        View application &amp; documents
      </a>
    </p>
    <p style="color:#666;font-size:13px;">This link shows the applicant's details and uploaded ID/selfie/payslip photos — no login needed. Keep it private; anyone with the link can view it.</p>
    <table cellpadding="4" cellspacing="0">
      <tr><td><strong>Country</strong></td><td>${escapeHtml(summary.country)}</td></tr>
      <tr><td><strong>Name</strong></td><td>${escapeHtml(summary.fullName)}</td></tr>
      <tr><td><strong>ID number</strong></td><td>${escapeHtml(summary.idNumber)}</td></tr>
      <tr><td><strong>WhatsApp</strong></td><td><a href="${whatsappLink}">${escapeHtml(summary.whatsapp)}</a></td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(summary.email)}</td></tr>
      <tr><td><strong>Loan amount</strong></td><td>${escapeHtml(summary.currency)} ${summary.loanAmount}</td></tr>
      <tr><td><strong>Tenure</strong></td><td>${summary.tenureMonths} months</td></tr>
      <tr><td><strong>Employer</strong></td><td>${escapeHtml(summary.employerName)}</td></tr>
      <tr><td><strong>Monthly income</strong></td><td>${escapeHtml(summary.currency)} ${summary.monthlyIncome}</td></tr>
      <tr><td><strong>Purpose</strong></td><td>${escapeHtml(summary.purpose)}</td></tr>
    </table>
    ${summary.supabaseTableUrl ? `<p><a href="${summary.supabaseTableUrl}">View in Supabase</a></p>` : ""}
  `;

  if (!isEmailConfigured()) {
    console.log(`[email:dry-run] would send "${subject}" to ${to}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[email] Resend request failed (${res.status}):`, text);
    }
  } catch (error) {
    // Notification failures must never block the application flow.
    console.error("[email] Failed to send notification:", error);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
