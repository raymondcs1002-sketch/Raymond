import { describe, expect, it } from "vitest";
import { estimateLoan } from "../src/lib/calc";

describe("estimateLoan", () => {
  it("computes flat monthly interest, fee, and instalment", () => {
    const result = estimateLoan({
      principal: 5000,
      tenureMonths: 6,
      interestRatePerMonth: 1.5,
      processingFeePercent: 2,
    });

    // Interest: 5000 * 1.5% * 6 = 450
    expect(result.totalInterest).toBe(450);
    // Fee: 5000 * 2% = 100
    expect(result.processingFee).toBe(100);
    // Total repayment: 5000 + 450 = 5450
    expect(result.totalRepayment).toBe(5450);
    // Instalment: 5450 / 6 = 908.33
    expect(result.monthlyInstalment).toBeCloseTo(908.33, 2);
    // Net disbursed: 5000 - 100 = 4900
    expect(result.netDisbursed).toBe(4900);
    // Effective annual rate: 1.5 * 12 = 18
    expect(result.effectiveAnnualRatePercent).toBe(18);
  });

  it("returns zeroed result for non-positive input", () => {
    expect(estimateLoan({ principal: 0, tenureMonths: 6, interestRatePerMonth: 1.5, processingFeePercent: 0 }).totalRepayment).toBe(0);
    expect(estimateLoan({ principal: 5000, tenureMonths: 0, interestRatePerMonth: 1.5, processingFeePercent: 0 }).monthlyInstalment).toBe(0);
  });

  it("handles zero interest and zero fee", () => {
    const result = estimateLoan({ principal: 2000, tenureMonths: 4, interestRatePerMonth: 0, processingFeePercent: 0 });
    expect(result.totalInterest).toBe(0);
    expect(result.processingFee).toBe(0);
    expect(result.totalRepayment).toBe(2000);
    expect(result.monthlyInstalment).toBe(500);
    expect(result.netDisbursed).toBe(2000);
  });
});
