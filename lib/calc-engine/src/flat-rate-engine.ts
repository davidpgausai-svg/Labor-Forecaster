import Decimal from "decimal.js";
import type { YearConfig, EmployeeInput } from "./types.js";
import { calcEffectiveRate } from "./salary-engine.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

export interface FlatRatePosition {
  id: string;
  positionTitle: string;
  annualAmountCents: number;
}

export function calcFlatRateEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfig,
  flatRatePosition: FlatRatePosition | null,
  proRateFraction: Decimal = new Decimal("1")
): {
  salary: Decimal;
  effectiveRate: Decimal | null;
} {
  // Use flatRatePosition amount if provided, otherwise fall back to currentAnnualSalary.
  // The caller (scenario-engine) always passes the prior year's calculated salary as
  // currentAnnualSalary so compounding works correctly across years.
  const baseSalary = flatRatePosition
    ? new Decimal(flatRatePosition.annualAmountCents).dividedBy(100)
    : new Decimal(employee.currentAnnualSalary);

  if (yearIdx === 0) {
    return {
      salary: baseSalary.times(proRateFraction).toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
      effectiveRate: null,
    };
  }

  let salary = baseSalary;
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
  // "step_only" / "custom": no increase applied — flat rate has no steps

  // High-earner override: if pre-increase salary >= threshold, replace with flat bump
  if (highEarnerThreshold && highEarnerFlat && baseSalary.gte(highEarnerThreshold)) {
    salary = baseSalary.plus(highEarnerFlat);
    effectiveRate = null;
  }

  return {
    salary: salary.toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
    effectiveRate,
  };
}
