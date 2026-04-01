import Decimal from "decimal.js";
import { calcSalariedEmployeeYear } from "./salary-engine.js";
import { calcHourlyEmployeeYear } from "./hourly-engine.js";
import { calcBenefits, calcProRateFraction } from "./benefits-engine.js";
import { calcIndexBasedEmployeeYear } from "./index-based-engine.js";
import type {
  YearConfig,
  YearConfigWithSchedule,
  EmployeeInput,
  BargainingUnitConfig,
  SalaryScheduleData,
  LaneInfo,
  EmployeeYearResult,
  ScenarioYearSummary,
  HeatmapCell,
  IndexGridConfig,
} from "./types.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

const MAX_STEPS = 15;

export function calcEmployeeProjection(
  employee: EmployeeInput,
  yearConfigs: (YearConfig | YearConfigWithSchedule)[],
  unitConfig: BargainingUnitConfig,
  schedule: SalaryScheduleData | null,
  scenarioId: string,
  indexGridConfig?: IndexGridConfig | null
): EmployeeYearResult[] {
  const results: EmployeeYearResult[] = [];

  let currentSalary = new Decimal(employee.currentAnnualSalary);
  let currentHourlyRate = employee.currentHourlyRate
    ? new Decimal(employee.currentHourlyRate)
    : new Decimal("0");
  let currentStep = employee.currentStep ?? null;
  // For index-based grid: track the immutable starting step so yearIdx-based advancement
  // is computed from the original position, not from a step that gets mutated each year.
  const initialStep = employee.currentStep ?? null;
  const currentLaneId = employee.currentLaneId ?? null;

  const laneInfo: LaneInfo | null =
    schedule?.lanes.find((l) => l.id === currentLaneId) ?? null;

  for (let yearIdx = 0; yearIdx <= Math.max(unitConfig.contractYears - 1, yearConfigs.length - 1); yearIdx++) {
    const config = yearConfigs[yearIdx];
    if (!config) break;

    let projectedBaseSalary: Decimal;
    let projectedHourlyRate: Decimal | null = null;
    let projectedStep: number | null = currentStep;
    const projectedLaneId: string | null = currentLaneId;
    let effectiveRate: Decimal | null = null;

    // Pro-rate fraction applies only to the base year (yearIdx=0) for mid-year hires/terms
    const proRateFraction =
      yearIdx === 0
        ? calcProRateFraction(employee.effectiveDate, employee.terminationDate)
        : new Decimal("1");

    const scheduleType = (config as YearConfigWithSchedule).scheduleType;

    if (scheduleType === "index_based_grid" && indexGridConfig) {
      const indexResult = calcIndexBasedEmployeeYear(
        employee,
        yearIdx,
        yearConfigs as YearConfigWithSchedule[],
        indexGridConfig,
        currentLaneId,
        initialStep,  // always pass the immutable starting step so yearIdx offsets are correct
        proRateFraction
      );
      projectedBaseSalary = indexResult.salary;
      projectedStep = indexResult.projectedStep;
      effectiveRate = indexResult.effectiveRate;
      currentStep = indexResult.projectedStep;
      currentSalary = yearIdx === 0 && proRateFraction.lt("1")
        ? new Decimal(employee.currentAnnualSalary)
        : indexResult.salary;
    } else if (employee.compensationType === "salary") {
      const tempEmployee: EmployeeInput = {
        ...employee,
        currentAnnualSalary: currentSalary.toString(),
        currentStep,
      };
      const result = calcSalariedEmployeeYear(
        tempEmployee,
        yearIdx,
        config,
        schedule,
        MAX_STEPS,
        laneInfo,
        proRateFraction
      );
      projectedBaseSalary = result.salary;
      projectedStep = result.projectedStep;
      effectiveRate = result.effectiveRate;
      currentStep = result.projectedStep;
      // Carry forward FULL annualized salary — pro-rating affects only what was paid THIS year,
      // not the base for future year projections. For yearIdx>0, proRateFraction is always 1.
      currentSalary = yearIdx === 0 && proRateFraction.lt("1")
        ? new Decimal(employee.currentAnnualSalary)
        : result.salary;
    } else {
      const tempEmployee: EmployeeInput = {
        ...employee,
        currentHourlyRate: currentHourlyRate.toString(),
      };
      const result = calcHourlyEmployeeYear(tempEmployee, yearIdx, config, proRateFraction);
      projectedHourlyRate = result.hourlyRate;
      projectedBaseSalary = result.annualSalary;
      effectiveRate = result.effectiveRate;
      // hourlyRate is never pro-rated (it's a rate, not an amount); carry it forward as-is.
      currentHourlyRate = result.hourlyRate;
      currentSalary = result.annualSalary;
    }

    const benefits = calcBenefits(
      projectedBaseSalary,
      unitConfig,
      config,
      yearIdx,
      employee.insuranceElection,
      proRateFraction
    );

    results.push({
      employeeId: employee.id,
      scenarioId,
      contractYear: yearIdx,
      projectedStep,
      projectedLaneId,
      projectedHourlyRate: projectedHourlyRate?.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString() ?? null,
      projectedBaseSalary: projectedBaseSalary.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      projectedTotalCompensation: projectedBaseSalary.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      retirementContribution: benefits.retirementContribution.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      ficaCost: benefits.ficaCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      healthInsuranceCost: benefits.healthInsuranceCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      otherBenefitsCost: benefits.otherBenefitsCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      totalEmployerCost: benefits.totalEmployerCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString(),
      effectiveRate: effectiveRate?.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString() ?? null,
      isRetirementYear: false,
      retirementIncentiveAmount: null,
    });
  }

  return results;
}

/**
 * Summarize year-by-year totals for a single bargaining unit.
 * retirementSystem controls whether the retirement contribution is
 * labeled as TRS or IMRF in the breakdown columns.
 */
export function calcScenarioSummary(
  allYearRecords: EmployeeYearResult[],
  yearConfigs: YearConfig[],
  bargainingUnitId: string,
  retirementSystem: "TRS" | "IMRF" | "other" = "TRS"
): ScenarioYearSummary[] {
  const summaries: ScenarioYearSummary[] = [];

  const yearGroups = new Map<number, EmployeeYearResult[]>();
  for (const record of allYearRecords) {
    const group = yearGroups.get(record.contractYear) ?? [];
    group.push(record);
    yearGroups.set(record.contractYear, group);
  }

  for (const [yearIdx, records] of yearGroups.entries()) {
    const config = yearConfigs[yearIdx];
    const totalPayroll = records
      .reduce((sum, r) => sum.plus(r.projectedBaseSalary), new Decimal("0"))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalRetirement = records
      .reduce((sum, r) => sum.plus(r.retirementContribution), new Decimal("0"))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalFICA = records
      .reduce((sum, r) => sum.plus(r.ficaCost), new Decimal("0"))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalHealth = records
      .reduce((sum, r) => sum.plus(r.healthInsuranceCost), new Decimal("0"))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalOther = records
      .reduce((sum, r) => sum.plus(r.otherBenefitsCost), new Decimal("0"))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalEmployerCost = records
      .reduce((sum, r) => sum.plus(r.totalEmployerCost), new Decimal("0"))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Route the retirement total into the correct labeled bucket
    const totalTRS = retirementSystem !== "IMRF" ? totalRetirement : new Decimal("0");
    const totalIMRF = retirementSystem === "IMRF" ? totalRetirement : new Decimal("0");

    const totalBenefits = totalRetirement
      .plus(totalFICA)
      .plus(totalHealth)
      .plus(totalOther);
    const avgSalary =
      records.length > 0
        ? totalPayroll
            .dividedBy(records.length)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal("0");

    summaries.push({
      contractYear: yearIdx,
      yearLabel: config?.yearLabel ?? `Year ${yearIdx}`,
      bargainingUnitId,
      totalPayroll: totalPayroll.toString(),
      totalTRS: totalTRS.toString(),
      totalIMRF: totalIMRF.toString(),
      totalFICA: totalFICA.toString(),
      totalHealthInsurance: totalHealth.toString(),
      totalOtherBenefits: totalOther.toString(),
      totalBenefits: totalBenefits.toString(),
      totalEmployerCost: totalEmployerCost.toString(),
      employeeCount: records.length,
      avgSalary: avgSalary.toString(),
      effectiveRate: config?.effectiveRate ?? null,
    });
  }

  return summaries.sort((a, b) => a.contractYear - b.contractYear);
}

export function buildHeatmapData(
  yearRecords: EmployeeYearResult[],
  employees: Array<{ id: string; firstName: string; lastName: string }>,
  contractYear: number,
  lanesInfo: Array<{ id: string; name: string; displayOrder: number }>
): HeatmapCell[] {
  const yearData = yearRecords.filter((r) => r.contractYear === contractYear);

  const cellMap = new Map<string, HeatmapCell>();

  for (const record of yearData) {
    if (!record.projectedLaneId || record.projectedStep === null) continue;
    const key = `${record.projectedLaneId}:${record.projectedStep}`;
    const lane = lanesInfo.find((l) => l.id === record.projectedLaneId);
    if (!lane) continue;

    let cell = cellMap.get(key);
    if (!cell) {
      cell = {
        laneId: record.projectedLaneId,
        laneName: lane.name,
        stepNumber: record.projectedStep,
        employeeCount: 0,
        totalSalary: "0",
        employees: [],
      };
      cellMap.set(key, cell);
    }

    cell.employeeCount++;
    cell.totalSalary = new Decimal(cell.totalSalary)
      .plus(record.projectedBaseSalary)
      .toDecimalPlaces(2)
      .toString();

    const emp = employees.find((e) => e.id === record.employeeId);
    if (emp) {
      cell.employees.push({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        salary: record.projectedBaseSalary,
      });
    }
  }

  return Array.from(cellMap.values());
}
