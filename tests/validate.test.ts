import { describe, expect, it, vi } from "vitest";
import {
  calculateAge,
  deriveDobFromMyKad,
  isValidMyKadFormat,
  isValidName,
  isValidNricFin,
  normalizeContactPhone,
  normalizePhone,
  normalizeWhatsappPhone,
  validateApplication,
  type ApplicationInput,
  type CountryLimits,
} from "../src/lib/validate";
import { COUNTRY_RULES } from "../src/lib/countries";
import { SGD_RATE_SCHEDULE } from "../src/lib/repayment";

describe("isValidName", () => {
  it("accepts common name formats", () => {
    expect(isValidName("Tan Ah Kow")).toBe(true);
    expect(isValidName("Muhammad bin Ali")).toBe(true);
    expect(isValidName("O'Brien-Lee")).toBe(true);
  });

  it("rejects too short, too long, or non-letter input", () => {
    expect(isValidName("A")).toBe(false);
    expect(isValidName("a".repeat(81))).toBe(false);
    expect(isValidName("John123")).toBe(false);
    expect(isValidName("")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("normalizes Malaysian numbers in +60 / 0 / bare forms", () => {
    const rules = COUNTRY_RULES.my;
    expect(normalizePhone("+60123456789", rules)).toEqual({ national: "123456789", e164: "+60123456789" });
    expect(normalizePhone("0123456789", rules)).toEqual({ national: "123456789", e164: "+60123456789" });
    expect(normalizePhone("123456789", rules)).toEqual({ national: "123456789", e164: "+60123456789" });
    expect(normalizePhone("012 345 6789", rules)).toEqual({ national: "123456789", e164: "+60123456789" });
  });

  it("normalizes Singapore numbers in +65 / bare forms", () => {
    const rules = COUNTRY_RULES.sg;
    expect(normalizePhone("+6591234567", rules)).toEqual({ national: "91234567", e164: "+6591234567" });
    expect(normalizePhone("91234567", rules)).toEqual({ national: "91234567", e164: "+6591234567" });
  });

  it("rejects numbers that don't match the country pattern", () => {
    expect(normalizePhone("12345", COUNTRY_RULES.my)).toBeNull();
    expect(normalizePhone("71234567", COUNTRY_RULES.sg)).toBeNull(); // SG numbers must start with 8/9
  });
});

describe("normalizeWhatsappPhone", () => {
  it("still requires a local mobile when the number is written in local form", () => {
    expect(normalizeWhatsappPhone("9123 4567", COUNTRY_RULES.sg)?.e164).toBe("+6591234567");
    expect(normalizeWhatsappPhone("+65 9123 4567", COUNTRY_RULES.sg)?.e164).toBe("+6591234567");
    // A Singapore landline can't receive WhatsApp.
    expect(normalizeWhatsappPhone("6123 4567", COUNTRY_RULES.sg)).toBeNull();
  });

  it("accepts a number from any country when written with + and its country code", () => {
    expect(normalizeWhatsappPhone("+62 812 3456 7890", COUNTRY_RULES.sg)?.e164).toBe("+6281234567890");
    expect(normalizeWhatsappPhone("+880 1712 345678", COUNTRY_RULES.sg)?.e164).toBe("+8801712345678");
    expect(normalizeWhatsappPhone("+91 98765 43210", COUNTRY_RULES.my)?.e164).toBe("+919876543210");
    expect(normalizeWhatsappPhone("+1 415 555 0123", COUNTRY_RULES.sg)?.e164).toBe("+14155550123");
  });

  it("treats a leading 00 the same as a +", () => {
    expect(normalizeWhatsappPhone("0062 812 3456 7890", COUNTRY_RULES.sg)?.e164).toBe("+6281234567890");
  });

  it("rejects an overseas number whose country code doesn't exist", () => {
    expect(normalizeWhatsappPhone("+999 1234 5678", COUNTRY_RULES.sg)).toBeNull();
    expect(normalizeWhatsappPhone("+0812 3456 7890", COUNTRY_RULES.sg)).toBeNull();
  });

  it("rejects an overseas number that still carries its local trunk zero", () => {
    // "+62 0812…" is the Indonesian local form pasted behind the country code.
    expect(normalizeWhatsappPhone("+62 0812 3456 7890", COUNTRY_RULES.sg)).toBeNull();
  });

  it("rejects an overseas number written without the leading +", () => {
    expect(normalizeWhatsappPhone("62 812 3456 7890", COUNTRY_RULES.sg)).toBeNull();
  });
});

describe("normalizeContactPhone", () => {
  it("accepts local landlines as well as mobiles", () => {
    expect(normalizeContactPhone("6123 4567", COUNTRY_RULES.sg)?.e164).toBe("+6561234567");
    expect(normalizeContactPhone("+65 9123 4567", COUNTRY_RULES.sg)?.e164).toBe("+6591234567");
    expect(normalizeContactPhone("03-1234 5678", COUNTRY_RULES.my)?.e164).toBe("+60312345678");
  });

  it("accepts overseas numbers only when written with a leading +", () => {
    expect(normalizeContactPhone("+62 812 3456 7890", COUNTRY_RULES.sg)?.e164).toBe("+6281234567890");
    expect(normalizeContactPhone("0812 3456 7890", COUNTRY_RULES.sg)).toBeNull();
  });

  it("rejects malformed numbers", () => {
    expect(normalizeContactPhone("7123 4567", COUNTRY_RULES.sg)).toBeNull();
    expect(normalizeContactPhone("+123", COUNTRY_RULES.sg)).toBeNull();
    expect(normalizeContactPhone("+999 1234 5678", COUNTRY_RULES.sg)).toBeNull(); // no such country code
  });

  it("keeps the trunk zero an overseas landline may legitimately carry", () => {
    // Italian landlines keep the leading 0 after +39; a mobile never does.
    expect(normalizeContactPhone("+39 06 1234 5678", COUNTRY_RULES.sg)?.e164).toBe("+390612345678");
  });
});

describe("calculateAge", () => {
  it("computes age relative to a fixed date", () => {
    expect(calculateAge("2000-01-01", new Date("2026-01-01T00:00:00Z"))).toBe(26);
    expect(calculateAge("2000-06-15", new Date("2026-01-01T00:00:00Z"))).toBe(25); // birthday not yet reached
    expect(calculateAge("2000-01-01", new Date("2025-12-31T00:00:00Z"))).toBe(25);
  });
});

describe("MyKad", () => {
  it("validates format (12 digits, sane month/day)", () => {
    expect(isValidMyKadFormat("900515-14-5678")).toBe(true);
    expect(isValidMyKadFormat("900515145678")).toBe(true);
    expect(isValidMyKadFormat("901315-14-5678")).toBe(false); // month 13
    expect(isValidMyKadFormat("900532-14-5678")).toBe(false); // day 32
    expect(isValidMyKadFormat("12345")).toBe(false);
  });

  it("derives date of birth using a rolling century heuristic", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));

    expect(deriveDobFromMyKad("900515-14-5678")).toBe("1990-05-15"); // 90 > 26 -> 1900s
    expect(deriveDobFromMyKad("050101-14-5678")).toBe("2005-01-01"); // 05 <= 26 -> 2000s
    // 2026-12-01 would be in the future relative to "today", so it must roll back to 1926.
    expect(deriveDobFromMyKad("261201123456")).toBe("1926-12-01");

    vi.useRealTimers();
  });
});

describe("Singapore NRIC/FIN checksum", () => {
  it("accepts valid checksums for each prefix", () => {
    expect(isValidNricFin("S1234567D")).toBe(true);
    expect(isValidNricFin("T1234567J")).toBe(true);
    expect(isValidNricFin("F1234567N")).toBe(true);
    expect(isValidNricFin("G1234567X")).toBe(true);
    expect(isValidNricFin("s1234567d")).toBe(true); // case-insensitive
  });

  it("rejects an incorrect checksum letter", () => {
    expect(isValidNricFin("S1234567A")).toBe(false);
    expect(isValidNricFin("T1234567A")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidNricFin("S123456D")).toBe(false); // too short
    expect(isValidNricFin("A1234567D")).toBe(false); // bad prefix
  });

  it("accepts M-series FIN by format only", () => {
    expect(isValidNricFin("M1234567K")).toBe(true);
  });
});

/**
 * Singapore names the same two family contacts "next of kin" — it has no
 * emergency contact fields at all, so the Malaysian ones are blanked out.
 */
const SG_CONTACTS = {
  emergencyContact1Name: "",
  emergencyContact1Relationship: "",
  emergencyContact1Phone: "",
  emergencyContact2Name: "",
  emergencyContact2Relationship: "",
  emergencyContact2Phone: "",
  officePhone: "6123 4567",
  nextOfKin1Name: "Lim Ah Huat",
  nextOfKin1Relationship: "parent",
  nextOfKin1Phone: "91230002",
  nextOfKin2Name: "Lim Siew Lan",
  nextOfKin2Relationship: "sibling",
  nextOfKin2Phone: "61230003",
};

describe("validateApplication", () => {
  const myLimits: CountryLimits = {
    loanMin: 1000,
    loanMax: 10000,
    tenureMinMonths: 1,
    tenureMaxMonths: 12,
    minAge: 21,
    maxAge: 60,
    minMonthlyIncome: 2000,
  };

  function baseInput(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
    return {
      country: "my",
      fullName: "Tan Ah Kow",
      idNumber: "900515-14-5678",
      dateOfBirth: "1990-05-15",
      whatsapp: "+60123456789",
      email: "tan@example.com",
      employmentStatus: "employed",
      employerName: "Acme Sdn Bhd",
      monthlyIncome: 3000,
      loanAmount: 5000,
      tenureMonths: 6,
      purpose: "Medical expenses",
      residesLocally: true,
      emergencyContact1Name: "Tan Mei Ling",
      emergencyContact1Relationship: "spouse",
      emergencyContact1Phone: "0123456780",
      emergencyContact2Name: "Tan Ah Beng",
      emergencyContact2Relationship: "sibling",
      emergencyContact2Phone: "0123456781",
      officePhone: "03-1234 5678",
      bankName: "Maybank",
      bankAccountNumber: "5140 1234 5678",
      consent: true,
      honeypot: "",
      ...overrides,
    };
  }

  it("passes for a fully valid Malaysian application", () => {
    const result = validateApplication(baseInput(), myLimits);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.normalized).toEqual({
      whatsappE164: "+60123456789",
      idNumber: "900515-14-5678",
      officePhoneE164: "+60312345678",
      emergencyContactPhonesE164: ["+60123456780", "+60123456781"],
      nextOfKinPhonesE164: null,
    });
  });

  it("flags a honeypot fill as spam", () => {
    const result = validateApplication(baseInput({ honeypot: "bot-filled-this" }), myLimits);
    expect(result.valid).toBe(false);
    expect(result.errors.honeypot).toBeDefined();
  });

  it("flags an unanswered residency question", () => {
    const result = validateApplication(baseInput({ residesLocally: null }), myLimits);
    expect(result.valid).toBe(false);
    expect(result.errors.residesLocally).toBeDefined();
  });

  it("flags residesLocally=false as ineligible", () => {
    const result = validateApplication(baseInput({ residesLocally: false }), myLimits);
    expect(result.valid).toBe(false);
    expect(result.errors.residesLocally).toBeDefined();
  });

  it("flags a MyKad/DOB mismatch", () => {
    const result = validateApplication(baseInput({ dateOfBirth: "1991-01-01" }), myLimits);
    expect(result.valid).toBe(false);
    expect(result.errors.dateOfBirth).toMatch(/does not match/);
  });

  it("flags age outside allowed range", () => {
    // 900515 -> 1990, but with maxAge 21 this is too old at any recent "now".
    const result = validateApplication(baseInput(), { ...myLimits, maxAge: 21 });
    expect(result.valid).toBe(false);
    expect(result.errors.dateOfBirth).toMatch(/between/);
  });

  it("flags loan amount outside the configured range", () => {
    const result = validateApplication(baseInput({ loanAmount: 50000 }), myLimits);
    expect(result.valid).toBe(false);
    expect(result.errors.loanAmount).toBeDefined();
  });

  it("flags an invalid mobile number", () => {
    const result = validateApplication(baseInput({ whatsapp: "12345" }), myLimits);
    expect(result.valid).toBe(false);
    expect(result.errors.whatsapp).toBeDefined();
  });

  it("validates Singapore NRIC and phone format", () => {
    const sgLimits: CountryLimits = { ...myLimits, loanMin: 500, loanMax: 5000 };
    const result = validateApplication(
      baseInput({
        country: "sg",
        idNumber: "S1234567D",
        whatsapp: "+6591234567", ...SG_CONTACTS,
        loanAmount: 2000,
        residencyStatus: "singaporean",
      }),
      sgLimits,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects an invalid Singapore NRIC checksum", () => {
    const sgLimits: CountryLimits = { ...myLimits, loanMin: 500, loanMax: 5000 };
    const result = validateApplication(
      baseInput({ country: "sg", idNumber: "S1234567A", whatsapp: "+6591234567", ...SG_CONTACTS, loanAmount: 2000, residencyStatus: "singaporean" }),
      sgLimits,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.idNumber).toBeDefined();
  });

  describe("with a repayment table", () => {
    const sgLimits: CountryLimits = { ...myLimits, loanMin: 500, loanMax: 5000 };

    function sgInput(overrides: Partial<ApplicationInput> = {}) {
      return baseInput({
        country: "sg",
        idNumber: "S1234567D",
        whatsapp: "+6591234567", ...SG_CONTACTS,
        loanAmount: 5000,
        tenureMonths: 24,
        residencyStatus: "singaporean",
        ...overrides,
      });
    }

    it("accepts an exact amount+tenure combination from the table", () => {
      const result = validateApplication(sgInput(), sgLimits, SGD_RATE_SCHEDULE);
      expect(result.valid).toBe(true);
    });

    it("rejects a tenure not offered for that amount, even if it's within min/max range", () => {
      // $1,000 only offers 8/12/24 months on the table — 36 isn't one of them.
      const result = validateApplication(sgInput({ loanAmount: 1000, tenureMonths: 36 }), sgLimits, SGD_RATE_SCHEDULE);
      expect(result.valid).toBe(false);
      expect(result.errors.tenureMonths).toBeDefined();
    });

    it("accepts an amount that falls between the originally-listed table amounts (band-based, not a fixed list)", () => {
      // 1234 was never a literal amount in the source table, but the <$10,000 band covers it.
      const result = validateApplication(sgInput({ loanAmount: 1234, tenureMonths: 12 }), sgLimits, SGD_RATE_SCHEDULE);
      expect(result.valid).toBe(true);
    });

    it("rejects an amount below every band", () => {
      const result = validateApplication(sgInput({ loanAmount: 500, tenureMonths: 12 }), sgLimits, SGD_RATE_SCHEDULE);
      expect(result.valid).toBe(false);
      expect(result.errors.loanAmount).toBeDefined();
    });

    it("falls back to plain min/max limits when no table is given", () => {
      // 600 is below every band (schedule min is 1000) but within sgLimits' 500-5000 range,
      // proving the fallback path is independent of the schedule check.
      const result = validateApplication(sgInput({ loanAmount: 600, tenureMonths: 6 }), sgLimits);
      expect(result.errors.loanAmount).toBeUndefined();
      expect(result.errors.tenureMonths).toBeUndefined();
    });
  });

  describe("Singapore residency status", () => {
    const sgLimits: CountryLimits = { ...myLimits, loanMin: 500, loanMax: 5000 };
    const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

    function sgStatusInput(overrides: Partial<ApplicationInput> = {}) {
      return baseInput({ country: "sg", idNumber: "S1234567D", whatsapp: "+6591234567", ...SG_CONTACTS, loanAmount: 2000, ...overrides });
    }

    it("requires a residency status on Singapore applications", () => {
      const result = validateApplication(sgStatusInput(), sgLimits);
      expect(result.valid).toBe(false);
      expect(result.errors.residencyStatus).toBeDefined();
    });

    it("accepts a citizen or PR without any pass dates", () => {
      expect(validateApplication(sgStatusInput({ residencyStatus: "singaporean" }), sgLimits).valid).toBe(true);
      expect(validateApplication(sgStatusInput({ residencyStatus: "pr" }), sgLimits).valid).toBe(true);
    });

    it("requires both pass dates from a work pass holder", () => {
      const result = validateApplication(sgStatusInput({ residencyStatus: "employment_pass" }), sgLimits);
      expect(result.valid).toBe(false);
      expect(result.errors.passIssueDate).toBeDefined();
      expect(result.errors.passExpiryDate).toBeDefined();
    });

    it("accepts a work pass holder with a still-valid pass", () => {
      const result = validateApplication(
        sgStatusInput({ residencyStatus: "s_pass", passIssueDate: daysFromNow(-365), passExpiryDate: daysFromNow(365) }),
        sgLimits,
      );
      expect(result.valid).toBe(true);
    });

    it("rejects a pass that has already expired", () => {
      const result = validateApplication(
        sgStatusInput({ residencyStatus: "work_permit", passIssueDate: daysFromNow(-730), passExpiryDate: daysFromNow(-1) }),
        sgLimits,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.passExpiryDate).toMatch(/expired/);
    });

    it("rejects an issue date in the future", () => {
      const result = validateApplication(
        sgStatusInput({ residencyStatus: "long_term_pass", passIssueDate: daysFromNow(10), passExpiryDate: daysFromNow(365) }),
        sgLimits,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.passIssueDate).toMatch(/future/);
    });

    it("requires next of kin from every Singapore applicant, pass holders included", () => {
      const noKin = {
        nextOfKin1Name: "",
        nextOfKin1Relationship: "",
        nextOfKin1Phone: "",
        nextOfKin2Name: "",
        nextOfKin2Relationship: "",
        nextOfKin2Phone: "",
      };
      const kinErrors = [
        "nextOfKin1Name",
        "nextOfKin1Phone",
        "nextOfKin1Relationship",
        "nextOfKin2Name",
        "nextOfKin2Phone",
        "nextOfKin2Relationship",
      ];

      const citizen = validateApplication(sgStatusInput({ residencyStatus: "pr", ...noKin }), sgLimits);
      expect(citizen.valid).toBe(false);
      expect(Object.keys(citizen.errors).sort()).toEqual(kinErrors);

      const passHolder = validateApplication(
        sgStatusInput({ residencyStatus: "s_pass", passIssueDate: daysFromNow(-365), passExpiryDate: daysFromNow(365), ...noKin }),
        sgLimits,
      );
      expect(passHolder.valid).toBe(false);
      expect(Object.keys(passHolder.errors).sort()).toEqual(kinErrors);
    });

    it("stores Singapore contacts as next of kin only, never as emergency contacts", () => {
      const result = validateApplication(sgStatusInput({ residencyStatus: "singaporean" }), sgLimits);
      expect(result.valid).toBe(true);
      expect(result.normalized?.nextOfKinPhonesE164).toEqual(["+6591230002", "+6561230003"]);
      expect(result.normalized?.emergencyContactPhonesE164).toBeNull();
    });

    it("leaves Malaysian applications untouched by the residency rules", () => {
      const result = validateApplication(baseInput(), myLimits);
      expect(result.valid).toBe(true);
      expect(result.errors.residencyStatus).toBeUndefined();
    });
  });

  describe("contacts and bank", () => {
    it("requires both emergency contacts in full", () => {
      const result = validateApplication(
        baseInput({ emergencyContact2Name: "", emergencyContact2Relationship: "", emergencyContact2Phone: "" }),
        myLimits,
      );
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors).sort()).toEqual([
        "emergencyContact2Name",
        "emergencyContact2Phone",
        "emergencyContact2Relationship",
      ]);
    });

    it("rejects an emergency contact using the applicant's own number", () => {
      const result = validateApplication(baseInput({ emergencyContact1Phone: "+60 12-345 6789" }), myLimits);
      expect(result.errors.emergencyContact1Phone).toMatch(/not your own/);
    });

    it("rejects two emergency contacts with the same number", () => {
      const result = validateApplication(baseInput({ emergencyContact2Phone: "+60123456780" }), myLimits);
      expect(result.errors.emergencyContact2Phone).toMatch(/different number/);
    });

    it("rejects an unknown relationship", () => {
      const result = validateApplication(baseInput({ emergencyContact1Relationship: "friend" }), myLimits);
      expect(result.errors.emergencyContact1Relationship).toBeDefined();
    });

    it("requires office phone, bank name, and a plausible account number", () => {
      const result = validateApplication(baseInput({ officePhone: "", bankName: " ", bankAccountNumber: "12AB" }), myLimits);
      expect(Object.keys(result.errors).sort()).toEqual(["bankAccountNumber", "bankName", "officePhone"]);
    });
  });
});
