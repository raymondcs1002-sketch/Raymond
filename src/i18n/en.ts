/**
 * All UI copy lives here so an additional locale (Bahasa Melayu, Chinese)
 * can be added later as a sibling file (`ms.ts`, `zh.ts`) without hunting
 * through components. Business content (loan limits, rates, entity names,
 * contact details) is NOT here — that comes from Edge Config, see
 * `src/lib/config.ts`.
 */
export const en = {
  nav: {
    home: "Home",
    howItWorks: "How it works",
    calculator: "Calculator",
    about: "About",
    contact: "Contact",
    apply: "Apply for Loan",
  },

  // NOTE: "Best"/"trusted" wording here is a superlative advertising claim.
  // Singapore's Moneylenders Rules restrict what licensed moneylenders may
  // say in ads — get this signed off by counsel before launch, same as the
  // other DRAFT-marked legal content. See PLAN.md compliance notes.
  trust: {
    badge: "Best Personal Money Lender",
  },

  hero: {
    eyebrow: "Fast, straightforward personal loans",
    title: "Your future buddy, start today",
    subtitle:
      "Check your eligibility in minutes and get a straightforward loan offer — no paperwork runaround, no confusing terms.",
    cta: "Apply for Loan",
    secondaryCta: "See how it works",
  },

  features: [
    { title: "No paperwork", desc: "Apply online in minutes from your phone — no branch visits, no printing." },
    { title: "No confusion", desc: "Clear loan amount, fees, and repayment terms shown upfront before you apply." },
    { title: "Fast response", desc: "Our team reviews your application and reaches out on WhatsApp." },
  ],

  product: {
    title: "Personal Loan",
    amountLabel: "Loan amount",
    tenureLabel: "Repayment tenure",
    rateLabel: "Rate range",
    ageLabel: "Eligible age",
    incomeLabel: "Minimum monthly income",
    approvalLabel: "Typical response time",
    cta: "Apply for Loan",
    noHiddenFees: "No hidden fees. No early repayment penalty.",
  },

  howToApply: {
    title: "How to apply",
    steps: [
      { title: "Fill in the form", desc: "Tell us about yourself, your income, and how much you'd like to borrow." },
      { title: "Upload your documents", desc: "A photo of your ID and a recent payslip — that's it." },
      { title: "We review your application", desc: "Our team checks your eligibility and application details." },
      { title: "We contact you on WhatsApp", desc: "We'll reach out with next steps, or ask for anything else we need." },
    ],
  },

  responsibleLending: {
    title: "Responsible lending",
    pillars: [
      { title: "Financial stability first", desc: "We only offer amounts and terms suited to your income, not the maximum you might qualify for." },
      { title: "Ongoing support", desc: "Questions about your application or repayment? Reach us anytime on WhatsApp or email." },
      { title: "Transparent terms", desc: "Interest, fees, and repayment amounts are shown before you apply — no surprises later." },
    ],
  },

  eligibility: {
    title: "Eligibility criteria",
  },

  documents: {
    title: "Documents required",
    items: [
      "A clear photo of the front of your ID",
      "A clear photo of the back of your ID",
      "A selfie for identity verification",
      "A proof of address (utility bill, bank statement, or tenancy agreement)",
      "Your latest payslip(s) or proof of income",
    ],
  },

  riskDisclosure: {
    title: "Important information",
    body:
      "This is a lending product with interest. Only borrow what you can comfortably repay. Late or missed repayments may affect your ability to borrow in future and may incur additional charges as disclosed in your loan agreement.",
  },

  calculator: {
    title: "Calculate your repayment",
    subtitle: "Pick a loan amount to see the exact tenures and monthly instalment on offer.",
    amountLabel: "Loan amount",
    tenureLabel: "Tenure",
    months: "months",
    totalInterest: "Total interest",
    totalRepayment: "Total repayment",
    monthlyInstalment: "Monthly instalment",
    estimateNote: "Subject to approval.",
  },

  faq: {
    title: "Frequently asked questions",
    items: [
      {
        q: "How long does approval take?",
        a: "Most applications are reviewed quickly once your documents are complete. Our team will message you on WhatsApp with a decision or if we need anything else.",
      },
      {
        q: "Will applying affect my credit score?",
        a: "We'll let you know upfront if any checks we run could affect your credit score before we proceed.",
      },
      {
        q: "Can I repay my loan early?",
        a: "Yes — there's no early repayment penalty. Contact us on WhatsApp to arrange an early settlement.",
      },
      {
        q: "What happens after I submit my application?",
        a: "We review your details and documents, then reach out on WhatsApp with a decision or to request anything else we need.",
      },
    ],
  },

  contact: {
    title: "Get in touch",
    whatsappCta: "Chat on WhatsApp",
    emailLabel: "Email us",
    addressLabel: "Office address",
  },

  currencySwitcher: {
    label: "Currency",
  },

  footer: {
    providedBy: "Loans are provided by",
    managedByNotice: "Transactions and credit products are managed and provided by the referenced entity.",
    quickLinks: "Quick links",
    legal: "Legal",
    privacy: "Privacy Policy",
    terms: "Terms & Conditions",
    disclaimer: "Disclaimer",
  },

  apply: {
    title: "Loan application",
    stepLabel: "Step",
    of: "of",
    steps: {
      loan: {
        title: "Loan details",
        purposeLabel: "What is this loan for?",
        purposePlaceholder: "e.g. Medical expenses, education, home repairs",
      },
      personal: {
        title: "Personal details",
        fullNameLabel: "Full name (as per ID)",
        idNumberLabel: "ID number",
        dobLabel: "Date of birth",
        whatsappLabel: "WhatsApp number",
        whatsappHint: "This is where we'll contact you. Using a number from another country? Enter it in full, starting with + and its country code.",
        emailLabel: "Email address",
        residesLocallyLabel: "Do you currently reside here?",
        residesLocallyYes: "Yes",
        residesLocallyNo: "No",
        idNumberLabelSg: "NRIC / FIN Number",
        residencyStatusLabel: "Residency status",
        residencyStatusOptions: [
          { value: "singaporean", label: "Singaporean" },
          { value: "pr", label: "Permanent Resident" },
          { value: "work_permit", label: "Work Permit" },
          { value: "s_pass", label: "S Pass" },
          { value: "employment_pass", label: "Employment Pass" },
          { value: "long_term_pass", label: "Long Term Pass" },
        ],
        passIssueDateLabel: "Pass date of issue",
        passExpiryDateLabel: "Pass date of expiry",
        emergencyTitle: "Emergency contacts",
        emergencyHint: "Two family members we can reach. Both are required.",
        emergencyContactHeading: "Emergency contact",
        // Singapore asks for the same two people as "next of kin" instead —
        // one section only, so nobody fills the same family twice.
        nextOfKinTitle: "Next of kin",
        nextOfKinHint: "Two next of kin we can reach. Both are required.",
        nextOfKinHeading: "Next of kin",
        contactNameLabel: "Full name",
        relationshipLabel: "Relationship to you",
        relationshipOptions: [
          { value: "parent", label: "Parent" },
          { value: "spouse", label: "Spouse" },
          { value: "sibling", label: "Sibling" },
          { value: "child", label: "Child" },
          { value: "other_relative", label: "Other relative" },
        ],
        contactPhoneLabel: "Phone number",
        contactProofLabel: "Screenshot of your chat with this contact",
        contactProofHint: "A WhatsApp or SMS conversation with this person, showing their number.",
      },
      employment: {
        title: "Employment details",
        statusLabel: "Employment status",
        statusOptions: ["Employed (full-time)", "Employed (part-time)", "Self-employed", "Other"],
        employerLabel: "Employer name",
        incomeLabel: "Monthly income",
        officePhoneLabel: "Office / Boss / Manager / Supervisor phone number",
        bankNameLabel: "Bank name",
        bankAccountNumberLabel: "Bank account number",
      },
      documents: {
        title: "Upload documents",
        idFrontLabel: "ID — front",
        idBackLabel: "ID — back",
        idFrontLabelWorkPass: "Work Pass — front",
        idBackLabelWorkPass: "Work Pass — back",
        idFrontHintWorkPass: "A clear photo of the front of your valid Employment Pass, S Pass, or Work Permit.",
        idBackHintWorkPass: "A clear photo of the back of your valid Employment Pass, S Pass, or Work Permit.",
        selfieLabel: "Selfie",
        addressProofLabel: "Proof of address",
        payslipLabel: "Payslip / proof of income",
        addAnother: "Add another file",
        uploading: "Uploading…",
        uploaded: "Uploaded",
      },
      review: {
        title: "Review & submit",
        consentLabel: "I agree to the Privacy Policy and Terms & Conditions, and consent to the collection and use of my personal data for this application.",
        submit: "Submit application",
        submitting: "Submitting…",
      },
    },
    buttons: {
      next: "Continue",
      back: "Back",
    },
    errors: {
      generic: "Something went wrong. Please check your details and try again.",
      network: "We couldn't reach the server. Please check your connection and try again.",
    },
  },

  success: {
    title: "Application received",
    message: "Thanks — we've received your application. Our team will contact you on WhatsApp within",
    refLabel: "Your reference number",
    whatsappCta: "Chat on WhatsApp",
    backHome: "Back to home",
  },

  legal: {
    draftNotice: "This is a draft policy pending legal review.",
  },
} as const;

export type I18n = typeof en;
