import { PUBLIC_SUPABASE_ANON_KEY } from "astro:env/client";
import {
  validateApplication,
  isPassStatus,
  usesNextOfKin,
  type ApplicationInput,
  type ApplicationErrors,
  type CountryLimits,
} from "../lib/validate";
import { getTenureOptions, summarize, type RateSchedule } from "../lib/repayment";
import { COUNTRY_RULES, COUNTRY_TO_MARKET, type CountryCode, type CountryRules } from "../lib/countries";
import type { DocumentKind } from "../lib/documents";

interface DocState {
  mime: string;
  blob: Blob;
  name: string;
}

const UTM_STORAGE_KEY = "myloan_utm";
const TOTAL_STEPS = 5;

const STEP_FIELDS: Record<number, (keyof ApplicationInput)[]> = {
  1: ["loanAmount", "tenureMonths", "purpose"],
  2: [
    "fullName",
    "residencyStatus",
    "passIssueDate",
    "passExpiryDate",
    "idNumber",
    "dateOfBirth",
    "whatsapp",
    "email",
    "residesLocally",
    // Only one of these two sets is on the page — the other never errors.
    "emergencyContact1Name",
    "emergencyContact1Relationship",
    "emergencyContact1Phone",
    "emergencyContact2Name",
    "emergencyContact2Relationship",
    "emergencyContact2Phone",
    "nextOfKin1Name",
    "nextOfKin1Relationship",
    "nextOfKin1Phone",
    "nextOfKin2Name",
    "nextOfKin2Relationship",
    "nextOfKin2Phone",
  ],
  3: ["employmentStatus", "employerName", "officePhone", "monthlyIncome", "bankName", "bankAccountNumber"],
  4: [],
  5: ["consent", "honeypot"],
};

/** Uploads each step requires before moving on — [kind, index]. */
const STEP_DOCUMENTS: Record<number, [DocumentKind, number][]> = {
  2: [
    ["emergency_proof", 0],
    ["emergency_proof", 1],
  ],
  4: [
    ["id_front", 0],
    ["id_back", 0],
    ["selfie", 0],
    ["address_proof", 0],
    ["payslip", 0],
  ],
};

const root = document.querySelector<HTMLElement>("[data-apply-root]");

if (root) {
  const country = root.dataset.country as CountryCode;
  const rules: CountryRules = COUNTRY_RULES[country];

  // loanMin/loanMax/tenureMinMonths/tenureMaxMonths aren't used once a
  // repayment table is present — validateApplication checks against the
  // table's exact amount/tenure combinations instead (see below).
  const limits: CountryLimits = {
    loanMin: 0,
    loanMax: Infinity,
    tenureMinMonths: 0,
    tenureMaxMonths: Infinity,
    minAge: Number(root.dataset.minAge),
    maxAge: Number(root.dataset.maxAge),
    minMonthlyIncome: Number(root.dataset.minIncome),
  };
  let repaymentTable: RateSchedule = [];
  try {
    repaymentTable = JSON.parse(root.dataset.schedule ?? "[]");
  } catch {
    repaymentTable = [];
  }

  // Malaysia calls them emergency contacts, Singapore next of kin — same two people.
  const contactPrefix = usesNextOfKin(country) ? ("nextOfKin" as const) : ("emergencyContact" as const);
  const contactLabel = usesNextOfKin(country) ? "Next of kin" : "Emergency contact";

  const documents: Record<DocumentKind, (DocState | null)[]> = {
    id_front: [null],
    id_back: [null],
    selfie: [null],
    address_proof: [null],
    emergency_proof: [null, null],
    payslip: [null, null, null],
  };

  const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-step]"));
  // The progress bar sits outside the <form>, so it has to be queried from the
  // document — `root` is the form itself and never matches it.
  const progressBars = Array.from(document.querySelectorAll<HTMLElement>("[data-progress-bar]"));
  const stepIndicators = Array.from(root.querySelectorAll<HTMLElement>("[data-step-indicator]"));
  const submitBtn = root.querySelector<HTMLButtonElement>("[data-submit]");
  const statusBox = root.querySelector<HTMLElement>("[data-form-status]");

  function formatMoneyLocal(amount: number): string {
    // Matches src/lib/format.ts: SGD's Intl currency symbol is an ambiguous
    // "$" in English locales, so we prefix our own symbol instead.
    const grouped = new Intl.NumberFormat(rules.locale, { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
    return `${rules.currencySymbol} ${grouped}`;
  }

  function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  }

  function fieldEl(name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
    return root!.querySelector(`[data-field="${name}"]`);
  }

  function getStringField(name: string): string {
    return (fieldEl(name)?.value ?? "").trim();
  }

  function getNumberField(name: string): number {
    return Number(fieldEl(name)?.value);
  }

  function getBoolField(name: string): boolean {
    const el = fieldEl(name) as HTMLInputElement | null;
    return el?.checked ?? false;
  }

  /** Reads a hidden input driven by a "true"/"false" pill toggle — "" (unanswered) becomes null. */
  function getTriStateField(name: string): boolean | null {
    const value = getStringField(name);
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }

  function collectInput(): ApplicationInput {
    return {
      country,
      fullName: getStringField("fullName"),
      idNumber: getStringField("idNumber"),
      dateOfBirth: getStringField("dateOfBirth"),
      whatsapp: getStringField("whatsapp"),
      email: getStringField("email"),
      employmentStatus: getStringField("employmentStatus"),
      employerName: getStringField("employerName"),
      monthlyIncome: getNumberField("monthlyIncome"),
      loanAmount: getNumberField("loanAmount"),
      tenureMonths: getNumberField("tenureMonths"),
      purpose: getStringField("purpose"),
      residesLocally: getTriStateField("residesLocally"),
      residencyStatus: (getStringField("residencyStatus") || null) as ApplicationInput["residencyStatus"],
      passIssueDate: getStringField("passIssueDate") || null,
      passExpiryDate: getStringField("passExpiryDate") || null,
      emergencyContact1Name: getStringField("emergencyContact1Name"),
      emergencyContact1Relationship: getStringField("emergencyContact1Relationship"),
      emergencyContact1Phone: getStringField("emergencyContact1Phone"),
      emergencyContact2Name: getStringField("emergencyContact2Name"),
      emergencyContact2Relationship: getStringField("emergencyContact2Relationship"),
      emergencyContact2Phone: getStringField("emergencyContact2Phone"),
      // Only the market's own set has inputs on the page; the rest read "".
      officePhone: getStringField("officePhone"),
      bankName: getStringField("bankName"),
      bankAccountNumber: getStringField("bankAccountNumber"),
      nextOfKin1Name: getStringField("nextOfKin1Name"),
      nextOfKin1Relationship: getStringField("nextOfKin1Relationship"),
      nextOfKin1Phone: getStringField("nextOfKin1Phone"),
      nextOfKin2Name: getStringField("nextOfKin2Name"),
      nextOfKin2Relationship: getStringField("nextOfKin2Relationship"),
      nextOfKin2Phone: getStringField("nextOfKin2Phone"),
      consent: getBoolField("consent"),
      honeypot: getStringField("honeypot"),
    };
  }

  // Generic Yes/No pill toggle -> hidden input (used by residesLocally).
  root.querySelectorAll<HTMLElement>("[data-tristate-group]").forEach((group) => {
    const fieldName = group.dataset.tristateGroup;
    if (!fieldName) return;
    const hidden = fieldEl(fieldName) as HTMLInputElement | null;
    group.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tristate-option]");
      if (!btn || !hidden) return;
      hidden.value = btn.dataset.value ?? "";
      group.querySelectorAll("[data-tristate-option]").forEach((el) => el.setAttribute("aria-pressed", String(el === btn)));
    });
  });

  // Swaps an element's text/placeholder for its `data-alt-*` variant once, caching the
  // original so toggling back and forth (e.g. Local <-> Work Pass) never loses it.
  function swapText(el: HTMLElement | null, useAlt: boolean) {
    if (!el) return;
    if (el.dataset.defaultText === undefined) el.dataset.defaultText = el.textContent ?? "";
    const alt = el.dataset.altLabel;
    el.textContent = useAlt && alt ? alt : el.dataset.defaultText;
  }

  function swapPlaceholder(el: HTMLInputElement | null, useAlt: boolean) {
    if (!el) return;
    if (el.dataset.defaultPlaceholder === undefined) el.dataset.defaultPlaceholder = el.placeholder;
    const alt = el.dataset.altPlaceholder;
    el.placeholder = useAlt && alt ? alt : el.dataset.defaultPlaceholder;
  }

  // SG only: a work pass holder uploads their pass rather than an NRIC, and has
  // to supply the pass's issue/expiry dates. Citizens and PRs see neither.
  function applyResidencyStatus(value: string) {
    const isPass = isPassStatus(value);

    swapPlaceholder(fieldEl("idNumber") as HTMLInputElement | null, isPass);

    root!.querySelectorAll<HTMLElement>('[data-file-field][data-kind="id_front"], [data-file-field][data-kind="id_back"]').forEach((wrap) => {
      swapText(wrap.querySelector<HTMLElement>("[data-file-label]"), isPass);
      const hintEl = wrap.querySelector<HTMLElement>("[data-file-hint]");
      if (hintEl) {
        swapText(hintEl, isPass);
        hintEl.hidden = !hintEl.textContent;
      }
    });

    root!.querySelectorAll<HTMLElement>("[data-pass-only]").forEach((wrap) => {
      wrap.style.display = isPass ? "" : "none";
    });

    // Switching away from a pass must not leave dates behind — the server
    // rejects a citizen/PR application that still carries them.
    if (!isPass) {
      const issue = fieldEl("passIssueDate") as HTMLInputElement | null;
      const expiry = fieldEl("passExpiryDate") as HTMLInputElement | null;
      if (issue) issue.value = "";
      if (expiry) expiry.value = "";
    }
  }

  const residencySelect = root.querySelector<HTMLSelectElement>("[data-residency-select]");
  residencySelect?.addEventListener("change", () => applyResidencyStatus(residencySelect.value));

  function showErrors(errors: ApplicationErrors) {
    root!.querySelectorAll<HTMLElement>("[data-error-for]").forEach((el) => {
      el.textContent = "";
    });
    root!.querySelectorAll<HTMLElement>("[data-field-wrap]").forEach((el) => {
      el.dataset.invalid = "false";
    });
    for (const [key, message] of Object.entries(errors)) {
      const errorEl = root!.querySelector<HTMLElement>(`[data-error-for="${key}"]`);
      if (errorEl) errorEl.textContent = message as string;
      const wrap = root!.querySelector<HTMLElement>(`[data-field-wrap="${key}"]`);
      if (wrap) wrap.dataset.invalid = "true";
    }
  }

  function validateStep(step: number): boolean {
    const docsOk = validateStepDocuments(step);
    const input = collectInput();
    const result = validateApplication(input, limits, repaymentTable);
    const relevantKeys = STEP_FIELDS[step] ?? [];
    const stepErrors: ApplicationErrors = {};
    for (const key of relevantKeys) {
      if (result.errors[key]) stepErrors[key] = result.errors[key];
    }
    showErrors(stepErrors);
    return docsOk && Object.keys(stepErrors).length === 0;
  }

  function firstInvalidStep(errors: ApplicationErrors): number | null {
    for (const [step, keys] of Object.entries(STEP_FIELDS)) {
      if (keys.some((key) => errors[key])) return Number(step);
    }
    return null;
  }

  function validateStepDocuments(step: number): boolean {
    let ok = true;
    for (const [kind, index] of STEP_DOCUMENTS[step] ?? []) {
      const wrap = root!.querySelector<HTMLElement>(`[data-file-field][data-kind="${kind}"][data-index="${index}"]`);
      const errorEl = wrap?.querySelector<HTMLElement>("[data-file-error]");
      if (!documents[kind][index]) {
        ok = false;
        if (errorEl) errorEl.textContent = "This document is required.";
      } else if (errorEl) {
        errorEl.textContent = "";
      }
    }
    return ok;
  }

  function showStep(step: number) {
    steps.forEach((el) => {
      el.dataset.active = String(Number(el.dataset.step) === step);
    });
    progressBars.forEach((el, i) => {
      el.dataset.state = i < step - 1 ? "done" : i === step - 1 ? "active" : "todo";
    });
    stepIndicators.forEach((el) => {
      el.textContent = String(step);
    });
    if (step === TOTAL_STEPS) renderSummary();
    root!.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderSummary() {
    const summaryEl = root!.querySelector<HTMLElement>("[data-summary]");
    if (!summaryEl) return;
    const input = collectInput();
    const rows: [string, string][] = [
      ["Loan amount", formatMoneyLocal(input.loanAmount)],
      ["Tenure", `${input.tenureMonths} months`],
      ["Full name", input.fullName],
      ["WhatsApp", input.whatsapp],
      [`${contactLabel} 1`, `${input[`${contactPrefix}1Name`]} (${input[`${contactPrefix}1Phone`]})`],
      [`${contactLabel} 2`, `${input[`${contactPrefix}2Name`]} (${input[`${contactPrefix}2Phone`]})`],
      ["Employer", input.employerName],
      ["Monthly income", formatMoneyLocal(input.monthlyIncome)],
      ["Bank account", `${input.bankName} ${input.bankAccountNumber}`],
    ];
    summaryEl.innerHTML = rows
      .map(([label, value]) => `<div class="apply-summary__row"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`)
      .join("");
  }

  // --- Step 1: loan amount slider + tenure pills, driven by the rate schedule ---

  const loanAmountInput = root.querySelector<HTMLInputElement>("[data-loan-amount]");
  const loanAmountOutput = root.querySelector<HTMLOutputElement>("#loan-amount-output");
  const loanTenureField = root.querySelector<HTMLInputElement>('[data-field="tenureMonths"]');
  const loanTenureGroup = root.querySelector<HTMLElement>("[data-loan-tenure-group]");
  const instalmentOutput = root.querySelector<HTMLElement>("[data-loan-instalment-output]");

  function repopulateLoanTenure() {
    if (!loanAmountInput || !loanTenureGroup || !loanTenureField) return;
    const amount = Number(loanAmountInput.value);
    const options = getTenureOptions(repaymentTable, amount);
    const previous = Number(loanTenureField.value);
    const stillValid = options.some((o) => o.tenureMonths === previous);
    const selected = stillValid ? previous : (options[Math.floor(options.length / 2)]?.tenureMonths ?? options[0]?.tenureMonths ?? 0);

    loanTenureGroup.innerHTML = options
      .map(
        (o) =>
          `<button type="button" class="tenure-pill" data-tenure-pill data-value="${o.tenureMonths}" aria-pressed="${o.tenureMonths === selected}">${o.tenureMonths} months</button>`,
      )
      .join("");
    loanTenureField.value = String(selected);
  }

  function renderLoanStep() {
    if (!loanAmountInput || !loanTenureField) return;
    const amount = Number(loanAmountInput.value);
    if (loanAmountOutput) loanAmountOutput.textContent = formatMoneyLocal(amount);

    const tenureMonths = Number(loanTenureField.value);
    const option = getTenureOptions(repaymentTable, amount).find((o) => o.tenureMonths === tenureMonths);
    if (instalmentOutput && option) {
      instalmentOutput.textContent = formatMoneyLocal(summarize(option, amount).monthlyInstalment);
    }
  }

  loanAmountInput?.addEventListener("input", () => {
    repopulateLoanTenure();
    renderLoanStep();
  });

  loanTenureGroup?.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-tenure-pill]");
    if (!btn || !loanTenureField) return;
    loanTenureField.value = btn.dataset.value ?? "";
    loanTenureGroup.querySelectorAll("[data-tenure-pill]").forEach((el) => el.setAttribute("aria-pressed", String(el === btn)));
    renderLoanStep();
  });

  renderLoanStep();

  // --- Documents: compression + state -------------------------------------

  async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unsupported");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compression failed"))), "image/jpeg", quality);
    });
  }

  root.querySelectorAll<HTMLElement>("[data-file-field]").forEach((wrap) => {
    const kind = wrap.dataset.kind as DocumentKind;
    const index = Number(wrap.dataset.index);
    const input = wrap.querySelector<HTMLInputElement>("[data-file-input]");
    const statusEl = wrap.querySelector<HTMLElement>("[data-file-status]");
    const label = wrap.querySelector<HTMLElement>(".file-field");
    const errorEl = wrap.querySelector<HTMLElement>("[data-file-error]");
    if (!input || !statusEl || !label) return;

    input.addEventListener("change", async () => {
      if (errorEl) errorEl.textContent = "";
      const file = input.files?.[0];
      if (!file) {
        documents[kind][index] = null;
        statusEl.textContent = "No file selected";
        label.dataset.status = "empty";
        return;
      }

      const isPdf = file.type === "application/pdf";
      const allowPdf = kind === "payslip";

      if (isPdf && !allowPdf) {
        if (errorEl) errorEl.textContent = "Please upload a photo (JPG/PNG), not a PDF.";
        input.value = "";
        return;
      }
      if (!isPdf && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        if (errorEl) errorEl.textContent = "Please upload a JPG, PNG, or WEBP image.";
        input.value = "";
        return;
      }
      const maxSourceSize = isPdf ? 5 * 1024 * 1024 : 15 * 1024 * 1024;
      if (file.size > maxSourceSize) {
        if (errorEl) errorEl.textContent = "This file is too large.";
        input.value = "";
        return;
      }

      statusEl.textContent = "Processing…";
      label.dataset.status = "processing";

      try {
        let blob: Blob = file;
        let mime = file.type;
        if (!isPdf) {
          blob = await compressImage(file);
          mime = "image/jpeg";
        }
        documents[kind][index] = { mime, blob, name: file.name };
        statusEl.textContent = `${file.name} (${Math.round(blob.size / 1024)} KB)`;
        label.dataset.status = "uploaded";
      } catch {
        if (errorEl) errorEl.textContent = "Could not process this file. Please try another.";
        label.dataset.status = "error";
        documents[kind][index] = null;
      }
    });
  });

  // --- Navigation -----------------------------------------------------------

  root.querySelectorAll<HTMLButtonElement>("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.closest<HTMLElement>("[data-step]")?.dataset.step);
      const ok = validateStep(step);
      if (!ok) return;
      showStep(step + 1);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.closest<HTMLElement>("[data-step]")?.dataset.step);
      showStep(step - 1);
    });
  });

  // --- Submit -----------------------------------------------------------

  function readStoredUtm(): Record<string, string> | undefined {
    try {
      const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }

  async function uploadToSignedUrl(signedUrl: string, blob: Blob, mime: string): Promise<boolean> {
    if (signedUrl.startsWith("dry-run://")) return true;

    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", blob, `file.${mime === "application/pdf" ? "pdf" : "jpg"}`);

    const headers: Record<string, string> = {};
    if (PUBLIC_SUPABASE_ANON_KEY) {
      headers.apikey = PUBLIC_SUPABASE_ANON_KEY;
      headers.Authorization = `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`;
    }

    const res = await fetch(signedUrl, { method: "PUT", headers, body: form });
    return res.ok;
  }

  function setSubmitting(submitting: boolean) {
    if (!submitBtn) return;
    submitBtn.disabled = submitting;
    submitBtn.textContent = submitting ? "Submitting…" : "Submit application";
  }

  function setStatus(message: string, isError: boolean) {
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = isError ? "form-status error" : "form-status";
  }

  function currentStep(): number {
    return Number(steps.find((el) => el.dataset.active === "true")?.dataset.step ?? 1);
  }

  // Handles both the submit button and pressing Enter inside any field (implicit
  // form submission) — on earlier steps, Enter just means "Continue".
  root.addEventListener("submit", async (event) => {
    event.preventDefault();
    const step = currentStep();
    if (step < TOTAL_STEPS) {
      if (validateStep(step)) showStep(step + 1);
      return;
    }
    if (submitBtn?.disabled) return;
    setStatus("", false);

    const input = collectInput();
    const result = validateApplication(input, limits, repaymentTable);
    if (!result.valid) {
      const badStep = firstInvalidStep(result.errors) ?? 1;
      showStep(badStep);
      showErrors(result.errors);
      return;
    }
    const badDocStep = Object.keys(STEP_DOCUMENTS)
      .map(Number)
      .find((step) => !validateStepDocuments(step));
    if (badDocStep) {
      showStep(badDocStep);
      return;
    }

    const docRefs: { kind: DocumentKind; index: number; mime: string }[] = [];
    (Object.keys(documents) as DocumentKind[]).forEach((kind) => {
      documents[kind].forEach((doc, index) => {
        if (doc) docRefs.push({ kind, index, mime: doc.mime });
      });
    });

    setSubmitting(true);

    try {
      const createRes = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, documents: docRefs, utm: readStoredUtm() }),
      });
      const createData = await createRes.json();

      if (!createRes.ok || !createData.ok) {
        if (createData.errors) showErrors(createData.errors);
        setStatus(createData.errors?.generic ?? "Something went wrong. Please check your details and try again.", true);
        setSubmitting(false);
        return;
      }

      // Upload all documents in parallel — one at a time made submit crawl on mobile.
      const uploads = createData.uploads as { kind: DocumentKind; index: number; signedUrl: string }[];
      const uploadResults = await Promise.all(
        uploads.map((upload) => {
          const doc = documents[upload.kind][upload.index];
          return doc ? uploadToSignedUrl(upload.signedUrl, doc.blob, doc.mime) : true;
        }),
      );
      if (uploadResults.includes(false)) {
        setStatus("One of your documents failed to upload. Please try again.", true);
        setSubmitting(false);
        return;
      }

      const submitRes = await fetch(`/api/applications/${createData.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents: docRefs }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok || !submitData.ok) {
        // Show the server's reason — a generic "couldn't reach the server" here hid real errors before.
        setStatus(submitData.error ?? "Something went wrong. Please check your details and try again.", true);
        setSubmitting(false);
        return;
      }

      window.location.href = `/${COUNTRY_TO_MARKET[country]}/apply/success?ref=${encodeURIComponent(submitData.refCode ?? createData.refCode)}`;
    } catch {
      setStatus("We couldn't reach the server. Please check your connection and try again.", true);
      setSubmitting(false);
    }
  });

  showStep(1);
}
