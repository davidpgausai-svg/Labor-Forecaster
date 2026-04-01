import Decimal from "decimal.js";
import type { YearConfig, EmployeeInput } from "./types";
import { calcEffectiveRate } from "./salary-engine";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

export function calcHourlyEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfig,
  proRateFraction: Decimal = new Decimal("1")
): {
  hourlyRate: Decimal;
  annualSalary: Decimal;
  effectiveRate: Decimal | null;
} {
  let hourlyRate = new Decimal(employee.currentHourlyRate ?? "0");
  const annualHours = new Decimal(employee.annualHours ?? "2080");
  let effectiveRate: Decimal | null = null;

  if (yearIdx === 0) {
    // Pro-rate base year annual salary by fraction of year worked
    const annualSalary = hourlyRate
      .times(annualHours)
      .times(proRateFraction)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return { hourlyRate, annualSalary, effectiveRate: null };
  }

  const annualEquiv = hourlyRate.times(annualHours);
  const highEarnerThreshold = config.highEarnerThreshold
    ? new Decimal(config.highEarnerThreshold)
    : null;
  const highEarnerFlat = config.highEarnerFlatIncrease
    ? new Decimal(config.highEarnerFlatIncrease)
    : null;

  // Step 2: Apply base increase first (percentage, CPI, or flat dollar)
  if (
    config.increaseType === "fixed_percentage" ||
    config.increaseType === "cpi_formula"
  ) {
    const rate = calcEffectiveRate(config);
    effectiveRate = rate;
    hourlyRate = hourlyRate.times(new Decimal("1").plus(rate.dividedBy(100)));
  } else if (config.increaseType === "flat_dollar") {
    const flatAmt = new Decimal(config.fixedPercentage ?? "0");
    const hourlyBump = flatAmt.dividedBy(annualHours);
    hourlyRate = hourlyRate.plus(hourlyBump);
  }

  // Step 3: High-earner override — if pre-increase annual salary >= threshold,
  // override the increase with a flat dollar bump instead
  if (highEarnerThreshold && highEarnerFlat && annualEquiv.gte(highEarnerThreshold)) {
    const hourlyBump = highEarnerFlat.dividedBy(annualHours);
    hourlyRate = new Decimal(employee.currentHourlyRate ?? "0").plus(hourlyBump);
    effectiveRate = null;
  }

  hourlyRate = hourlyRate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const annualSalary = hourlyRate
    .times(annualHours)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return { hourlyRate, annualSalary, effectiveRate };
}
