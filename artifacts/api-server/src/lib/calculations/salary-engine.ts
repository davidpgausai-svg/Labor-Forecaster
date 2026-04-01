import Decimal from "decimal.js";
import type {
  YearConfig,
  EmployeeInput,
  SalaryScheduleData,
  LaneInfo,
} from "./types";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

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

function calcEducationalAdvancement(
  laneName: string | null | undefined,
  config: YearConfig
): Decimal {
  if (!laneName) return new Decimal("0");
  const name = laneName.toUpperCase().trim();

  if (name === "BA+15" && config.educationalAdvancementBa15) {
    return new Decimal(config.educationalAdvancementBa15);
  }
  if (
    (name === "MA" || name === "M.A." || name === "MASTERS") &&
    config.educationalAdvancementMa
  ) {
    return new Decimal(config.educationalAdvancementMa);
  }
  if (name === "MA+15" && config.educationalAdvancementMa15) {
    return new Decimal(config.educationalAdvancementMa15);
  }
  return new Decimal("0");
}

export function calcSalariedEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfig,
  schedule: SalaryScheduleData | null,
  maxStep: number,
  laneInfo?: LaneInfo | null,
  proRateFraction: Decimal = new Decimal("1")
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
      salary: salary.times(proRateFraction).toDecimalPlaces(0, Decimal.ROUND_HALF_UP),
      projectedStep,
      projectedLaneId,
      effectiveRate: null,
    };
  }

  // Step 1: Step advancement → grid cell lookup
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

  // Step 2: Base salary increase (CPI, fixed %, or flat $)
  const highEarnerThreshold = config.highEarnerThreshold
    ? new Decimal(config.highEarnerThreshold)
    : null;
  const highEarnerFlat = config.highEarnerFlatIncrease
    ? new Decimal(config.highEarnerFlatIncrease)
    : null;

  // Step 3: High-earner override
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

  // Step 4: Educational advancement stipend based on lane
  const laneName = laneInfo?.name ?? null;
  const eduBonus = calcEducationalAdvancement(laneName, config);
  if (eduBonus.gt("0")) {
    salary = salary.plus(eduBonus);
  }

  // Step 5: Round to nearest whole dollar
  const roundedSalary = salary.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

  return {
    salary: roundedSalary,
    projectedStep,
    projectedLaneId,
    effectiveRate,
  };
}

