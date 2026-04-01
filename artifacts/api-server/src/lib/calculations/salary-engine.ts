import Decimal from "decimal.js";
import type {
  YearConfig,
  EmployeeInput,
  SalaryScheduleData,
  LaneInfo,
} from "./types";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

const SS_WAGE_BASE = new Decimal("176100"); // 2025 Social Security wage base

export function calcEffectiveRate(config: YearConfig): Decimal {
  if (config.increaseType === "fixed_percentage") {
    return new Decimal(config.fixedPercentage ?? "0");
  }
  if (config.increaseType === "cpi_formula") {
    const cpi = new Decimal(config.cpiValue ?? "0");
    const adder = new Decimal(config.cpiAdder ?? "0");
    const cap = new Decimal(config.cpiCap ?? "100");
    const floor = new Decimal(config.cpiFloor ?? "0");
    const combined = cpi.plus(adder);
    return Decimal.max(floor, Decimal.min(cap, combined));
  }
  if (config.increaseType === "flat_dollar") {
    return new Decimal("0");
  }
  return new Decimal("0");
}

export function lookupScheduleCell(
  schedule: SalaryScheduleData,
  laneId: string,
  stepNumber: number
): Decimal | null {
  const cell = schedule.cells.find(
    (c) => c.laneId === laneId && c.stepNumber === stepNumber
  );
  if (!cell) return null;
  return new Decimal(cell.salaryAmount);
}

export function calcSalariedEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfig,
  schedule: SalaryScheduleData | null,
  maxStep: number,
  laneInfo?: LaneInfo | null
): {
  salary: Decimal;
  projectedStep: number | null;
  projectedLaneId: string | null;
  effectiveRate: Decimal | null;
} {
  let salary = new Decimal(employee.currentAnnualSalary);
  let projectedStep = employee.currentStep ?? null;
  const projectedLaneId = employee.currentLaneId ?? null;
  let effectiveRate: Decimal | null = null;

  if (yearIdx === 0) {
    return {
      salary: salary.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      projectedStep,
      projectedLaneId,
      effectiveRate: null,
    };
  }

  if (config.stepAdvancement && projectedStep !== null) {
    const newStep = Math.min(projectedStep + 1, maxStep);
    projectedStep = newStep;

    if (schedule && projectedLaneId) {
      const cellValue = lookupScheduleCell(schedule, projectedLaneId, newStep);
      if (cellValue !== null) {
        salary = cellValue;
      }
    }
  }

  const highEarnerThreshold = config.highEarnerThreshold
    ? new Decimal(config.highEarnerThreshold)
    : null;
  const highEarnerFlat = config.highEarnerFlatIncrease
    ? new Decimal(config.highEarnerFlatIncrease)
    : null;

  if (
    highEarnerThreshold &&
    highEarnerFlat &&
    salary.gte(highEarnerThreshold)
  ) {
    salary = salary.plus(highEarnerFlat);
    effectiveRate = null;
  } else if (
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

  return {
    salary: salary.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    projectedStep,
    projectedLaneId,
    effectiveRate,
  };
}

export function calcHourlyEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfig
): {
  hourlyRate: Decimal;
  annualSalary: Decimal;
  effectiveRate: Decimal | null;
} {
  let hourlyRate = new Decimal(employee.currentHourlyRate ?? "0");
  const annualHours = new Decimal(employee.annualHours ?? "2080");
  let effectiveRate: Decimal | null = null;

  if (yearIdx === 0) {
    const annualSalary = hourlyRate
      .times(annualHours)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return { hourlyRate, annualSalary, effectiveRate: null };
  }

  const annualEquiv = hourlyRate.times(annualHours);
  const highEarnerThreshold = config.highEarnerThreshold
    ? new Decimal(config.highEarnerThreshold)
    : null;
  const highEarnerFlat = config.highEarnerFlatIncrease
    ? new Decimal(config.highEarnerFlatIncrease)
    : null;

  if (
    highEarnerThreshold &&
    highEarnerFlat &&
    annualEquiv.gte(highEarnerThreshold)
  ) {
    const hourlyBump = highEarnerFlat.dividedBy(annualHours);
    hourlyRate = hourlyRate.plus(hourlyBump);
  } else if (
    config.increaseType === "fixed_percentage" ||
    config.increaseType === "cpi_formula"
  ) {
    const rate = calcEffectiveRate(config);
    effectiveRate = rate;
    hourlyRate = hourlyRate.times(
      new Decimal("1").plus(rate.dividedBy(100))
    );
  } else if (config.increaseType === "flat_dollar") {
    const flatAmt = new Decimal(config.fixedPercentage ?? "0");
    const hourlyBump = flatAmt.dividedBy(annualHours);
    hourlyRate = hourlyRate.plus(hourlyBump);
  }

  hourlyRate = hourlyRate.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const annualSalary = hourlyRate
    .times(annualHours)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return { hourlyRate, annualSalary, effectiveRate };
}
