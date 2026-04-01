import Decimal from "decimal.js";
import { db } from "@workspace/db";
import {
  scenariosTable,
  scenarioYearConfigsTable,
  employeeYearRecordsTable,
  employeesTable,
  bargainingUnitsTable,
  employeeGroupsTable,
  compensationSchedulesTable,
  indexGridConfigsTable,
  scheduleIndicesTable,
  salarySchedulesTable,
  lanesTable,
  stepsTable,
  scheduleCellsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { calcEmployeeProjection, calcScenarioSummary } from "./scenario-engine.js";
import type {
  YearConfig,
  YearConfigWithSchedule,
  EmployeeInput,
  BargainingUnitConfig,
  SalaryScheduleData,
  ScheduleCell,
  EmployeeYearResult,
  ScenarioCalculationResult,
  IndexGridConfig,
} from "./types.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

async function getScenarioWithConfigs(scenarioId: string) {
  const scenarios = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.id, scenarioId));
  const scenario = scenarios[0];
  if (!scenario) return null;

  const yearConfigs = await db
    .select()
    .from(scenarioYearConfigsTable)
    .where(eq(scenarioYearConfigsTable.scenarioId, scenarioId))
    .orderBy(scenarioYearConfigsTable.bargainingUnitId, scenarioYearConfigsTable.contractYear);

  return { ...scenario, yearConfigs };
}

async function loadIndexGridConfig(compensationScheduleId: string): Promise<IndexGridConfig | null> {
  const [gridRow, indices] = await Promise.all([
    db.select().from(indexGridConfigsTable)
      .where(eq(indexGridConfigsTable.compensationScheduleId, compensationScheduleId))
      .limit(1)
      .then((r) => r[0] ?? null),
    db.select({
      laneId: scheduleIndicesTable.laneId,
      stepNumber: scheduleIndicesTable.stepNumber,
      indexValue: scheduleIndicesTable.indexValue,
      isCapped: scheduleIndicesTable.isCapped,
    }).from(scheduleIndicesTable)
      .where(eq(scheduleIndicesTable.compensationScheduleId, compensationScheduleId)),
  ]);

  if (!gridRow) return null;

  return {
    baseAnchorSalary: gridRow.baseAnchorSalary,
    maxSteps: gridRow.maxSteps,
    indices: indices.map((idx) => ({
      laneId: idx.laneId,
      stepNumber: idx.stepNumber,
      indexValue: idx.indexValue,
      isCapped: idx.isCapped,
    })),
  };
}

async function loadScheduleForUnit(bargainingUnitId: string): Promise<SalaryScheduleData | null> {
  const schedules = await db
    .select()
    .from(salarySchedulesTable)
    .where(eq(salarySchedulesTable.bargainingUnitId, bargainingUnitId))
    .orderBy(salarySchedulesTable.effectiveYear)
    .limit(1);
  const schedule = schedules[0];
  if (!schedule) return null;

  const [lanes, steps, cells] = await Promise.all([
    db.select().from(lanesTable).where(eq(lanesTable.salaryScheduleId, schedule.id)).orderBy(lanesTable.displayOrder),
    db.select().from(stepsTable).where(eq(stepsTable.salaryScheduleId, schedule.id)).orderBy(stepsTable.stepNumber),
    db.select().from(scheduleCellsTable).where(eq(scheduleCellsTable.salaryScheduleId, schedule.id)),
  ]);

  const cellsWithStep: ScheduleCell[] = cells.map((c) => {
    const step = steps.find((s) => s.id === c.stepId);
    return { laneId: c.laneId, stepNumber: step?.stepNumber ?? 0, salaryAmount: c.salaryAmount };
  });

  return {
    id: schedule.id,
    baseSalary: schedule.baseSalary,
    lanes: lanes.map((l) => ({ id: l.id, name: l.name, indexMultiplier: l.indexMultiplier, displayOrder: l.displayOrder })),
    steps: steps.map((s) => ({ id: s.id, stepNumber: s.stepNumber, incrementMultiplier: s.incrementMultiplier })),
    cells: cellsWithStep,
  };
}

function toYearConfigs(
  dbConfigs: (typeof scenarioYearConfigsTable.$inferSelect)[],
  scheduleTypeMap?: Map<string, string>
): YearConfigWithSchedule[] {
  return dbConfigs.map((c) => {
    const scheduleType = c.compensationScheduleId && scheduleTypeMap
      ? (scheduleTypeMap.get(c.compensationScheduleId) as YearConfigWithSchedule["scheduleType"] ?? null)
      : null;
    return {
      contractYear: c.contractYear,
      yearLabel: c.yearLabel,
      increaseType: c.increaseType as YearConfig["increaseType"],
      effectiveRate: c.effectiveRate,
      fixedPercentage: c.fixedPercentage,
      cpiValue: c.cpiValue,
      cpiAdder: c.cpiAdder,
      cpiCap: c.cpiCap,
      cpiFloor: c.cpiFloor,
      cpiIndexName: c.cpiIndexName,
      highEarnerThreshold: c.highEarnerThreshold,
      highEarnerFlatIncrease: c.highEarnerFlatIncrease,
      educationalAdvancementBa15: c.educationalAdvancementBa15,
      educationalAdvancementMa: c.educationalAdvancementMa,
      educationalAdvancementMa15: c.educationalAdvancementMa15,
      stepAdvancement: c.stepAdvancement,
      healthPremiumIncreaseRate: c.healthPremiumIncreaseRate,
      healthEmployerCapRate: c.healthEmployerCapRate,
      employeeGroupId: c.employeeGroupId ?? null,
      compensationScheduleId: c.compensationScheduleId ?? null,
      scheduleType,
      baseAdjustmentType: c.baseAdjustmentType as YearConfigWithSchedule["baseAdjustmentType"] ?? null,
      baseAdjustmentValue: c.baseAdjustmentValue ?? null,
    };
  });
}

function groupDistrictWide(yearSummaries: Array<{
  contractYear: number;
  yearLabel: string;
  totalPayroll: string;
  totalBenefits: string;
  totalEmployerCost: string;
  employeeCount: number;
}>) {
  const yearMap = new Map<number, {
    contractYear: number;
    yearLabel: string;
    totalPayroll: Decimal;
    totalBenefits: Decimal;
    totalEmployerCost: Decimal;
    employeeCount: number;
  }>();

  for (const ys of yearSummaries) {
    const existing = yearMap.get(ys.contractYear);
    if (existing) {
      existing.totalPayroll = existing.totalPayroll.plus(ys.totalPayroll);
      existing.totalBenefits = existing.totalBenefits.plus(ys.totalBenefits);
      existing.totalEmployerCost = existing.totalEmployerCost.plus(ys.totalEmployerCost);
      existing.employeeCount += ys.employeeCount;
    } else {
      yearMap.set(ys.contractYear, {
        contractYear: ys.contractYear,
        yearLabel: ys.yearLabel,
        totalPayroll: new Decimal(ys.totalPayroll),
        totalBenefits: new Decimal(ys.totalBenefits),
        totalEmployerCost: new Decimal(ys.totalEmployerCost),
        employeeCount: ys.employeeCount,
      });
    }
  }

  return Array.from(yearMap.values())
    .sort((a, b) => a.contractYear - b.contractYear)
    .map((y) => ({
      contractYear: y.contractYear,
      yearLabel: y.yearLabel,
      totalPayroll: y.totalPayroll.toDecimalPlaces(2).toString(),
      totalBenefits: y.totalBenefits.toDecimalPlaces(2).toString(),
      totalEmployerCost: y.totalEmployerCost.toDecimalPlaces(2).toString(),
      employeeCount: y.employeeCount,
    }));
}

const toCents = (s: string | null) =>
  s != null ? new Decimal(s).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber() : null;

/**
 * Run full scenario calculation for a given scenarioId.
 * Loads all necessary data from the DB, runs the projection engine for every employee
 * in every bargaining unit, persists results to employee_year_records, and returns
 * a full summary. Returns null if the scenario does not exist.
 *
 * Self-contained: no HTTP round-trips required. Can be called from both the API
 * server route handlers and the seed script.
 */
export async function runScenarioCalculation(scenarioId: string): Promise<ScenarioCalculationResult | null> {
  const scenario = await getScenarioWithConfigs(scenarioId);
  if (!scenario) return null;

  // Separate BU-based year configs from employee-group-based year configs
  const buYearConfigs = scenario.yearConfigs.filter((c) => c.bargainingUnitId && !c.employeeGroupId);
  const groupYearConfigs = scenario.yearConfigs.filter((c) => !!c.employeeGroupId);

  const bargainingUnitIds = [...new Set(buYearConfigs.map((c) => c.bargainingUnitId!))];
  const employeeGroupIds = [...new Set(groupYearConfigs.map((c) => c.employeeGroupId!))];

  // Load compensation schedule types for all configs that have a compensationScheduleId
  const allScheduleIds = [
    ...new Set(scenario.yearConfigs.filter((c) => c.compensationScheduleId).map((c) => c.compensationScheduleId!)),
  ];
  const scheduleTypeMap = new Map<string, string>();
  if (allScheduleIds.length > 0) {
    const schedules = await db
      .select({ id: compensationSchedulesTable.id, scheduleType: compensationSchedulesTable.scheduleType })
      .from(compensationSchedulesTable)
      .where(inArray(compensationSchedulesTable.id, allScheduleIds));
    for (const s of schedules) {
      scheduleTypeMap.set(s.id, s.scheduleType);
    }
  }

  const safeIds = bargainingUnitIds.length > 0 ? bargainingUnitIds : ["__none__"];
  const allEmployees = await db
    .select({ employee: employeesTable, unit: bargainingUnitsTable })
    .from(employeesTable)
    .leftJoin(bargainingUnitsTable, eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id))
    .where(
      and(
        eq(employeesTable.districtId, scenario.districtId),
        inArray(employeesTable.bargainingUnitId, safeIds)
      )
    );

  // Load employee group data for group-based configs
  const groupEmployees = employeeGroupIds.length > 0
    ? await db
        .select({ employee: employeesTable, group: employeeGroupsTable })
        .from(employeesTable)
        .leftJoin(employeeGroupsTable, eq(employeesTable.employeeGroupId, employeeGroupsTable.id))
        .where(
          and(
            eq(employeesTable.districtId, scenario.districtId),
            inArray(employeesTable.employeeGroupId, employeeGroupIds)
          )
        )
    : [];

  const allYearRecords: (typeof employeeYearRecordsTable.$inferInsert)[] = [];

  function pushResults(yearResults: EmployeeYearResult[]) {
    for (const r of yearResults) {
      allYearRecords.push({
        employeeId: r.employeeId,
        scenarioId: r.scenarioId,
        contractYear: r.contractYear,
        projectedStep: r.projectedStep,
        projectedLaneId: r.projectedLaneId,
        projectedHourlyRate: r.projectedHourlyRate,
        projectedBaseSalaryCents: toCents(r.projectedBaseSalary)!,
        projectedTotalCompensationCents: toCents(r.projectedTotalCompensation)!,
        retirementContributionCents: toCents(r.retirementContribution)!,
        ficaCostCents: toCents(r.ficaCost)!,
        healthInsuranceCostCents: toCents(r.healthInsuranceCost)!,
        otherBenefitsCostCents: toCents(r.otherBenefitsCost)!,
        totalEmployerCostCents: toCents(r.totalEmployerCost)!,
        effectiveRate: r.effectiveRate,
        isRetirementYear: r.isRetirementYear,
        retirementIncentiveAmountCents: toCents(r.retirementIncentiveAmount),
      });
    }
  }

  function buildEmpInput(employee: typeof employeesTable.$inferSelect): EmployeeInput {
    return {
      id: employee.id,
      compensationType: employee.compensationType as "salary" | "hourly",
      currentAnnualSalary: employee.currentAnnualSalary,
      currentStep: employee.currentStep,
      currentHourlyRate: employee.currentHourlyRate,
      annualHours: employee.annualHours,
      currentLaneId: employee.currentLaneId,
      currentHourlyCategoryId: employee.currentHourlyCategoryId,
      insuranceElection: employee.insuranceElection as EmployeeInput["insuranceElection"],
      retirementEligible: employee.retirementEligible,
      retirementPlan: employee.retirementPlan,
      retirementTargetYear: employee.retirementTargetYear,
      yearsInDistrict: employee.yearsInDistrict,
      yearsTotalService: employee.yearsTotalService,
      contractYear: employee.contractYear,
      effectiveDate: employee.effectiveDate,
      terminationDate: employee.terminationDate,
    };
  }

  // Process bargaining-unit-based employees
  for (const bargainingUnitId of bargainingUnitIds) {
    const unitEmployees = allEmployees.filter((r) => r.employee.bargainingUnitId === bargainingUnitId);
    if (unitEmployees.length === 0) continue;

    const unitConfig = unitEmployees.find((r) => r.unit)?.unit;
    if (!unitConfig) continue;

    const dbYearConfigs = buYearConfigs
      .filter((c) => c.bargainingUnitId === bargainingUnitId)
      .sort((a, b) => a.contractYear - b.contractYear);
    if (dbYearConfigs.length === 0) continue;

    const buConfig: BargainingUnitConfig = {
      id: unitConfig.id,
      compensationType: unitConfig.compensationType as "salary" | "hourly",
      retirementSystem: unitConfig.retirementSystem as "TRS" | "IMRF" | "other",
      retirementEmployeeRate: unitConfig.retirementEmployeeRate,
      retirementEmployerRate: unitConfig.retirementEmployerRate,
      retirementGrossUpRate: unitConfig.retirementGrossUpRate,
      ficaRate: unitConfig.ficaRate,
      ficaExempt: unitConfig.ficaExempt,
      healthInsuranceSingleAnnual: unitConfig.healthInsuranceSingleAnnual,
      healthInsuranceFamilyAnnual: unitConfig.healthInsuranceFamilyAnnual,
      dentalAnnual: unitConfig.dentalAnnual,
      lifeInsuranceAnnual: unitConfig.lifeInsuranceAnnual,
      disabilityInsuranceAnnual: unitConfig.disabilityInsuranceAnnual,
      hsaContributionSingle: unitConfig.hsaContributionSingle,
      hsaContributionFamily: unitConfig.hsaContributionFamily,
      workersCompRate: unitConfig.workersCompRate,
      contractYears: unitConfig.contractYears,
    };

    const typedYearConfigs = toYearConfigs(dbYearConfigs, scheduleTypeMap);
    const scheduleData = await loadScheduleForUnit(bargainingUnitId);

    for (const { employee } of unitEmployees) {
      const yearResults = calcEmployeeProjection(buildEmpInput(employee), typedYearConfigs, buConfig, scheduleData, scenarioId);
      pushResults(yearResults);
    }
  }

  // Process employee-group-based employees
  for (const employeeGroupId of employeeGroupIds) {
    const groupEmps = groupEmployees.filter((r) => r.employee.employeeGroupId === employeeGroupId);
    if (groupEmps.length === 0) continue;

    const groupConfig = groupEmps.find((r) => r.group)?.group;
    if (!groupConfig) continue;

    const dbYearConfigs = groupYearConfigs
      .filter((c) => c.employeeGroupId === employeeGroupId)
      .sort((a, b) => a.contractYear - b.contractYear);
    if (dbYearConfigs.length === 0) continue;

    const typedYearConfigs = toYearConfigs(dbYearConfigs, scheduleTypeMap);

    // Load index grid config if schedule is index_based_grid
    const primaryScheduleId = dbYearConfigs[0]?.compensationScheduleId ?? null;
    const primaryScheduleType = primaryScheduleId ? scheduleTypeMap.get(primaryScheduleId) ?? null : null;
    const indexGridConfig = primaryScheduleId && primaryScheduleType === "index_based_grid"
      ? await loadIndexGridConfig(primaryScheduleId)
      : null;

    const buConfig: BargainingUnitConfig = {
      id: groupConfig.id,
      compensationType: "salary",
      retirementSystem: (groupConfig.retirementSystem as "TRS" | "IMRF" | "other") ?? "TRS",
      retirementEmployeeRate: groupConfig.retirementEmployeeRate,
      retirementEmployerRate: groupConfig.retirementEmployerRate,
      retirementGrossUpRate: groupConfig.retirementGrossUpRate,
      ficaRate: groupConfig.ficaRate,
      ficaExempt: groupConfig.ficaExempt,
      healthInsuranceSingleAnnual: groupConfig.healthInsuranceSingleAnnual,
      healthInsuranceFamilyAnnual: groupConfig.healthInsuranceFamilyAnnual,
      dentalAnnual: groupConfig.dentalAnnual,
      lifeInsuranceAnnual: groupConfig.lifeInsuranceAnnual,
      disabilityInsuranceAnnual: groupConfig.disabilityInsuranceAnnual,
      hsaContributionSingle: groupConfig.hsaContributionSingle,
      hsaContributionFamily: groupConfig.hsaContributionFamily,
      workersCompRate: groupConfig.workersCompRate,
      contractYears: groupConfig.contractYears,
    };

    for (const { employee } of groupEmps) {
      const yearResults = calcEmployeeProjection(buildEmpInput(employee), typedYearConfigs, buConfig, null, scenarioId, indexGridConfig);
      pushResults(yearResults);
    }
  }

  await db.delete(employeeYearRecordsTable).where(eq(employeeYearRecordsTable.scenarioId, scenarioId));

  if (allYearRecords.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < allYearRecords.length; i += chunkSize) {
      await db.insert(employeeYearRecordsTable).values(allYearRecords.slice(i, i + chunkSize));
    }
  }

  const savedRecords = await db
    .select()
    .from(employeeYearRecordsTable)
    .where(eq(employeeYearRecordsTable.scenarioId, scenarioId));

  const units = bargainingUnitIds.length > 0
    ? await db.select().from(bargainingUnitsTable).where(inArray(bargainingUnitsTable.id, bargainingUnitIds))
    : [];

  const allYearSummaries = [];
  for (const bargainingUnitId of bargainingUnitIds) {
    const unit = units.find((u) => u.id === bargainingUnitId);
    const dbYearConfigs = buYearConfigs
      .filter((c) => c.bargainingUnitId === bargainingUnitId)
      .sort((a, b) => a.contractYear - b.contractYear);
    const typedConfigs = toYearConfigs(dbYearConfigs, scheduleTypeMap);

    const unitEmployeeIds = new Set(
      allEmployees
        .filter((r) => r.employee.bargainingUnitId === bargainingUnitId)
        .map((r) => r.employee.id)
    );
    const unitRecords = savedRecords.filter((r) => unitEmployeeIds.has(r.employeeId));

    const fromCents = (c: number | null) => c != null ? (c / 100).toFixed(2) : null;
    const retirementSystem = (unit?.retirementSystem as "TRS" | "IMRF" | "other") ?? "TRS";
    const summaries = calcScenarioSummary(
      unitRecords.map((r): EmployeeYearResult => ({
        employeeId: r.employeeId,
        scenarioId: r.scenarioId,
        contractYear: r.contractYear,
        projectedStep: r.projectedStep,
        projectedLaneId: r.projectedLaneId,
        projectedHourlyRate: r.projectedHourlyRate,
        projectedBaseSalary: (r.projectedBaseSalaryCents / 100).toFixed(2),
        projectedTotalCompensation: (r.projectedTotalCompensationCents / 100).toFixed(2),
        retirementContribution: (r.retirementContributionCents / 100).toFixed(2),
        ficaCost: (r.ficaCostCents / 100).toFixed(2),
        healthInsuranceCost: (r.healthInsuranceCostCents / 100).toFixed(2),
        otherBenefitsCost: (r.otherBenefitsCostCents / 100).toFixed(2),
        totalEmployerCost: (r.totalEmployerCostCents / 100).toFixed(2),
        effectiveRate: r.effectiveRate,
        isRetirementYear: r.isRetirementYear,
        retirementIncentiveAmount: fromCents(r.retirementIncentiveAmountCents),
      })),
      typedConfigs,
      bargainingUnitId,
      retirementSystem
    );

    allYearSummaries.push(...summaries.map((s) => ({ ...s, bargainingUnitName: unit?.name ?? null })));
  }

  const districtWideSummary = groupDistrictWide(allYearSummaries);

  const totalFiveYearCost = districtWideSummary
    .reduce((sum, y) => sum.plus(y.totalEmployerCost), new Decimal("0"))
    .toDecimalPlaces(2)
    .toString();

  const employeeCount = [...new Set(savedRecords.map((r) => r.employeeId))].length;

  return {
    scenarioId,
    scenarioName: scenario.name,
    status: scenario.status,
    yearSummaries: allYearSummaries,
    districtWideSummary,
    totalFiveYearCost,
    employeeCount,
  };
}
