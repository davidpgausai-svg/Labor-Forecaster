import Decimal from "decimal.js";
import type { EmployeeInput, YearConfigWithSchedule, IndexGridConfig } from "./types.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

/**
 * Columbia teacher model: index-based salary grid with compounding base anchor.
 *
 * Each year's salary = round(currentBase * indexValue) * proRateFraction
 * where currentBase compounds from the anchor across all prior year configs.
 */
export function calcIndexBasedEmployeeYear(
  _employee: EmployeeInput,
  yearIdx: number,
  yearConfigs: YearConfigWithSchedule[],
  gridConfig: IndexGridConfig,
  laneId: string | null,
  currentStep: number | null,
  proRateFraction: Decimal
): { salary: Decimal; projectedStep: number | null; effectiveRate: Decimal | null } {
  // 1. Compound the base anchor from year 0 to yearIdx
  let currentBase = new Decimal(gridConfig.baseAnchorSalary);

  for (let y = 1; y <= yearIdx; y++) {
    const config = yearConfigs[y];
    if (!config) break;

    if (config.baseAdjustmentType === "percentage" && config.baseAdjustmentValue) {
      const pct = new Decimal(config.baseAdjustmentValue).dividedBy(100);
      currentBase = currentBase.times(new Decimal("1").plus(pct));
    } else if (config.baseAdjustmentType === "dollar" && config.baseAdjustmentValue) {
      currentBase = currentBase.plus(new Decimal(config.baseAdjustmentValue));
    } else if (config.baseAdjustmentType === "set_directly" && config.baseAdjustmentValue) {
      currentBase = new Decimal(config.baseAdjustmentValue);
    }
  }

  // 2. Step advancement: move step forward by yearIdx positions (capped at maxSteps)
  let projectedStep: number | null = null;
  if (currentStep !== null) {
    projectedStep = Math.min(currentStep + yearIdx, gridConfig.maxSteps);
  }

  // 3. Look up index value from the grid (match laneId + stepNumber)
  let indexValue = new Decimal("1.0000");
  if (laneId !== null && projectedStep !== null) {
    const match = gridConfig.indices.find(
      (idx) => idx.laneId === laneId && idx.stepNumber === projectedStep
    );
    if (match) {
      indexValue = new Decimal(match.indexValue);
    }
  }

  // 4. salary = ceil(base * indexValue) * proRateFraction
  const rawSalary = currentBase.times(indexValue);
  const roundedSalary = rawSalary.ceil();
  const salary = roundedSalary.times(proRateFraction);

  // 5. effectiveRate: for yearIdx > 0, compare base to prior year's compounded base
  let effectiveRate: Decimal | null = null;
  if (yearIdx > 0) {
    let priorBase = new Decimal(gridConfig.baseAnchorSalary);
    for (let y = 1; y < yearIdx; y++) {
      const config = yearConfigs[y];
      if (!config) break;
      if (config.baseAdjustmentType === "percentage" && config.baseAdjustmentValue) {
        const pct = new Decimal(config.baseAdjustmentValue).dividedBy(100);
        priorBase = priorBase.times(new Decimal("1").plus(pct));
      } else if (config.baseAdjustmentType === "dollar" && config.baseAdjustmentValue) {
        priorBase = priorBase.plus(new Decimal(config.baseAdjustmentValue));
      } else if (config.baseAdjustmentType === "set_directly" && config.baseAdjustmentValue) {
        priorBase = new Decimal(config.baseAdjustmentValue);
      }
    }
    if (priorBase.gt(0)) {
      effectiveRate = currentBase.minus(priorBase).dividedBy(priorBase);
    }
  }

  return { salary, projectedStep, effectiveRate };
}
