/**
 * Loan repayment estimate.
 *
 * Uses a flat monthly interest rate applied to the original principal
 * (common for short-tenure moneylender-style products in MY/SG), plus a
 * one-off processing fee deducted from disbursal. This is an ESTIMATE for
 * display only — actual approved terms are confirmed by the team.
 */

export interface EstimateInput {
  principal: number;
  tenureMonths: number;
  interestRatePerMonth: number; // e.g. 1.5 means 1.5% per month
  processingFeePercent: number; // e.g. 2 means 2% of principal
}

export interface EstimateResult {
  principal: number;
  tenureMonths: number;
  totalInterest: number;
  processingFee: number;
  totalRepayment: number;
  monthlyInstalment: number;
  netDisbursed: number;
  /** Simple annualised rate for disclosure purposes, not a regulatory APR. */
  effectiveAnnualRatePercent: number;
}

export function estimateLoan(input: EstimateInput): EstimateResult {
  const { principal, tenureMonths, interestRatePerMonth, processingFeePercent } = input;

  if (principal <= 0 || tenureMonths <= 0) {
    return {
      principal: 0,
      tenureMonths: 0,
      totalInterest: 0,
      processingFee: 0,
      totalRepayment: 0,
      monthlyInstalment: 0,
      netDisbursed: 0,
      effectiveAnnualRatePercent: 0,
    };
  }

  const totalInterest = round2(principal * (interestRatePerMonth / 100) * tenureMonths);
  const processingFee = round2(principal * (processingFeePercent / 100));
  const totalRepayment = round2(principal + totalInterest);
  const monthlyInstalment = round2(totalRepayment / tenureMonths);
  const netDisbursed = round2(principal - processingFee);
  const effectiveAnnualRatePercent = round2(interestRatePerMonth * 12);

  return {
    principal,
    tenureMonths,
    totalInterest,
    processingFee,
    totalRepayment,
    monthlyInstalment,
    netDisbursed,
    effectiveAnnualRatePercent,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
