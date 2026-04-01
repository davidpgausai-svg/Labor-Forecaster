import Decimal from "decimal.js";
import { calcSalariedEmployeeYear, calcHourlyEmployeeYear } from "./salary-engine";
import { calcBenefits } from "./benefits-engine";
import type {
  YearConfig,
  EmployeeInput,
  BargainingUnitConfig,
  SalaryScheduleData,
  EmployeeYearResult,
  ScenarioYearSummary,
  HeatmapCell,
} from "./types";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

const MAX_STEPS = 15;

export function calcEmployeeProjection(
  employee: EmployeeInput,
  yearConfigs: YearConfig[],
  unitConfig: BargainingUnitConfig,
  schedule: SalaryScheduleData | null,
  scenarioId: string
): EmployeeYearResult[] {
  const results: EmployeeYearResult[] = [];

  let currentSalary = new Decimal(employee.currentAnnualSalary);
  let currentHourlyRate = employee.currentHourlyRate
    ? new Decimal(employee.currentHourlyRate)
    : new Decimal("0");
  let currentStep = employee.currentStep ?? null;
  const currentLaneId = employee.currentLaneId ?? null;

  for (let yearIdx = 0; yearIdx <= Math.max(unitConfig.contractYears - 1, yearConfigs.length - 1); yearIdx++) {
    const config = yearConfigs[yearIdx];
    if (!config) break;

    let projectedBaseSalary: Decimal;
    let projectedHourlyRate: Decimal | null = null;
    let projectedStep: number | null = currentStep;
    const projectedLaneId: string | null = currentLaneId;
    let effectiveRate: Decimal | null = null;

    if (employee.compensationType === "salary") {
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
        MAX_STEPS
      );
      projectedBaseSalary = result.salary;
      projectedStep = result.projectedStep;
      effectiveRate = result.effectiveRate;
      currentSalary = result.salary;
      currentStep = result.projectedStep;
    } else {
      const tempEmployee: EmployeeInput = {
        ...employee,
        currentHourlyRate: currentHourlyRate.toString(),
      };
      const result = calcHourlyEmployeeYear(tempEmployee, yearIdx, config);
      projectedHourlyRate = result.hourlyRate;
      projectedBaseSalary = result.annualSalary;
      effectiveRate = result.effectiveRate;
      currentHourlyRate = result.hourlyRate;
      currentSalary = result.annualSalary;
    }

    const benefits = calcBenefits(
      projectedBaseSalary,
      unitConfig,
      config,
      yearIdx,
      employee.insuranceElection
    );

    results.push({
      employeeId: employee.id,
      scenarioId,
      contractYear: yearIdx,
      projectedStep,
      projectedLaneId,
      projectedHourlyRate: projectedHourlyRate?.toString() ?? null,
      projectedBaseSalary: projectedBaseSalary.toString(),
      projectedTotalCompensation: projectedBaseSalary.toString(),
      retirementContribution: benefits.retirementContribution.toString(),
      ficaCost: benefits.ficaCost.toString(),
      healthInsuranceCost: benefits.healthInsuranceCost.toString(),
      otherBenefitsCost: benefits.otherBenefitsCost.toString(),
      totalEmployerCost: benefits.totalEmployerCost.toString(),
      effectiveRate: effectiveRate?.toString() ?? null,
      isRetirementYear: false,
      retirementIncentiveAmount: null,
    });
  }

  return results;
}

export function calcScenarioSummary(
  allYearRecords: EmployeeYearResult[],
  yearConfigs: YearConfig[],
  bargainingUnitId: string
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
    const totalTRS = records
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

    const totalBenefits = totalTRS
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
      totalIMRF: "0",
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
  const cells: HeatmapCell[] = [];
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
