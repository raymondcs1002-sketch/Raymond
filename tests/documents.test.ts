import { describe, expect, it } from "vitest";
import { parseDocumentRefs, validateDocumentSet, type DocumentRef } from "../src/lib/documents";

const jpg = "image/jpeg";

function fullSet(overrides: DocumentRef[] = []): DocumentRef[] {
  return [
    { kind: "id_front", index: 0, mime: jpg },
    { kind: "id_back", index: 0, mime: jpg },
    { kind: "selfie", index: 0, mime: jpg },
    { kind: "address_proof", index: 0, mime: jpg },
    { kind: "emergency_proof", index: 0, mime: jpg },
    { kind: "emergency_proof", index: 1, mime: jpg },
    { kind: "payslip", index: 0, mime: "application/pdf" },
    ...overrides,
  ];
}

describe("parseDocumentRefs", () => {
  it("keeps every known kind, including address proof and emergency screenshots", () => {
    // Regression: the submit endpoint used to drop address_proof, so no application could ever be submitted.
    expect(parseDocumentRefs(fullSet())).toEqual(fullSet());
  });

  it("drops malformed or unknown entries", () => {
    expect(parseDocumentRefs([{ kind: "passport", index: 0, mime: jpg }, { kind: "selfie", index: "0", mime: jpg }, null])).toEqual([]);
    expect(parseDocumentRefs("nope")).toEqual([]);
  });
});

describe("validateDocumentSet", () => {
  it("accepts a complete set", () => {
    expect(validateDocumentSet(fullSet())).toBeNull();
    expect(validateDocumentSet(fullSet([{ kind: "payslip", index: 2, mime: jpg }]))).toBeNull();
  });

  it("requires both emergency contact screenshots", () => {
    const docs = fullSet().filter((d) => !(d.kind === "emergency_proof" && d.index === 1));
    expect(validateDocumentSet(docs)).toMatch(/contact chat screenshot/);
  });

  it("rejects duplicate or out-of-range indices", () => {
    const docs = fullSet().map((d) => (d.kind === "emergency_proof" ? { ...d, index: 0 } : d));
    expect(validateDocumentSet(docs)).toMatch(/Invalid contact chat screenshot/);
    expect(validateDocumentSet(fullSet([{ kind: "payslip", index: 3, mime: jpg }]))).toMatch(/Invalid payslip/);
  });

  it("only allows PDFs for payslips", () => {
    const docs = fullSet().map((d) => (d.kind === "emergency_proof" ? { ...d, mime: "application/pdf" } : d));
    expect(validateDocumentSet(docs)).toMatch(/Invalid file type/);
  });
});
