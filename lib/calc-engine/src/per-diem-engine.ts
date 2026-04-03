import Decimal from "decimal.js";
import type { EmployeeInput, YearConfigWithSchedule } from "./types.js";
import { calcEffectiveRate } from "./salary-engine.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

const MAX_STEPS = 15;

export interface PerDiemConfig {
  compensationScheduleId: string;
  sourceScheduleId: string | null;
  contractDays: number;
  derivationMethod: "from_salary_schedule" | "independent";
}

export interface PerDiemCap {
  laneId: string;
  capStep: number;
  capRateCents: number;
}

export interface PerDiemResult {
  dailyRate: Decimal;        // per-diem rate (whole dollars), capped if applicable
  annualEquivalent: Decimal; // same as dailyRate for now; caller multiplies × extra days
  projectedStep: number | null;
  effectiveRate: Decimal | null;
}

/**
 * Compute the per-diem daily rate for one employee in one contract year.
 *
 * When derivationMethod === "from_salary_schedule" and annualSalaryForYear is
 * provided, the rate is simply annualSalary ÷ contractDays. This is the common
 * case — the caller (run-calculation.ts) always passes the primary engine's
 * projected salary.
 *
 * When derivationMethod === "independent" or annualSalaryForYear is null, the
 * engine applies the year's increase logic to employee.currentAnnualSalary and
 * then derives the daily rate. This covers stand-alone per-diem schedules.
 */
export function calcPerDiemEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfigWithSchedule,
  perDiemConfig: PerDiemConfig,
  perDiemCaps: PerDiemCap[],
  annualSalaryForYear: Decimal | null,
  laneId: string | null,
  currentStep: number | null,
  proRateFraction: Decimal = new Decimal("1")
): PerDiemResult {
  // Step 1: determine the base annual salary
  let baseSalary: Decimal;
  let effectiveRate: Decimal | null = null;

  if (
    perDiemConfig.derivationMethod === "from_salary_schedule" &&
    annualSalaryForYear !== null
  ) {
    baseSalary = annualSalaryForYear;
    effectiveRate = config.effectiveRate ? new Decimal(config.effectiveRate) : null;
  } else {
    // Independent: start from the employee's base salary and apply the year's increase
    baseSalary = new Decimal(employee.currentAnnualSalary);
    if (yearIdx === 0) {
      baseSalary = baseSalary.times(proRateFraction);
    } else if (
      config.increaseType === "fixed_percentage" ||
      config.increaseType === "cpi_formula"
    ) {
      const rate = calcEffectiveRate(config);
      effectiveRate = rate;
      baseSalary = baseSalary.times(new Decimal("1").plus(rate.dividedBy(100)));
    } else if (config.increaseType === "flat_dollar") {
      baseSalary = baseSalary.plus(new Decimal(config.fixedPercentage ?? "0"));
    }
  }

  // Step 2: raw daily rate (whole dollars)
  const rawDailyRate = baseSalary
    .dividedBy(perDiemConfig.contractDays)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  // Step 3: step advancement (same pattern as salary-engine)
  const projectedStep =
    yearIdx === 0
      ? currentStep
      : currentStep !== null
        ? Math.min(currentStep + yearIdx, MAX_STEPS)
        : null;

  // Step 4: apply per-diem cap for this lane
  let dailyRate = rawDailyRate;
  if (laneId !== null) {
    const cap = perDiemCaps.find((c) => c.laneId === laneId);
    if (cap !== undefined && projectedStep !== null && projectedStep >= cap.capStep) {
      const capAmount = new Decimal(cap.capRateCents).dividedBy(100);
      if (rawDailyRate.gt(capAmount)) {
        dailyRate = capAmount;
      }
    }
  }

  return {
    dailyRate,
    annualEquivalent: dailyRate,
    projectedStep,
    effectiveRate,
  };
}
