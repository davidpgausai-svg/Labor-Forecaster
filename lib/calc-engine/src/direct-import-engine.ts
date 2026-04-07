import Decimal from "decimal.js";
import type { YearConfig, EmployeeInput } from "./types.js";
import { calcEffectiveRate } from "./salary-engine.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

export interface ImportGridCell {
  laneId: string;
  stepNumber: number;
  salaryCents: number;
}

/**
 * Look up a salary from the import grid using laneId + stepNumber.
 * Returns null if no matching cell exists.
 */
function lookupCell(
  cells: ImportGridCell[],
  laneId: string,
  stepNumber: number
): ImportGridCell | null {
  return (
    cells.find((c) => c.laneId === laneId && c.stepNumber === stepNumber) ??
    null
  );
}

export function calcDirectImportEmployeeYear(
  employee: EmployeeInput,
  yearIdx: number,
  config: YearConfig,
  cells: ImportGridCell[],
  proRateFraction: Decimal = new Decimal("1")
): {
  salary: Decimal;
  effectiveRate: Decimal | null;
  projectedStep: number | null;
} {
  const currentStep = employee.currentStep ?? 1;
  const laneId = employee.currentLaneId ?? "";

  // Year 0: read salary directly from grid cell (or fall back to currentAnnualSalary)
  if (yearIdx === 0) {
    const cell = lookupCell(cells, laneId, currentStep);
    const baseSalary = cell
      ? new Decimal(cell.salaryCents).dividedBy(100)
      : new Decimal(employee.currentAnnualSalary);
    const salary = baseSalary
      .times(proRateFraction)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return { salary, effectiveRate: null, projectedStep: currentStep };
  }

  // Subsequent years: advance step, look up new grid cell, then apply increase formula
  const nextStep = currentStep + 1;

  // Look up next step cell first; if not found (at top of grid), stay at current step
  const nextCell = lookupCell(cells, laneId, nextStep);
  const currentCell = lookupCell(cells, laneId, currentStep);

  let salary = new Decimal(employee.currentAnnualSalary);
  let effectiveRate: Decimal | null = null;

  if (nextCell) {
    // Grid has a next step — use the cell value as the new base, then apply any formula increase
    salary = new Decimal(nextCell.salaryCents).dividedBy(100);
  } else if (currentCell) {
    // Top of grid — apply formula increase to current cell value
    salary = new Decimal(currentCell.salaryCents).dividedBy(100);
  }
  // else: no cells found, fall back to currentAnnualSalary (already set above)

  // Apply increase formula on top of the grid value
  const highEarnerThreshold = config.highEarnerThreshold
    ? new Decimal(config.highEarnerThreshold)
    : null;
  const highEarnerFlat = config.highEarnerFlatIncrease
    ? new Decimal(config.highEarnerFlatIncrease)
    : null;

  const baseForHighEarnerCheck = new Decimal(employee.currentAnnualSalary);

  if (
    config.increaseType === "fixed_percentage" ||
    config.increaseType === "cpi_formula"
  ) {
    const rate = calcEffectiveRate(config);
    effectiveRate = rate;
    // Only apply formula on top if NOT advancing to a new step cell
    // (grid step advance already captures the negotiated value)
    if (!nextCell) {
      salary = salary.times(new Decimal("1").plus(rate.dividedBy(100)));
    }
  } else if (config.increaseType === "flat_dollar") {
    if (!nextCell) {
      const flatAmt = new Decimal(config.fixedPercentage ?? "0");
      salary = salary.plus(flatAmt);
    }
  }

  // High-earner override
  if (
    highEarnerThreshold &&
    highEarnerFlat &&
    baseForHighEarnerCheck.gte(highEarnerThreshold)
  ) {
    salary = baseForHighEarnerCheck.plus(highEarnerFlat);
    effectiveRate = null;
  }

  salary = salary.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const projectedStep = nextCell ? nextStep : currentStep;

  return { salary, effectiveRate, projectedStep };
}
