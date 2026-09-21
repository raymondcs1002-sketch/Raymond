import { type CountryCode, type CountryRules, type IdType, findCallingCode, getCountryRules } from "./countries";
import { getTenureOptions, isValidRepaymentChoice, type RateSchedule } from "./repayment";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NAME_PATTERN = /^[A-Za-z\s.'-]+$/;

// --- Name -------------------------------------------------------------

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 80 && NAME_PATTERN.test(trimmed);
}

// --- Phone --------------------------------------------------------------

export interface NormalizedPhone {
  /** National number without the dial code, e.g. "123456789". */
  national: string;
  /** Full E.164 number, e.g. "+60123456789". */
  e164: string;
}

/**
 * Splits off the international prefix: either a leading "+" or the "00" people
 * dial for an outbound international call. Everything else is a local number.
 */
function splitInternationalPrefix(raw: string): { digits: string; international: boolean } {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (trimmed.startsWith("+")) return { digits, international: true };
  if (digits.startsWith("00")) return { digits: digits.slice(2), international: true };
  return { digits, international: false };
}

function normalizeLocal(digits: string, dialCode: string, pattern: RegExp): NormalizedPhone | null {
  let national = digits;
  if (national.startsWith(dialCode)) {
    national = national.slice(dialCode.length);
  } else if (national.startsWith("0")) {
    national = national.slice(1);
  }

  if (!pattern.test(national)) return null;
  return { national, e164: `+${dialCode}${national}` };
}

/** E.164 caps a full number at 15 digits; below 8 in total is no number we could dial. */
const E164_MAX_DIGITS = 15;
const E164_MIN_DIGITS = 8;
const MIN_NATIONAL_DIGITS = 4;

/**
 * An overseas number, already stripped of its "+" / "00". It has to start with
 * a real country calling code — that's what stops a number typed without one
 * (or with a made-up one) from being stored as something we can never call.
 *
 * @param allowTrunkZero A few countries (Italy most notably) keep the national
 *   trunk "0" after the country code, but only on landlines. For a mobile a
 *   leading zero means the caller pasted the local form behind the country
 *   code — "+62 0812…" — which would never connect.
 */
function normalizeInternational(digits: string, allowTrunkZero: boolean): NormalizedPhone | null {
  if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) return null;

  const callingCode = findCallingCode(digits);
  if (!callingCode) return null;

  const national = digits.slice(callingCode.length);
  if (national.length < MIN_NATIONAL_DIGITS) return null;
  if (!allowTrunkZero && national.startsWith("0")) return null;

  return { national, e164: `+${digits}` };
}

/** Accepts "+60123456789", "0123456789", or "123456789" style input. */
export function normalizePhone(raw: string, rules: Pick<CountryRules, "dialCode" | "phonePattern">): NormalizedPhone | null {
  return normalizeLocal(raw.replace(/[^0-9]/g, ""), rules.dialCode, rules.phonePattern);
}

/**
 * The applicant's own WhatsApp number. A local number still has to be a local
 * mobile, but the number may belong to any country when it's written in full
 * with a leading "+" (or "00") and its country code — a lot of applicants here
 * are on a foreign SIM and that is the number we'd actually reach them on.
 */
export function normalizeWhatsappPhone(
  raw: string,
  rules: Pick<CountryRules, "dialCode" | "phonePattern">,
): NormalizedPhone | null {
  const { digits, international } = splitInternationalPrefix(raw);
  if (international && !digits.startsWith(rules.dialCode)) return normalizeInternational(digits, false);
  return normalizeLocal(digits, rules.dialCode, rules.phonePattern);
}

/**
 * Like `normalizeWhatsappPhone`, for a third party's number (emergency contact,
 * next of kin, office): same overseas handling, but a local landline is fine
 * too — an office number rarely is a mobile.
 */
export function normalizeContactPhone(
  raw: string,
  rules: Pick<CountryRules, "dialCode" | "contactPhonePattern">,
): NormalizedPhone | null {
  const { digits, international } = splitInternationalPrefix(raw);
  if (international && !digits.startsWith(rules.dialCode)) return normalizeInternational(digits, true);
  return normalizeLocal(digits, rules.dialCode, rules.contactPhonePattern);
}

// --- Age ------------------------------------------------------------------

export function calculateAge(dobIso: string, atDate: Date = new Date()): number {
  const dob = new Date(`${dobIso}T00:00:00Z`);
  let age = atDate.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = atDate.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && atDate.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return age;
}

// --- Malaysia: MyKad --------------------------------------------------

function myKadDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function isValidMyKadFormat(value: string): boolean {
  const digits = myKadDigits(value);
  if (digits.length !== 12) return false;
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

/** Derives YYYY-MM-DD from the first 6 digits of a MyKad number, or null if malformed. */
export function deriveDobFromMyKad(value: string): string | null {
  const digits = myKadDigits(value);
  if (digits.length !== 12) return null;

  const yy = Number(digits.slice(0, 2));
  const mm = digits.slice(2, 4);
  const dd = digits.slice(4, 6);
  const currentYY = new Date().getFullYear() % 100;
  let year = (yy > currentYY ? 1900 : 2000) + yy;

  if (new Date(`${year}-${mm}-${dd}T00:00:00Z`).getTime() > Date.now()) {
    year -= 100;
  }

  return `${year}-${mm}-${dd}`;
}

// --- Singapore: NRIC/FIN checksum --------------------------------------

const NRIC_ST_TABLE = ["J", "Z", "I", "H", "G", "F", "E", "D", "C", "B", "A"];
const NRIC_FG_TABLE = ["X", "W", "U", "T", "R", "Q", "P", "N", "M", "L", "K"];
const NRIC_WEIGHTS = [2, 7, 6, 5, 4, 3, 2];

/**
 * Validates a Singapore NRIC/FIN, including its checksum letter.
 *
 * M-series FIN (introduced 2022) uses a different offset that isn't
 * publicly documented as reliably; for those we validate format only.
 */
export function isValidNricFin(value: string): boolean {
  const s = value.toUpperCase().trim();

  if (/^M\d{7}[A-Z]$/.test(s)) return true; // format-only for the newer M-series

  if (!/^[STFG]\d{7}[A-Z]$/.test(s)) return false;

  const prefix = s[0];
  const digits = s
    .slice(1, 8)
    .split("")
    .map(Number);
  const checkLetter = s[8];

  let sum = digits.reduce((acc, d, i) => acc + d * NRIC_WEIGHTS[i], 0);
  if (prefix === "T" || prefix === "G") sum += 4;

  const remainder = sum % 11;
  const table = prefix === "S" || prefix === "T" ? NRIC_ST_TABLE : NRIC_FG_TABLE;
  return table[remainder] === checkLetter;
}

/** Derives the ID type from a country and (already-uppercased) ID number. */
export function deriveIdType(country: CountryCode, idNumber: string): IdType {
  if (country === "my") return "mykad";
  return idNumber.trim().toUpperCase().startsWith("S") || idNumber.trim().toUpperCase().startsWith("T") ? "nric" : "fin";
}

// --- Residency status (SG) --------------------------------------------

export const RESIDENCY_STATUSES = ["singaporean", "pr", "work_permit", "s_pass", "employment_pass", "long_term_pass"] as const;
export type ResidencyStatus = (typeof RESIDENCY_STATUSES)[number];

/** The statuses that are a work pass — these carry an issue and expiry date; citizens and PRs don't. */
const PASS_STATUSES: readonly string[] = ["work_permit", "s_pass", "employment_pass", "long_term_pass"];

export function isPassStatus(value: string | null | undefined): boolean {
  return !!value && PASS_STATUSES.includes(value);
}

/**
 * Which name the two family contacts go by in this market. Both markets ask
 * for the same two people (name, relationship, phone, chat screenshot) — only
 * the wording and the columns they land in differ. Singapore used to collect
 * emergency contacts *and* next of kin, which meant filling the same family twice.
 */
export function usesNextOfKin(country: CountryCode): boolean {
  return country === "sg";
}

// --- Contacts & bank --------------------------------------------------

export const RELATIONSHIPS = ["parent", "spouse", "sibling", "child", "other_relative"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

const BANK_ACCOUNT_PATTERN = /^[0-9][0-9 -]*[0-9]$/;

export function isValidBankAccountNumber(value: string): boolean {
  const trimmed = value.trim();
  const digitCount = trimmed.replace(/[^0-9]/g, "").length;
  return BANK_ACCOUNT_PATTERN.test(trimmed) && digitCount >= 6 && digitCount <= 20;
}

// --- Full application -------------------------------------------------

export interface ApplicationInput {
  country: CountryCode;
  fullName: string;
  idNumber: string;
  dateOfBirth: string; // ISO yyyy-mm-dd
  whatsapp: string;
  email: string;
  employmentStatus: string;
  employerName: string;
  monthlyIncome: number;
  loanAmount: number;
  tenureMonths: number;
  purpose: string;
  /** Whether the applicant currently resides in the country they're applying in. `null` = not yet answered. */
  residesLocally: boolean | null;
  /** SG only — which status the applicant holds. `null`/absent = not yet answered. */
  residencyStatus?: ResidencyStatus | null;
  /** Work pass issue/expiry (ISO yyyy-mm-dd). Required when `residencyStatus` is a pass, null otherwise. */
  passIssueDate?: string | null;
  passExpiryDate?: string | null;
  /** MY only — the two family members we can reach. Ignored for SG (see `usesNextOfKin`). */
  emergencyContact1Name?: string;
  emergencyContact1Relationship?: string;
  emergencyContact1Phone?: string;
  emergencyContact2Name?: string;
  emergencyContact2Relationship?: string;
  emergencyContact2Phone?: string;
  /** Office, boss, manager or supervisor's number. */
  officePhone: string;
  bankName: string;
  bankAccountNumber: string;
  /** SG only (see `usesNextOfKin`) — the same two family members, ignored for MY. */
  nextOfKin1Name?: string;
  nextOfKin1Relationship?: string;
  nextOfKin1Phone?: string;
  nextOfKin2Name?: string;
  nextOfKin2Relationship?: string;
  nextOfKin2Phone?: string;
  consent: boolean;
  /** Hidden honeypot field — must be empty. */
  honeypot?: string;
}

export interface CountryLimits {
  loanMin: number;
  loanMax: number;
  tenureMinMonths: number;
  tenureMaxMonths: number;
  minAge: number;
  maxAge: number;
  minMonthlyIncome: number;
}

export type ApplicationErrors = Partial<Record<keyof ApplicationInput, string>>;

export interface ValidationResult {
  valid: boolean;
  errors: ApplicationErrors;
  normalized?: {
    whatsappE164: string;
    idNumber: string;
    officePhoneE164: string;
    /** null in a market that uses next of kin instead. */
    emergencyContactPhonesE164: [string, string] | null;
    /** null in a market that uses emergency contacts instead. */
    nextOfKinPhonesE164: [string, string] | null;
  };
}

/**
 * @param repaymentTable When given, `loanAmount`/`tenureMonths` must be an
 *   exact combination the table offers — this replaces the plain
 *   `loanMin`/`loanMax`/`tenureMinMonths`/`tenureMaxMonths` range check
 *   from `limits`. Omit for a market that doesn't have a table yet (falls
 *   back to the continuous range check).
 */
export function validateApplication(
  input: ApplicationInput,
  limits: CountryLimits,
  repaymentTable?: RateSchedule,
): ValidationResult {
  const rules = getCountryRules(input.country);
  const errors: ApplicationErrors = {};

  if (input.honeypot) {
    errors.honeypot = "Spam detected.";
  }

  if (!isValidName(input.fullName)) {
    errors.fullName = "Enter your full name as shown on your ID (letters only, 2–80 characters).";
  }

  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  const phone = normalizeWhatsappPhone(input.whatsapp, rules);
  if (!phone) {
    errors.whatsapp = `Enter a valid mobile number, e.g. ${rules.phoneExample} — for a number from another country, start with + and its country code.`;
  }

  const dobIso = input.dateOfBirth;
  const dobIsWellFormed = ISO_DATE_PATTERN.test(dobIso) && !Number.isNaN(new Date(`${dobIso}T00:00:00Z`).getTime());

  if (!dobIsWellFormed) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  }

  if (input.country === "my") {
    if (!isValidMyKadFormat(input.idNumber)) {
      errors.idNumber = `Enter a valid ${rules.idLabel}, e.g. ${rules.idExample}.`;
    } else if (dobIsWellFormed) {
      const derivedDob = deriveDobFromMyKad(input.idNumber);
      if (derivedDob && derivedDob !== dobIso) {
        errors.dateOfBirth = "Date of birth does not match your MyKad number.";
      }
    }
  } else {
    if (!isValidNricFin(input.idNumber)) {
      errors.idNumber = `Enter a valid ${rules.idLabel}, e.g. ${rules.idExample}.`;
    }
  }

  if (dobIsWellFormed && !errors.dateOfBirth) {
    const age = calculateAge(dobIso);
    if (age < limits.minAge || age > limits.maxAge) {
      errors.dateOfBirth = `You must be between ${limits.minAge} and ${limits.maxAge} years old to apply.`;
    }
  }

  if (!input.employmentStatus.trim()) {
    errors.employmentStatus = "Select your employment status.";
  }

  if (!input.employerName.trim() || input.employerName.trim().length > 120) {
    errors.employerName = "Enter your employer's name.";
  }

  if (!Number.isFinite(input.monthlyIncome) || input.monthlyIncome < limits.minMonthlyIncome) {
    errors.monthlyIncome = `Minimum monthly income to apply is ${limits.minMonthlyIncome}.`;
  }

  if (repaymentTable) {
    if (!Number.isFinite(input.loanAmount) || !getTenureOptions(repaymentTable, input.loanAmount).length) {
      errors.loanAmount = "Select a loan amount from the options shown.";
    } else if (!Number.isInteger(input.tenureMonths) || !isValidRepaymentChoice(repaymentTable, input.loanAmount, input.tenureMonths)) {
      errors.tenureMonths = "Select an available tenure for this loan amount.";
    }
  } else {
    if (!Number.isFinite(input.loanAmount) || input.loanAmount < limits.loanMin || input.loanAmount > limits.loanMax) {
      errors.loanAmount = `Loan amount must be between ${limits.loanMin} and ${limits.loanMax}.`;
    }

    if (
      !Number.isInteger(input.tenureMonths) ||
      input.tenureMonths < limits.tenureMinMonths ||
      input.tenureMonths > limits.tenureMaxMonths
    ) {
      errors.tenureMonths = `Tenure must be between ${limits.tenureMinMonths} and ${limits.tenureMaxMonths} months.`;
    }
  }

  if (!input.purpose.trim()) {
    errors.purpose = "Tell us the purpose of the loan.";
  }

  if (input.residesLocally === null) {
    errors.residesLocally = "Please let us know if you currently reside here.";
  } else if (input.residesLocally === false) {
    errors.residesLocally = "You must currently reside here to be eligible for this loan.";
  }

  if (input.country === "sg") {
    const status = input.residencyStatus;
    if (!status || !(RESIDENCY_STATUSES as readonly string[]).includes(status)) {
      errors.residencyStatus = "Select your residency status.";
    } else if (isPassStatus(status)) {
      const issue = input.passIssueDate ?? "";
      const expiry = input.passExpiryDate ?? "";
      const issueOk = ISO_DATE_PATTERN.test(issue) && !Number.isNaN(new Date(`${issue}T00:00:00Z`).getTime());
      const expiryOk = ISO_DATE_PATTERN.test(expiry) && !Number.isNaN(new Date(`${expiry}T00:00:00Z`).getTime());
      // ISO dates compare correctly as plain strings.
      const today = new Date().toISOString().slice(0, 10);

      if (!issueOk) {
        errors.passIssueDate = "Enter the date your pass was issued.";
      } else if (issue > today) {
        errors.passIssueDate = "Pass issue date cannot be in the future.";
      }

      if (!expiryOk) {
        errors.passExpiryDate = "Enter the date your pass expires.";
      } else if (expiry < today) {
        errors.passExpiryDate = "This pass has expired — we can only accept a pass that is still valid.";
      } else if (issueOk && expiry <= issue) {
        errors.passExpiryDate = "Pass expiry date must be after the issue date.";
      }
    }
  }

  const phoneError = `Enter a valid phone number, e.g. ${rules.phoneExample} — for a number from another country, start with + and its country code.`;
  const ownNumberError = "This must be someone else's number, not your own.";

  // One set of two family contacts, named for the market: "next of kin" in
  // Singapore, "emergency contact" in Malaysia.
  const kin = usesNextOfKin(input.country);
  const prefix = kin ? "nextOfKin" : "emergencyContact";
  const contactLabel = kin ? "next of kin" : "emergency contact";
  const contactPhones: string[] = [];

  for (const n of [1, 2] as const) {
    const nameKey = `${prefix}${n}Name` as keyof ApplicationInput;
    const relationshipKey = `${prefix}${n}Relationship` as keyof ApplicationInput;
    const phoneKey = `${prefix}${n}Phone` as keyof ApplicationInput;

    if (!isValidName((input[nameKey] as string | undefined) ?? "")) {
      errors[nameKey] = `Enter this ${contactLabel}'s full name (letters only).`;
    }
    if (!(RELATIONSHIPS as readonly string[]).includes((input[relationshipKey] as string | undefined) ?? "")) {
      errors[relationshipKey] = "Select how this person is related to you.";
    }
    const contactPhone = normalizeContactPhone((input[phoneKey] as string | undefined) ?? "", rules);
    if (!contactPhone) {
      errors[phoneKey] = phoneError;
    } else if (contactPhone.e164 === phone?.e164) {
      errors[phoneKey] = ownNumberError;
    } else if (contactPhones.includes(contactPhone.e164)) {
      errors[phoneKey] = `Enter a different number from your first ${contactLabel}.`;
    } else {
      contactPhones.push(contactPhone.e164);
    }
  }

  const officePhone = normalizeContactPhone(input.officePhone, rules);
  if (!officePhone) {
    errors.officePhone = phoneError;
  } else if (officePhone.e164 === phone?.e164) {
    errors.officePhone = "Enter your office or manager's number, not your own.";
  }

  if (!input.bankName.trim() || input.bankName.trim().length > 80) {
    errors.bankName = "Enter your bank's name.";
  }
  if (!isValidBankAccountNumber(input.bankAccountNumber)) {
    errors.bankAccountNumber = "Enter a valid bank account number (digits only).";
  }

  if (!input.consent) {
    errors.consent = "You must agree to the Terms and Privacy Policy to continue.";
  }

  const valid = Object.keys(errors).length === 0;

  return {
    valid,
    errors,
    normalized:
      valid && phone && officePhone
        ? {
            whatsappE164: phone.e164,
            idNumber: input.idNumber.toUpperCase().trim(),
            officePhoneE164: officePhone.e164,
            emergencyContactPhonesE164: kin ? null : (contactPhones as [string, string]),
            nextOfKinPhonesE164: kin ? (contactPhones as [string, string]) : null,
          }
        : undefined,
  };
}
