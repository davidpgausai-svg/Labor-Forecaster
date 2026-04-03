import Decimal from "decimal.js";
import type { YearConfig, EmployeeInput } from "./types.js";
import { calcEffectiveRate } from "./salary-engine.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

export interface SalaryRangeData {
  id: string;
  positionTitle: string;
  minSalaryCents: number;
  midSalaryCents: number;
  maxSalaryCents: number;
}

function classifyPosition(
  salary: Decimal,
  minCents: number,
  midCents: number,
  maxCents: number
): string {
  const min = new Decimal(minCents).dividedBy(100);
  const mid = new Decimal(midCents).dividedBy(100);
  const max = new Decimal(maxCents).dividedBy(100);

  if (salary.lt(min)) return "below_min";
  if (salary.lt(mid)) return "min_to_mid";
  if (salary.lt(max)) return "mid_to_max";
  return "above_max";
}

export function calcRangeBasedEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfig,
  salaryRange: SalaryRangeData | null,
  proRateFraction: Decimal = new Decimal("1")
): {
  salary: Decimal;
  effectiveRate: Decimal | null;
  rangePosition: string | null;
} {
  let salary = new Decimal(employee.currentAnnualSalary);

  if (yearIdx === 0) {
    const proRated = salary.times(proRateFraction).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    const rangePosition = salaryRange
      ? classifyPosition(salary, salaryRange.minSalaryCents, salaryRange.midSalaryCents, salaryRange.maxSalaryCents)
      : null;
    return { salary: proRated, effectiveRate: null, rangePosition };
  }

  let effectiveRate: Decimal | null = null;

  const highEarnerThreshold = config.highEarnerThreshold
    ? new Decimal(config.highEarnerThreshold)
    : null;
  const highEarnerFlat = config.highEarnerFlatIncrease
    ? new Decimal(config.highEarnerFlatIncrease)
    : null;

  if (
    config.increaseType === "fixed_percentage" ||
    config.increaseType === "cpi_formula"
  ) {
    const rate = calcEffectiveRate(config);
    effectiveRate = rate;
    salary = salary.times(new Decimal("1").plus(rate.dividedBy(100)));
  } else if (config.increaseType === "flat_dollar") {
    const flatAmt = new Decimal(config.fixedPercentage ?? "0");
    salary = salary.plus(flatAmt);
  }
  // "step_only" / "custom": no increase applied

  // High-earner override
  if (highEarnerThreshold && highEarnerFlat && new Decimal(employee.currentAnnualSalary).gte(highEarnerThreshold)) {
    salary = new Decimal(employee.currentAnnualSalary).plus(highEarnerFlat);
    effectiveRate = null;
  }

  salary = salary.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  // Determine range position using updated range (range increases by same rate)
  let rangePosition: string | null = null;
  if (salaryRange) {
    let minCents = salaryRange.minSalaryCents;
    let midCents = salaryRange.midSalaryCents;
    let maxCents = salaryRange.maxSalaryCents;

    if (
      effectiveRate !== null &&
      (config.increaseType === "fixed_percentage" || config.increaseType === "cpi_formula")
    ) {
      const multiplier = new Decimal("1").plus(effectiveRate.dividedBy(100));
      minCents = new Decimal(minCents).times(multiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
      midCents = new Decimal(midCents).times(multiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
      maxCents = new Decimal(maxCents).times(multiplier).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    }

    rangePosition = classifyPosition(salary, minCents, midCents, maxCents);
  }

  return { salary, effectiveRate, rangePosition };
}
