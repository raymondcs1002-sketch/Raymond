/**
 * Loan pricing — a rate *schedule* (bands of amount ranges, each offering
 * specific tenures at a fixed percentage), not a single flat formula.
 * The lender's actual rate card was given as a table of exact amounts;
 * this generalizes it into ranges so a continuous amount slider (any
 * $500 step from $1,000–$30,000) works, not just the amounts originally
 * listed. Instalments are computed with the same rounding the original
 * table's numbers follow (principal × (1 + rate/100) / tenure, rounded
 * up) — confirmed against the source table, see SGD_RATE_SCHEDULE below
 * for the one correction and the handful of $1–3 rounding differences
 * this generalization introduces versus the original literal numbers.
 */

export interface TenureRate {
  tenureMonths: number;
  ratePercent: number;
}

export interface RateBand {
  minAmount: number;
  maxAmount: number;
  tenures: TenureRate[];
}

export type RateSchedule = RateBand[];

export function getBand(schedule: RateSchedule, amount: number): RateBand | undefined {
  return schedule.find((band) => amount >= band.minAmount && amount <= band.maxAmount);
}

export function getMinMaxAmount(schedule: RateSchedule): { min: number; max: number } {
  const mins = schedule.map((b) => b.minAmount);
  const maxes = schedule.map((b) => b.maxAmount);
  return { min: Math.min(...mins), max: Math.max(...maxes) };
}

export function getMinMaxTenure(schedule: RateSchedule): { min: number; max: number } {
  const tenures = schedule.flatMap((band) => band.tenures.map((t) => t.tenureMonths));
  return { min: Math.min(...tenures), max: Math.max(...tenures) };
}

export function getMinMaxRate(schedule: RateSchedule): { min: number; max: number } {
  const rates = schedule.flatMap((band) => band.tenures.map((t) => t.ratePercent));
  return { min: Math.min(...rates), max: Math.max(...rates) };
}

/** Flat-rate instalment, rounded up — matches how the source rate card's own numbers were derived. */
export function computeInstalment(amount: number, tenureMonths: number, ratePercent: number): number {
  return Math.ceil((amount * (1 + ratePercent / 100)) / tenureMonths);
}

export interface RepaymentOption {
  tenureMonths: number;
  monthlyInstalment: number;
  ratePercent: number;
}

export function getTenureOptions(schedule: RateSchedule, amount: number): RepaymentOption[] {
  const band = getBand(schedule, amount);
  if (!band) return [];
  return band.tenures.map((t) => ({
    tenureMonths: t.tenureMonths,
    ratePercent: t.ratePercent,
    monthlyInstalment: computeInstalment(amount, t.tenureMonths, t.ratePercent),
  }));
}

export function getOption(schedule: RateSchedule, amount: number, tenureMonths: number): RepaymentOption | undefined {
  return getTenureOptions(schedule, amount).find((o) => o.tenureMonths === tenureMonths);
}

export interface RepaymentSummary {
  principal: number;
  tenureMonths: number;
  monthlyInstalment: number;
  totalRepayment: number;
  totalInterest: number;
  ratePercent: number;
}

export function summarize(option: RepaymentOption, principal: number): RepaymentSummary {
  const totalRepayment = option.monthlyInstalment * option.tenureMonths;
  return {
    principal,
    tenureMonths: option.tenureMonths,
    monthlyInstalment: option.monthlyInstalment,
    totalRepayment,
    totalInterest: totalRepayment - principal,
    ratePercent: option.ratePercent,
  };
}

/** True if this exact amount + tenure combination is offered. */
export function isValidRepaymentChoice(schedule: RateSchedule, amount: number, tenureMonths: number): boolean {
  return getOption(schedule, amount, tenureMonths) !== undefined;
}

/**
 * The real SGD rate card, generalized into bands so any amount in
 * between (not just the amounts originally listed) has a valid tenure
 * set and instalment. Bands follow the tenure/rate groupings the source
 * table actually used:
 *   $1,000–$9,999    → 8/12/24 months  (20% / 25% / 35%)
 *   $10,000–$14,999  → 12/24/36/48 months (25% / 35% / 40% / 45%)
 *   $15,000–$19,999  → 12/24/36/48/60 months (25% / 35% / 40% / 45% / 50%)
 *   $20,000–$30,000  → 24/36/48/60 months (35% / 40% / 45% / 50%)
 * ($30,000 is new — the source table stopped at $25,000; extended
 * following the same 20k/25k band pattern, confirmed with the client.)
 *
 * Computing every cell with one formula (rather than keeping the
 * original numbers verbatim) reproduces the source table exactly for
 * all but a handful of cells, which round to within $1–3 of the
 * original (e.g. $2,500/12mo: table said 260, formula gives 261;
 * $25,000 row: table said 1405/970/755, formula gives 1407/973/756) —
 * an accepted tradeoff for a continuous slider instead of a fixed list
 * of amounts. $2,500/8mo was a confirmed typo in the source (345),
 * corrected to the formula's 375.
 */
export const SGD_RATE_SCHEDULE: RateSchedule = [
  {
    minAmount: 1000,
    maxAmount: 9999,
    tenures: [
      { tenureMonths: 8, ratePercent: 20 },
      { tenureMonths: 12, ratePercent: 25 },
      { tenureMonths: 24, ratePercent: 35 },
    ],
  },
  {
    minAmount: 10000,
    maxAmount: 14999,
    tenures: [
      { tenureMonths: 12, ratePercent: 25 },
      { tenureMonths: 24, ratePercent: 35 },
      { tenureMonths: 36, ratePercent: 40 },
      { tenureMonths: 48, ratePercent: 45 },
    ],
  },
  {
    minAmount: 15000,
    maxAmount: 19999,
    tenures: [
      { tenureMonths: 12, ratePercent: 25 },
      { tenureMonths: 24, ratePercent: 35 },
      { tenureMonths: 36, ratePercent: 40 },
      { tenureMonths: 48, ratePercent: 45 },
      { tenureMonths: 60, ratePercent: 50 },
    ],
  },
  {
    minAmount: 20000,
    maxAmount: 30000,
    tenures: [
      { tenureMonths: 24, ratePercent: 35 },
      { tenureMonths: 36, ratePercent: 40 },
      { tenureMonths: 48, ratePercent: 45 },
      { tenureMonths: 60, ratePercent: 50 },
    ],
  },
];

/** Slider step, in whichever currency unit the schedule is denominated. */
export const AMOUNT_STEP = 500;
