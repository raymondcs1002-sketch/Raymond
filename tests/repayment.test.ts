import { describe, expect, it } from "vitest";
import {
  computeInstalment,
  getBand,
  getMinMaxAmount,
  getMinMaxRate,
  getMinMaxTenure,
  getOption,
  getTenureOptions,
  isValidRepaymentChoice,
  summarize,
  SGD_RATE_SCHEDULE,
  type RateSchedule,
} from "../src/lib/repayment";

describe("SGD_RATE_SCHEDULE", () => {
  it("uses the corrected $2,500 / 8-month instalment (375, not the source sheet's 345)", () => {
    const option = getOption(SGD_RATE_SCHEDULE, 2500, 8);
    expect(option?.monthlyInstalment).toBe(375);
  });

  it("reproduces every other original table value exactly via the flat-rate formula", () => {
    // Spot-check across every band, mirroring the source rate card.
    expect(getOption(SGD_RATE_SCHEDULE, 1000, 12)?.monthlyInstalment).toBe(105);
    expect(getOption(SGD_RATE_SCHEDULE, 5000, 24)?.monthlyInstalment).toBe(282);
    expect(getOption(SGD_RATE_SCHEDULE, 10000, 48)?.monthlyInstalment).toBe(303);
    expect(getOption(SGD_RATE_SCHEDULE, 15000, 60)?.monthlyInstalment).toBe(375);
    expect(getOption(SGD_RATE_SCHEDULE, 20000, 24)?.monthlyInstalment).toBe(1125);
  });

  it("only offers the tenures that band actually groups together", () => {
    expect(getTenureOptions(SGD_RATE_SCHEDULE, 1000).map((o) => o.tenureMonths)).toEqual([8, 12, 24]);
    expect(getTenureOptions(SGD_RATE_SCHEDULE, 10000).map((o) => o.tenureMonths)).toEqual([12, 24, 36, 48]);
    expect(getTenureOptions(SGD_RATE_SCHEDULE, 15000).map((o) => o.tenureMonths)).toEqual([12, 24, 36, 48, 60]);
    expect(getTenureOptions(SGD_RATE_SCHEDULE, 25000).map((o) => o.tenureMonths)).toEqual([24, 36, 48, 60]);
  });

  it("covers the new $30,000 tier (extended beyond the source table's $25,000 max)", () => {
    const options = getTenureOptions(SGD_RATE_SCHEDULE, 30000);
    expect(options.map((o) => o.tenureMonths)).toEqual([24, 36, 48, 60]);
    expect(options.map((o) => o.monthlyInstalment)).toEqual([1688, 1167, 907, 750]);
  });

  it("covers any amount in between the originally-listed ones, not just those exact figures", () => {
    // $7,000 was never in the source table, but falls in the <$10,000 band.
    const options = getTenureOptions(SGD_RATE_SCHEDULE, 7000);
    expect(options.map((o) => o.tenureMonths)).toEqual([8, 12, 24]);
    expect(getBand(SGD_RATE_SCHEDULE, 7000)).toBeDefined();
  });

  it("returns no options for an amount outside every band", () => {
    expect(getTenureOptions(SGD_RATE_SCHEDULE, 500)).toEqual([]);
    expect(getTenureOptions(SGD_RATE_SCHEDULE, 40000)).toEqual([]);
  });
});

describe("computeInstalment", () => {
  it("rounds up (ceil), matching how the source table's own numbers were derived", () => {
    // 1000 * 1.25 / 12 = 104.1666... -> 105
    expect(computeInstalment(1000, 12, 25)).toBe(105);
  });

  it("returns an exact value with no rounding when it divides evenly", () => {
    expect(computeInstalment(15000, 60, 50)).toBe(375);
  });
});

describe("getMinMax*", () => {
  it("spans the full schedule, $1,000 to $30,000", () => {
    expect(getMinMaxAmount(SGD_RATE_SCHEDULE)).toEqual({ min: 1000, max: 30000 });
    expect(getMinMaxTenure(SGD_RATE_SCHEDULE)).toEqual({ min: 8, max: 60 });
    expect(getMinMaxRate(SGD_RATE_SCHEDULE)).toEqual({ min: 20, max: 50 });
  });
});

describe("isValidRepaymentChoice", () => {
  it("accepts a combination the schedule offers", () => {
    expect(isValidRepaymentChoice(SGD_RATE_SCHEDULE, 1000, 24)).toBe(true);
    expect(isValidRepaymentChoice(SGD_RATE_SCHEDULE, 30000, 60)).toBe(true);
  });

  it("rejects a tenure not offered for that amount's band", () => {
    // $1,000 only offers 8/12/24 months, not 36.
    expect(isValidRepaymentChoice(SGD_RATE_SCHEDULE, 1000, 36)).toBe(false);
  });

  it("rejects an amount outside every band", () => {
    expect(isValidRepaymentChoice(SGD_RATE_SCHEDULE, 999, 8)).toBe(false);
    expect(isValidRepaymentChoice(SGD_RATE_SCHEDULE, 35000, 24)).toBe(false);
  });
});

describe("summarize", () => {
  it("derives total repayment/interest from the computed instalment", () => {
    const option = getOption(SGD_RATE_SCHEDULE, 5000, 24)!;
    const result = summarize(option, 5000);
    // 282 * 24 = 6768
    expect(result.totalRepayment).toBe(6768);
    expect(result.totalInterest).toBe(1768);
    expect(result.monthlyInstalment).toBe(282);
    expect(result.ratePercent).toBe(35);
  });

  it("handles the corrected $2,500 / 8-month case", () => {
    const option = getOption(SGD_RATE_SCHEDULE, 2500, 8)!;
    const result = summarize(option, 2500);
    expect(result.totalRepayment).toBe(3000); // 375 * 8
    expect(result.totalInterest).toBe(500);
  });
});

describe("a minimal custom schedule", () => {
  const schedule: RateSchedule = [{ minAmount: 100, maxAmount: 200, tenures: [{ tenureMonths: 4, ratePercent: 20 }] }];

  it("round-trips through getOption/summarize", () => {
    const option = getOption(schedule, 100, 4);
    expect(option).toBeDefined();
    expect(summarize(option!, 100).totalRepayment).toBe(120);
  });
});
