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
  salaryRangesTable,
  stipendDefinitionsTable,
  employeeStipendsTable,
  perDiemConfigsTable,
  perDiemCapsTable,
  salarySchedulesTable,
  lanesTable,
  stepsTable,
  scheduleCellsTable,
  importGridCellsTable,
  employeePositionsTable,
  employeePositionYearRecordsTable,
  districtsTable,
  employerTaxConfigTable,
  benefitPlanTypesTable,
  benefitPlanTiersTable,
  benefitPlanRatesTable,
  retirementPlansTable,
  employeeGroupBenefitAssignmentsTable,
  employeeGroupRetirementAssignmentsTable,
  employerAccountContributionsTable,
  employerFlatCostsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { calcEmployeeProjection, calcScenarioSummary } from "./scenario-engine.js";
import { calcBenefits } from "./benefits-engine.js";
import type {
  YearConfig,
  YearConfigWithSchedule,
  EmployeeInput,
  BargainingUnitConfig,
  EmployerCostConfig,
  BenefitPlanData,
  SalaryScheduleData,
  ScheduleCell,
  EmployeeYearResult,
  PositionYearResult,
  ScenarioCalculationResult,
  IndexGridConfig,
} from "./types.js";
import type { SalaryRangeData } from "./range-based-engine.js";
import { calcEmployeeStipends } from "./stipend-engine.js";
import type { StipendDefinition } from "./stipend-engine.js";
import { calcPerDiemEmployeeYear } from "./per-diem-engine.js";
import type { PerDiemConfig, PerDiemCap } from "./per-diem-engine.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

/**
 * Load normalized Employer Cost Center data for a district + optional employee group.
 * Returns an EmployerCostConfig that calcBenefits() uses instead of (or to supplement)
 * the flat BargainingUnitConfig fields.
 *
 * Falls back gracefully — if no data exists yet (pre-migration), all arrays are
 * empty and taxConfig is null, so calcBenefits() falls back to flat fields.
 */
async function loadEmployerCostConfig(
  districtId: string,
  employeeGroupId: string | null
): Promise<EmployerCostConfig> {
  // 1. Tax config (district-level)
  const taxRow = await db
    .select()
    .from(employerTaxConfigTable)
    .where(eq(employerTaxConfigTable.districtId, districtId))
    .limit(1)
    .then((r) => r[0] ?? null);

  const taxConfig = taxRow
    ? {
        ssRate: taxRow.ssRate,
        ssWageBase: taxRow.ssWageBase,
        medicareRate: taxRow.medicareRate,
        futaRate: taxRow.futaRate,
        futaWageBase: taxRow.futaWageBase,
        sutaRate: taxRow.sutaRate,
        sutaWageBase: taxRow.sutaWageBase,
        workersCompRatePer100: taxRow.workersCompRatePer100,
      }
    : null;

  // 2. Benefit plans (group-specific via assignments)
  const benefitPlans: BenefitPlanData[] = [];
  if (employeeGroupId) {
    const assignments = await db
      .select({ plan: benefitPlanTypesTable })
      .from(employeeGroupBenefitAssignmentsTable)
      .innerJoin(
        benefitPlanTypesTable,
        eq(employeeGroupBenefitAssignmentsTable.benefitPlanTypeId, benefitPlanTypesTable.id)
      )
      .where(
        and(
          eq(employeeGroupBenefitAssignmentsTable.employeeGroupId, employeeGroupId),
          eq(benefitPlanTypesTable.isActive, true)
        )
      );

    const planIds = assignments.map((a) => a.plan.id);

    // Batch-load tiers and rates for all assigned plans
    const allTiers = planIds.length > 0
      ? await db
          .select()
          .from(benefitPlanTiersTable)
          .where(inArray(benefitPlanTiersTable.benefitPlanTypeId, planIds))
      : [];
    const allRates = planIds.length > 0
      ? await db
          .select()
          .from(benefitPlanRatesTable)
          .where(inArray(benefitPlanRatesTable.benefitPlanTypeId, planIds))
      : [];

    for (const { plan } of assignments) {
      const tiers = allTiers
        .filter((t) => t.benefitPlanTypeId === plan.id)
        .map((t) => ({
          tier: t.tier,
          employerContributionAnnual: t.employerContributionAnnual,
        }));
      const rateRow = allRates.find((r) => r.benefitPlanTypeId === plan.id);
      benefitPlans.push({
        id: plan.id,
        category: plan.category,
        planName: plan.planName,
        calculationMethod: plan.calculationMethod,
        tiers,
        salaryRate: rateRow?.rate ?? null,
        coveredEarningsCap: rateRow?.coveredEarningsCap ?? null,
      });
    }
  }

  // 3. Retirement plan (group-specific — first assigned plan)
  let retirementPlan: EmployerCostConfig["retirementPlan"] = null;
  if (employeeGroupId) {
    const retRow = await db
      .select({ plan: retirementPlansTable })
      .from(employeeGroupRetirementAssignmentsTable)
      .innerJoin(
        retirementPlansTable,
        eq(employeeGroupRetirementAssignmentsTable.retirementPlanId, retirementPlansTable.id)
      )
      .where(eq(employeeGroupRetirementAssignmentsTable.employeeGroupId, employeeGroupId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (retRow) {
      retirementPlan = {
        id: retRow.plan.id,
        planName: retRow.plan.planName,
        planType: retRow.plan.planType,
        employerRate: retRow.plan.employerRate,
        grossUpRate: retRow.plan.grossUpRate,
        employeeRate: retRow.plan.employeeRate,
        isFicaExempt: retRow.plan.isFicaExempt,
      };
    }
  }

  // 4. HSA contributions (district-level)
  const hsaRows = await db
    .select()
    .from(employerAccountContributionsTable)
    .where(
      and(
        eq(employerAccountContributionsTable.districtId, districtId),
        eq(employerAccountContributionsTable.accountType, "hsa")
      )
    );

  // 5. Flat per-employee costs (district-level)
  const flatCostRows = await db
    .select()
    .from(employerFlatCostsTable)
    .where(
      and(
        eq(employerFlatCostsTable.districtId, districtId),
        eq(employerFlatCostsTable.isActive, true)
      )
    );

  return {
    taxConfig,
    benefitPlans,
    retirementPlan,
    hsaContributions: hsaRows.map((r) => ({
      tier: r.tier,
      annualContribution: r.employerContributionAnnual,
    })),
    flatCosts: flatCostRows.map((r) => ({
      costName: r.costName,
      annualCostPerEmployee: r.annualCostPerEmployee,
    })),
  };
}

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

async function loadSalaryRanges(compensationScheduleId: string): Promise<SalaryRangeData[]> {
  const rows = await db
    .select()
    .from(salaryRangesTable)
    .where(eq(salaryRangesTable.compensationScheduleId, compensationScheduleId))
    .orderBy(salaryRangesTable.displayOrder);
  return rows.map((r) => ({
    id: r.id,
    positionTitle: r.positionTitle,
    minSalaryCents: r.minSalaryCents,
    midSalaryCents: r.midSalaryCents,
    maxSalaryCents: r.maxSalaryCents,
  }));
}

async function loadImportGridCells(compensationScheduleId: string): Promise<import("./direct-import-engine.js").ImportGridCell[]> {
  const rows = await db
    .select()
    .from(importGridCellsTable)
    .where(eq(importGridCellsTable.compensationScheduleId, compensationScheduleId));
  return rows.map((r) => ({
    compensationScheduleId: r.compensationScheduleId,
    laneId: r.laneId,
    stepNumber: r.stepNumber,
    salaryCents: r.salaryCents,
  }));
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
      benefitCostTrendRate: c.benefitCostTrendRate ?? null,
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

  const allYearRecords: (typeof employeeYearRecordsTable.$inferInsert & {
    _positionResults?: PositionYearResult[];
    _totalFteFraction?: string;
    _benefitEligible?: boolean;
  })[] = [];
  const allPositionYearRecords: (typeof employeePositionYearRecordsTable.$inferInsert)[] = [];

  function pushResults(
    yearResults: EmployeeYearResult[],
    positionResults?: PositionYearResult[],
    totalFteFraction?: string,
    benefitEligible?: boolean
  ) {
    for (const r of yearResults) {
      const rec: typeof allYearRecords[0] = {
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
        futaCostCents: toCents(r.futaCost ?? "0")!,
        sutaCostCents: toCents(r.sutaCost ?? "0")!,
        healthInsuranceCostCents: toCents(r.healthInsuranceCost)!,
        otherBenefitsCostCents: toCents(r.otherBenefitsCost)!,
        totalEmployerCostCents: toCents(r.totalEmployerCost)!,
        effectiveRate: r.effectiveRate,
        isRetirementYear: r.isRetirementYear,
        retirementIncentiveAmountCents: toCents(r.retirementIncentiveAmount),
        projectedDailyRateCents: toCents(r.projectedDailyRate),
        stipendTotalCents: toCents(r.stipendTotalAmount),
        rangePosition: r.rangePosition ?? null,
        totalFteFraction: totalFteFraction ?? null,
        benefitEligible: benefitEligible ?? null,
      };
      if (positionResults) {
        rec._positionResults = positionResults.filter((p) => p.contractYear === r.contractYear);
      }
      allYearRecords.push(rec);
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
      pendingEffectiveContractYear: employee.pendingEffectiveContractYear ?? null,
      pendingBargainingUnitId: employee.pendingBargainingUnitId ?? null,
      pendingEmployeeGroupId: employee.pendingEmployeeGroupId ?? null,
      pendingCurrentStep: employee.pendingCurrentStep ?? null,
      pendingCurrentLaneId: employee.pendingCurrentLaneId ?? null,
      pendingAnnualSalary: employee.pendingAnnualSalary ?? null,
    };
  }

  // ── Multi-position: load district threshold + active positions ─────────────
  const districtRow = await db
    .select({ benefitEligibleFteThreshold: districtsTable.benefitEligibleFteThreshold })
    .from(districtsTable)
    .where(eq(districtsTable.id, scenario.districtId))
    .limit(1)
    .then((r) => r[0] ?? null);
  const benefitFteThreshold = new Decimal(districtRow?.benefitEligibleFteThreshold ?? "0.75");

  const allEmpIds = [
    ...allEmployees.map((r) => r.employee.id),
    ...groupEmployees.map((r) => r.employee.id),
  ];

  const activePositions = allEmpIds.length > 0
    ? await db
        .select()
        .from(employeePositionsTable)
        .where(
          and(
            inArray(employeePositionsTable.employeeId, allEmpIds),
            inArray(employeePositionsTable.status, ["active", "on_leave"])
          )
        )
    : [];

  // Group positions by employee ID, sorted primary-first then displayOrder
  const positionsByEmployee = new Map<string, (typeof employeePositionsTable.$inferSelect)[]>();
  for (const pos of activePositions) {
    const list = positionsByEmployee.get(pos.employeeId) ?? [];
    list.push(pos);
    positionsByEmployee.set(pos.employeeId, list);
  }
  for (const [, list] of positionsByEmployee) {
    list.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.displayOrder - b.displayOrder;
    });
  }

  // Load group configs + year configs + schedules for all groups referenced by positions
  const posGroupIds = [...new Set(
    activePositions.filter((p) => p.employeeGroupId).map((p) => p.employeeGroupId!)
  )];
  const missingGroupIds = posGroupIds.filter((id) => !employeeGroupIds.includes(id));
  const additionalGroupRows = missingGroupIds.length > 0
    ? await db.select().from(employeeGroupsTable).where(inArray(employeeGroupsTable.id, missingGroupIds))
    : [];

  // Also load schedule types for any additional position group schedules
  const additionalScheduleIds = [...new Set(
    scenario.yearConfigs
      .filter((c) => c.employeeGroupId && posGroupIds.includes(c.employeeGroupId) && c.compensationScheduleId)
      .map((c) => c.compensationScheduleId!)
      .filter((id) => !scheduleTypeMap.has(id))
  )];
  if (additionalScheduleIds.length > 0) {
    const rows = await db
      .select({ id: compensationSchedulesTable.id, scheduleType: compensationSchedulesTable.scheduleType })
      .from(compensationSchedulesTable)
      .where(inArray(compensationSchedulesTable.id, additionalScheduleIds));
    for (const s of rows) scheduleTypeMap.set(s.id, s.scheduleType);
  }

  // Build position group config map (id → BargainingUnitConfig-shaped object)
  const posGroupConfigMap = new Map<string, BargainingUnitConfig>();
  for (const g of additionalGroupRows) {
    posGroupConfigMap.set(g.id, {
      id: g.id,
      compensationType: "salary",
      retirementSystem: (g.retirementSystem as "TRS" | "IMRF" | "other") ?? "TRS",
      retirementEmployeeRate: g.retirementEmployeeRate,
      retirementEmployerRate: g.retirementEmployerRate,
      retirementGrossUpRate: g.retirementGrossUpRate,
      ficaRate: g.ficaRate,
      ficaExempt: g.ficaExempt,
      healthInsuranceSingleAnnual: g.healthInsuranceSingleAnnual,
      healthInsuranceFamilyAnnual: g.healthInsuranceFamilyAnnual,
      dentalAnnual: g.dentalAnnual,
      lifeInsuranceAnnual: g.lifeInsuranceAnnual,
      disabilityInsuranceAnnual: g.disabilityInsuranceAnnual,
      hsaContributionSingle: g.hsaContributionSingle,
      hsaContributionFamily: g.hsaContributionFamily,
      workersCompRate: g.workersCompRate,
      contractYears: g.contractYears,
    });
  }

  // Build position group year config map
  const posGroupYearConfigsMap = new Map<string, YearConfigWithSchedule[]>();
  for (const groupId of posGroupIds) {
    const dbCfgs = scenario.yearConfigs
      .filter((c) => c.employeeGroupId === groupId)
      .sort((a, b) => a.contractYear - b.contractYear);
    if (dbCfgs.length > 0) {
      posGroupYearConfigsMap.set(groupId, toYearConfigs(dbCfgs, scheduleTypeMap));
    }
  }

  // Build position group schedule map (index grid + import grid + salary ranges)
  interface PosGroupScheduleData {
    indexGridConfig: IndexGridConfig | null;
    importGridCells: import("./direct-import-engine.js").ImportGridCell[] | null;
    salaryRanges: SalaryRangeData[] | null;
  }
  const posGroupScheduleMap = new Map<string, PosGroupScheduleData>();
  for (const groupId of posGroupIds) {
    const dbCfg0 = scenario.yearConfigs.find((c) => c.employeeGroupId === groupId && c.compensationScheduleId);
    const schedId = dbCfg0?.compensationScheduleId ?? null;
    const schedType = schedId ? scheduleTypeMap.get(schedId) ?? null : null;
    posGroupScheduleMap.set(groupId, {
      indexGridConfig: schedId && schedType === "index_based_grid" ? await loadIndexGridConfig(schedId) : null,
      importGridCells: schedId && schedType === "direct_import_grid" ? await loadImportGridCells(schedId) : null,
      salaryRanges: schedId && schedType === "range_based" ? await loadSalaryRanges(schedId) : null,
    });
  }

  // ── Pre-load pending BU configs and schedules for employees with pending BU transitions
  const empsPendingBuChange = [...allEmployees, ...groupEmployees]
    .map((r) => r.employee)
    .filter((e) => e.pendingBargainingUnitId != null && e.pendingEffectiveContractYear != null);
  const empsPendingGroupChange = [...allEmployees, ...groupEmployees]
    .map((r) => r.employee)
    .filter((e) => e.pendingEmployeeGroupId != null && e.pendingEffectiveContractYear != null);

  const pendingBuIds = [...new Set(empsPendingBuChange.map((e) => e.pendingBargainingUnitId!))];
  const pendingGroupIds = [...new Set(empsPendingGroupChange.map((e) => e.pendingEmployeeGroupId!))];

  // Load pending BU rows (for retirement/benefits config)
  const pendingBuRows = pendingBuIds.length > 0
    ? await db.select().from(bargainingUnitsTable).where(inArray(bargainingUnitsTable.id, pendingBuIds))
    : [];
  const pendingBuMap = new Map(pendingBuRows.map((u) => [u.id, u]));

  // Load pending group rows
  const pendingGroupRows = pendingGroupIds.length > 0
    ? await db.select().from(employeeGroupsTable).where(inArray(employeeGroupsTable.id, pendingGroupIds))
    : [];
  const pendingGroupMap = new Map(pendingGroupRows.map((g) => [g.id, g]));

  // Load pending BU schedules
  const pendingBuScheduleMap = new Map<string, SalaryScheduleData | null>();
  for (const buId of pendingBuIds) {
    pendingBuScheduleMap.set(buId, await loadScheduleForUnit(buId));
  }

  // Load pending BU year configs (raise rules) from this scenario's year config table
  const pendingBuYearConfigsMap = new Map<string, YearConfigWithSchedule[]>();
  for (const buId of pendingBuIds) {
    const dbPendingYearCfgs = buYearConfigs
      .filter((c) => c.bargainingUnitId === buId)
      .sort((a, b) => a.contractYear - b.contractYear);
    if (dbPendingYearCfgs.length > 0) {
      pendingBuYearConfigsMap.set(buId, toYearConfigs(dbPendingYearCfgs, scheduleTypeMap));
    }
  }

  // Load pending group year configs (raise rules) from this scenario's year config table
  const pendingGroupYearConfigsMap = new Map<string, YearConfigWithSchedule[]>();
  for (const groupId of pendingGroupIds) {
    const dbPendingYearCfgs = groupYearConfigs
      .filter((c) => c.employeeGroupId === groupId)
      .sort((a, b) => a.contractYear - b.contractYear);
    if (dbPendingYearCfgs.length > 0) {
      pendingGroupYearConfigsMap.set(groupId, toYearConfigs(dbPendingYearCfgs, scheduleTypeMap));
    }
  }

  function buildPendingBuConfig(buId: string): BargainingUnitConfig | null {
    const u = pendingBuMap.get(buId);
    if (!u) return null;
    return {
      id: u.id,
      compensationType: u.compensationType as "salary" | "hourly",
      retirementSystem: u.retirementSystem as "TRS" | "IMRF" | "other",
      retirementEmployeeRate: u.retirementEmployeeRate,
      retirementEmployerRate: u.retirementEmployerRate,
      retirementGrossUpRate: u.retirementGrossUpRate,
      ficaRate: u.ficaRate,
      ficaExempt: u.ficaExempt,
      healthInsuranceSingleAnnual: u.healthInsuranceSingleAnnual,
      healthInsuranceFamilyAnnual: u.healthInsuranceFamilyAnnual,
      dentalAnnual: u.dentalAnnual,
      lifeInsuranceAnnual: u.lifeInsuranceAnnual,
      disabilityInsuranceAnnual: u.disabilityInsuranceAnnual,
      hsaContributionSingle: u.hsaContributionSingle,
      hsaContributionFamily: u.hsaContributionFamily,
      workersCompRate: u.workersCompRate,
      contractYears: u.contractYears,
    };
  }

  function buildPendingGroupConfig(groupId: string): BargainingUnitConfig | null {
    const g = pendingGroupMap.get(groupId);
    if (!g) return null;
    return {
      id: g.id,
      compensationType: "salary",
      retirementSystem: (g.retirementSystem as "TRS" | "IMRF" | "other") ?? "TRS",
      retirementEmployeeRate: g.retirementEmployeeRate,
      retirementEmployerRate: g.retirementEmployerRate,
      retirementGrossUpRate: g.retirementGrossUpRate,
      ficaRate: g.ficaRate,
      ficaExempt: g.ficaExempt,
      healthInsuranceSingleAnnual: g.healthInsuranceSingleAnnual,
      healthInsuranceFamilyAnnual: g.healthInsuranceFamilyAnnual,
      dentalAnnual: g.dentalAnnual,
      lifeInsuranceAnnual: g.lifeInsuranceAnnual,
      disabilityInsuranceAnnual: g.disabilityInsuranceAnnual,
      hsaContributionSingle: g.hsaContributionSingle,
      hsaContributionFamily: g.hsaContributionFamily,
      workersCompRate: g.workersCompRate,
      contractYears: g.contractYears,
    };
  }

  // ── Multi-position: helpers ────────────────────────────────────────────────
  function totalFteFractionFor(positions: (typeof employeePositionsTable.$inferSelect)[]): string {
    return positions
      .reduce((sum, p) => sum.plus(p.fteFraction), new Decimal("0"))
      .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      .toString();
  }

  function benefitEligibleFor(positions: (typeof employeePositionsTable.$inferSelect)[]): boolean {
    return new Decimal(totalFteFractionFor(positions)).gte(benefitFteThreshold);
  }

  // ── Multi-position: per-employee aggregation function ─────────────────────
  /**
   * For an employee who has positions defined, run each position through the
   * salary engine (skip benefits), then aggregate salaries and compute benefits
   * once at the employee level from the primary position's group config.
   *
   * Returns aggregate EmployeeYearResults (for employee_year_records) and per-
   * position detail PositionYearResults (for employee_position_year_records).
   */
  function calcMultiPositionEmployee(
    employee: typeof employeesTable.$inferSelect,
    positions: (typeof employeePositionsTable.$inferSelect)[],
    empGroupConfig: BargainingUnitConfig | null, // employee's own group config (for fallback)
    employerCostConfig: EmployerCostConfig | null = null,
  ): { aggregateResults: EmployeeYearResult[]; positionResults: PositionYearResult[] } {
    const primaryPos = positions.find((p) => p.isPrimary) ?? positions[0];
    const primaryGroupId = primaryPos?.employeeGroupId ?? null;

    // Determine primary group config (for benefits rates)
    const primaryGroupConfig: BargainingUnitConfig | null =
      (primaryGroupId ? (posGroupConfigMap.get(primaryGroupId) ?? null) : null) ??
      empGroupConfig;

    // Determine total contract years from the longest position group config
    let totalContractYears = 1;
    for (const pos of positions) {
      if (!pos.employeeGroupId) continue;
      const yCfgs = posGroupYearConfigsMap.get(pos.employeeGroupId);
      if (yCfgs && yCfgs.length > totalContractYears) totalContractYears = yCfgs.length;
    }

    // Total FTE fraction (constant across years — positions don't change FTE during calc)
    const totalFteFraction = positions
      .reduce((sum, p) => sum.plus(p.fteFraction), new Decimal("0"))
      .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const benefitEligible = totalFteFraction.gte(benefitFteThreshold);

    const aggregateResults: EmployeeYearResult[] = [];
    const positionResults: PositionYearResult[] = [];

    for (let yearIdx = 0; yearIdx < totalContractYears; yearIdx++) {
      let aggregateSalary = new Decimal("0");

      for (const pos of positions) {
        const posGroupId = pos.employeeGroupId;
        const posYearConfigs = posGroupId ? (posGroupYearConfigsMap.get(posGroupId) ?? []) : [];
        const posGroupCfg = posGroupId ? (posGroupConfigMap.get(posGroupId) ?? empGroupConfig) : empGroupConfig;
        if (!posGroupCfg || posYearConfigs.length === 0) {
          // No year config for this position's group — carry salary flat
          const flatCents = Math.round(parseFloat(pos.currentAnnualSalary) * 100);
          aggregateSalary = aggregateSalary.plus(new Decimal(pos.currentAnnualSalary));
          positionResults.push({
            positionId: pos.id,
            employeeId: employee.id,
            scenarioId,
            contractYear: yearIdx,
            fteFraction: pos.fteFraction,
            projectedBaseSalaryCents: flatCents,
            projectedStep: pos.currentStep,
            projectedLaneId: pos.currentLaneId,
            projectedHourlyRate: null,
            retirementContributionCents: Math.round(
              parseFloat(pos.currentAnnualSalary) *
              parseFloat(posGroupCfg?.retirementGrossUpRate ?? "0") * 100
            ),
            ficaCostCents: 0,
            workersCompCents: 0,
            effectiveRate: null,
          });
          continue;
        }

        // Build a position-scoped EmployeeInput using position's own step/lane/salary
        const posEmpInput: EmployeeInput = {
          id: employee.id,
          compensationType: "salary",
          currentAnnualSalary: pos.currentAnnualSalary,
          currentStep: pos.currentStep,
          currentHourlyRate: pos.currentHourlyRate,
          annualHours: pos.annualHours,
          currentLaneId: pos.currentLaneId,
          currentHourlyCategoryId: null,
          insuranceElection: employee.insuranceElection as EmployeeInput["insuranceElection"],
          retirementEligible: employee.retirementEligible,
          retirementPlan: employee.retirementPlan,
          retirementTargetYear: employee.retirementTargetYear,
          yearsInDistrict: employee.yearsInDistrict,
          yearsTotalService: employee.yearsTotalService,
          contractYear: employee.contractYear,
          effectiveDate: employee.effectiveDate,
          terminationDate: employee.terminationDate,
          pendingEffectiveContractYear: null, // pending handled at employee level, not position level
          pendingBargainingUnitId: null,
          pendingEmployeeGroupId: null,
          pendingCurrentStep: null,
          pendingCurrentLaneId: null,
          pendingAnnualSalary: null,
        };

        const posSchedData = posGroupId ? (posGroupScheduleMap.get(posGroupId) ?? null) : null;

        // Run salary engine only (skipBenefits=true) for this position
        const posYearResults = calcEmployeeProjection(
          posEmpInput,
          posYearConfigs,
          posGroupCfg,
          null, // no old-style salary schedule for group positions
          scenarioId,
          posSchedData?.indexGridConfig ?? null,
          null, null, null,
          posSchedData?.salaryRanges ?? null,
          posSchedData?.importGridCells ?? null,
          true // skipBenefits
        );

        const posYearResult = posYearResults[yearIdx];
        if (!posYearResult) continue;

        const posSalary = new Decimal(posYearResult.projectedBaseSalary);
        aggregateSalary = aggregateSalary.plus(posSalary);

        // Per-position salary-based employer costs (all values in dollars, converted to cents at push)
        const grossUpRate = new Decimal(posGroupCfg.retirementGrossUpRate);
        const retDollars = posSalary.times(grossUpRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const SS_WAGE_BASE = new Decimal("176100");
        const FICA_RATE = new Decimal("0.0765");
        const MEDICARE_RATE = new Decimal("0.0145");
        let ficaDollars: Decimal;
        if (posGroupCfg.ficaExempt) {
          ficaDollars = posSalary.times(MEDICARE_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        } else {
          ficaDollars = posSalary.lte(SS_WAGE_BASE)
            ? posSalary.times(FICA_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            : SS_WAGE_BASE.times("0.062").plus(posSalary.times(MEDICARE_RATE)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        }
        const wcDollars = posSalary.times(posGroupCfg.workersCompRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        positionResults.push({
          positionId: pos.id,
          employeeId: employee.id,
          scenarioId,
          contractYear: yearIdx,
          fteFraction: pos.fteFraction,
          projectedBaseSalaryCents: toCents(posYearResult.projectedBaseSalary)!,
          projectedStep: posYearResult.projectedStep,
          projectedLaneId: posYearResult.projectedLaneId,
          projectedHourlyRate: posYearResult.projectedHourlyRate,
          retirementContributionCents: toCents(retDollars.toString())!,
          ficaCostCents: toCents(ficaDollars.toString())!,
          workersCompCents: toCents(wcDollars.toString())!,
          effectiveRate: posYearResult.effectiveRate,
        });
      }

      // Aggregate benefits at employee level
      // Use the primary position's group year config for health premium growth rates
      const primaryYearConfig = primaryGroupId
        ? (posGroupYearConfigsMap.get(primaryGroupId)?.[yearIdx] ?? null)
        : null;

      let aggregateBenefits: ReturnType<typeof calcBenefits> | null = null;
      if (primaryGroupConfig && primaryYearConfig) {
        const rawBenefits = calcBenefits(
          aggregateSalary,
          primaryGroupConfig,
          primaryYearConfig,
          yearIdx,
          employee.insuranceElection,
          new Decimal("1"),
          employerCostConfig
        );

        if (!benefitEligible) {
          // Zero out flat-dollar benefits; keep salary-based costs
          const ZERO = new Decimal("0");
          aggregateBenefits = {
            ...rawBenefits,
            healthInsuranceCost: ZERO,
            dentalCost: ZERO,
            disabilityCost: ZERO,
            hsaCost: ZERO,
            otherBenefitsCost: rawBenefits.workersCompCost.plus(rawBenefits.lifeCost),
            totalEmployerCost: aggregateSalary
              .plus(rawBenefits.retirementContribution)
              .plus(rawBenefits.ficaCost)
              .plus(rawBenefits.futaCost)
              .plus(rawBenefits.sutaCost)
              .plus(rawBenefits.workersCompCost)
              .plus(rawBenefits.lifeCost),
          };
        } else {
          aggregateBenefits = rawBenefits;
        }
      }

      const R = Decimal.ROUND_HALF_UP;
      aggregateResults.push({
        employeeId: employee.id,
        scenarioId,
        contractYear: yearIdx,
        projectedStep: primaryPos ? positionResults.find((p) => p.positionId === primaryPos.id && p.contractYear === yearIdx)?.projectedStep ?? null : null,
        projectedLaneId: primaryPos ? positionResults.find((p) => p.positionId === primaryPos.id && p.contractYear === yearIdx)?.projectedLaneId ?? null : null,
        projectedHourlyRate: null,
        projectedBaseSalary: aggregateSalary.toDecimalPlaces(2, R).toString(),
        projectedTotalCompensation: aggregateSalary.toDecimalPlaces(2, R).toString(),
        retirementContribution: aggregateBenefits?.retirementContribution.toDecimalPlaces(2, R).toString() ?? "0",
        ficaCost: aggregateBenefits?.ficaCost.toDecimalPlaces(2, R).toString() ?? "0",
        futaCost: aggregateBenefits?.futaCost.toDecimalPlaces(2, R).toString() ?? "0",
        sutaCost: aggregateBenefits?.sutaCost.toDecimalPlaces(2, R).toString() ?? "0",
        healthInsuranceCost: aggregateBenefits?.healthInsuranceCost.toDecimalPlaces(2, R).toString() ?? "0",
        otherBenefitsCost: aggregateBenefits?.otherBenefitsCost.toDecimalPlaces(2, R).toString() ?? "0",
        totalEmployerCost: aggregateBenefits?.totalEmployerCost.toDecimalPlaces(2, R).toString() ?? aggregateSalary.toDecimalPlaces(2, R).toString(),
        effectiveRate: null,
        isRetirementYear: false,
        retirementIncentiveAmount: null,
        projectedDailyRate: null,
        rangePosition: null,
        stipendTotalAmount: null,
        stipendBreakdown: null,
      });
    }

    return { aggregateResults, positionResults };
  }

  // Build set of employee IDs covered by group configs — these take precedence over BU configs
  // to prevent double-counting employees who belong to both a group and a BU.
  const groupCoveredEmployeeIds = new Set(groupEmployees.map((r) => r.employee.id));

  // Process bargaining-unit-based employees (skip those handled by an employee-group config)
  for (const bargainingUnitId of bargainingUnitIds) {
    const unitEmployees = allEmployees.filter(
      (r) => r.employee.bargainingUnitId === bargainingUnitId && !groupCoveredEmployeeIds.has(r.employee.id)
    );
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
    const buEmployerCostConfig = await loadEmployerCostConfig(scenario.districtId, null);

    for (const { employee } of unitEmployees) {
      const empPositions = positionsByEmployee.get(employee.id);
      if (empPositions && empPositions.length > 0) {
        // Multi-position path
        const { aggregateResults, positionResults } = calcMultiPositionEmployee(employee, empPositions, null);
        pushResults(aggregateResults, positionResults, totalFteFractionFor(empPositions), benefitEligibleFor(empPositions));
        continue;
      }
      // Legacy single-position path
      const empInput = buildEmpInput(employee);
      let pendingBuCfg: BargainingUnitConfig | null = null;
      let pendingScheduleData: SalaryScheduleData | null | undefined = undefined;
      let pendingYearCfgs: YearConfigWithSchedule[] | null = null;
      if (empInput.pendingBargainingUnitId) {
        pendingBuCfg = buildPendingBuConfig(empInput.pendingBargainingUnitId);
        pendingScheduleData = pendingBuScheduleMap.get(empInput.pendingBargainingUnitId) ?? null;
        pendingYearCfgs = pendingBuYearConfigsMap.get(empInput.pendingBargainingUnitId) ?? null;
      } else if (empInput.pendingEmployeeGroupId) {
        pendingBuCfg = buildPendingGroupConfig(empInput.pendingEmployeeGroupId);
        pendingScheduleData = null;
        pendingYearCfgs = pendingGroupYearConfigsMap.get(empInput.pendingEmployeeGroupId) ?? null;
      }
      const yearResults = calcEmployeeProjection(empInput, typedYearConfigs, buConfig, scheduleData, scenarioId, null, pendingBuCfg, pendingScheduleData, pendingYearCfgs, null, null, false, buEmployerCostConfig);
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
    const salaryRanges = primaryScheduleId && primaryScheduleType === "range_based"
      ? await loadSalaryRanges(primaryScheduleId)
      : null;

    // For individual_salary groups the salary schedule lives on the BU — load it via
    // the first employee's bargainingUnitId (all employees in a group share the same BU).
    const groupBuId = primaryScheduleType === "individual_salary"
      ? (groupEmps[0]?.employee.bargainingUnitId ?? null)
      : null;
    const groupScheduleData = groupBuId ? await loadScheduleForUnit(groupBuId) : null;

    // Load stipend definitions for this schedule and assignments for all employees in the group
    const stipendDefs: StipendDefinition[] = primaryScheduleId
      ? (await db
          .select()
          .from(stipendDefinitionsTable)
          .where(
            and(
              eq(stipendDefinitionsTable.compensationScheduleId, primaryScheduleId),
              eq(stipendDefinitionsTable.active, true)
            )
          )).map((d) => ({
            id: d.id,
            name: d.name,
            category: d.category,
            amountType: d.amountType as StipendDefinition["amountType"],
            amountCents: d.amountCents,
            percentageValue: d.percentageValue,
            maxAmountCents: d.maxAmountCents ?? null,
            increaseWithBase: d.increaseWithBase,
            trsCreditable: d.trsCreditable,
            imrfCreditable: d.imrfCreditable,
          }))
      : [];

    const groupEmpIds = groupEmps.map((r) => r.employee.id);
    const stipendAssignmentRows = stipendDefs.length > 0 && groupEmpIds.length > 0
      ? await db
          .select()
          .from(employeeStipendsTable)
          .where(inArray(employeeStipendsTable.employeeId, groupEmpIds))
      : [];

    // Load per-diem secondary schedule for this group if present
    const perDiemScheduleRow = await db
      .select()
      .from(compensationSchedulesTable)
      .where(
        and(
          eq(compensationSchedulesTable.employeeGroupId, employeeGroupId),
          eq(compensationSchedulesTable.active, true)
        )
      )
      .then((rows) => rows.find((r) => r.scheduleType === "per_diem") ?? null);

    let perDiemConfig: PerDiemConfig | null = null;
    let perDiemCaps: PerDiemCap[] = [];

    if (perDiemScheduleRow) {
      const perDiemConfigRow = await db
        .select()
        .from(perDiemConfigsTable)
        .where(eq(perDiemConfigsTable.compensationScheduleId, perDiemScheduleRow.id))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (perDiemConfigRow) {
        perDiemConfig = {
          compensationScheduleId: perDiemScheduleRow.id,
          sourceScheduleId: perDiemConfigRow.sourceScheduleId ?? null,
          contractDays: perDiemConfigRow.contractDays,
          derivationMethod: perDiemConfigRow.derivationMethod as PerDiemConfig["derivationMethod"],
        };
        perDiemCaps = (
          await db
            .select()
            .from(perDiemCapsTable)
            .where(eq(perDiemCapsTable.compensationScheduleId, perDiemScheduleRow.id))
        ).map((c) => ({
          laneId: c.laneId,
          capStep: c.capStep,
          capRateCents: c.capRateCents,
        }));
      }
    }

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

    const groupEmployerCostConfig = await loadEmployerCostConfig(scenario.districtId, employeeGroupId);

    for (const { employee } of groupEmps) {
      const empPositions = positionsByEmployee.get(employee.id);
      if (empPositions && empPositions.length > 0) {
        const { aggregateResults, positionResults } = calcMultiPositionEmployee(employee, empPositions, buConfig, groupEmployerCostConfig);
        pushResults(aggregateResults, positionResults, totalFteFractionFor(empPositions), benefitEligibleFor(empPositions));
        continue;
      }
      // Legacy single-position path
      const empInput = buildEmpInput(employee);
      let pendingBuCfg: BargainingUnitConfig | null = null;
      let pendingScheduleData: SalaryScheduleData | null | undefined = undefined;
      let pendingYearCfgs: YearConfigWithSchedule[] | null = null;
      if (empInput.pendingBargainingUnitId) {
        pendingBuCfg = buildPendingBuConfig(empInput.pendingBargainingUnitId);
        pendingScheduleData = pendingBuScheduleMap.get(empInput.pendingBargainingUnitId) ?? null;
        pendingYearCfgs = pendingBuYearConfigsMap.get(empInput.pendingBargainingUnitId) ?? null;
      } else if (empInput.pendingEmployeeGroupId) {
        pendingBuCfg = buildPendingGroupConfig(empInput.pendingEmployeeGroupId);
        pendingScheduleData = null;
        pendingYearCfgs = pendingGroupYearConfigsMap.get(empInput.pendingEmployeeGroupId) ?? null;
      }
      let finalResults = calcEmployeeProjection(empInput, typedYearConfigs, buConfig, groupScheduleData, scenarioId, indexGridConfig, pendingBuCfg, pendingScheduleData, pendingYearCfgs, salaryRanges, null, false, groupEmployerCostConfig);

      // Pass 1: per-diem daily rate (secondary schedule — sets projectedDailyRate only)
      if (perDiemConfig) {
        finalResults = finalResults.map((yr) => {
          const primarySalary = new Decimal(yr.projectedBaseSalary);
          const perDiemResult = calcPerDiemEmployeeYear(
            empInput,
            yr.contractYear,
            (typedYearConfigs[yr.contractYear] ?? typedYearConfigs[0]) as import("./types.js").YearConfigWithSchedule,
            perDiemConfig!,
            perDiemCaps,
            primarySalary,
            empInput.currentLaneId ?? null,
            yr.projectedStep,
            new Decimal("1")
          );
          return { ...yr, projectedDailyRate: perDiemResult.dailyRate.toString() };
        });
      }

      // Pass 2: stipends (additive to primary base salary, modifies totals)
      const empStipendRows = stipendAssignmentRows.filter((s) => s.employeeId === empInput.id);
      if (empStipendRows.length > 0 && stipendDefs.length > 0) {
        finalResults = finalResults.map((yr) => {
          const activeAssignments = empStipendRows
            .filter((s) => s.effectiveYear <= yr.contractYear)
            .map((s) => ({
              stipendDefinitionId: s.stipendDefinitionId,
              overrideAmountCents: s.overrideAmountCents ?? null,
              hoursOrEvents: s.hoursOrEvents != null ? parseFloat(s.hoursOrEvents) : null,
            }));
          if (activeAssignments.length === 0) return yr;

          const baseSalary = new Decimal(yr.projectedBaseSalary);
          const baseIncreaseRate = yr.effectiveRate ? new Decimal(yr.effectiveRate) : null;

          const stipendResult = calcEmployeeStipends(
            activeAssignments,
            stipendDefs,
            baseSalary,
            yr.contractYear,
            baseIncreaseRate
          );

          const stipendTotal = stipendResult.totalStipendAmount;
          const additionalRetirement = stipendResult.trsCreditable
            .plus(stipendResult.imrfCreditable)
            .times(new Decimal(buConfig.retirementGrossUpRate))
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          return {
            ...yr,
            projectedTotalCompensation: baseSalary
              .plus(stipendTotal)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              .toString(),
            retirementContribution: new Decimal(yr.retirementContribution)
              .plus(additionalRetirement)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              .toString(),
            totalEmployerCost: new Decimal(yr.totalEmployerCost)
              .plus(stipendTotal)
              .plus(additionalRetirement)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
              .toString(),
            stipendTotalAmount: stipendTotal.toString(),
            stipendBreakdown: stipendResult.breakdown.map((b) => ({
              stipendId: b.stipendId,
              stipendName: b.stipendName,
              amount: b.amount.toString(),
            })),
          };
        });
      }

      pushResults(finalResults);
    }
  }

  await db.delete(employeeYearRecordsTable).where(eq(employeeYearRecordsTable.scenarioId, scenarioId));
  await db.delete(employeePositionYearRecordsTable).where(eq(employeePositionYearRecordsTable.scenarioId, scenarioId));

  const savedRecords: (typeof employeeYearRecordsTable.$inferSelect)[] = [];
  if (allYearRecords.length > 0) {
    // Strip internal _* fields before inserting
    const chunkSize = 500;
    for (let i = 0; i < allYearRecords.length; i += chunkSize) {
      const chunk = allYearRecords.slice(i, i + chunkSize).map(({ _positionResults: _pr, _totalFteFraction: _tf, _benefitEligible: _be, ...rest }) => rest);
      const inserted = await db.insert(employeeYearRecordsTable).values(chunk).returning();
      savedRecords.push(...inserted);
    }
  }

  // Insert employee_position_year_records using the returned aggregate record IDs
  if (savedRecords.length > 0) {
    // Build lookup: (employeeId, contractYear) → aggregate record id
    const aggregateLookup = new Map<string, string>();
    for (const rec of savedRecords) {
      aggregateLookup.set(`${rec.employeeId}:${rec.contractYear}`, rec.id);
    }

    // Collect all position year records from the _positionResults metadata
    for (const rec of allYearRecords) {
      if (!rec._positionResults?.length) continue;
      const aggregateId = aggregateLookup.get(`${rec.employeeId}:${rec.contractYear}`);
      if (!aggregateId) continue;
      for (const pr of rec._positionResults) {
        allPositionYearRecords.push({
          employeeYearRecordId: aggregateId,
          positionId: pr.positionId,
          scenarioId: pr.scenarioId,
          employeeId: pr.employeeId,
          contractYear: pr.contractYear,
          fteFraction: pr.fteFraction,
          projectedBaseSalaryCents: pr.projectedBaseSalaryCents,
          projectedStep: pr.projectedStep,
          projectedLaneId: pr.projectedLaneId,
          projectedHourlyRate: pr.projectedHourlyRate,
          retirementContributionCents: pr.retirementContributionCents,
          ficaCostCents: pr.ficaCostCents,
          workersCompCents: pr.workersCompCents,
          effectiveRate: pr.effectiveRate,
        });
      }
    }

    if (allPositionYearRecords.length > 0) {
      const posChunkSize = 500;
      for (let i = 0; i < allPositionYearRecords.length; i += posChunkSize) {
        await db.insert(employeePositionYearRecordsTable).values(allPositionYearRecords.slice(i, i + posChunkSize));
      }
    }
  }

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
        .filter((r) => r.employee.bargainingUnitId === bargainingUnitId && !groupCoveredEmployeeIds.has(r.employee.id))
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
        projectedDailyRate: fromCents(r.projectedDailyRateCents ?? null),
        stipendTotalAmount: fromCents(r.stipendTotalCents ?? null),
        rangePosition: r.rangePosition ?? null,
        stipendBreakdown: null,
      })),
      typedConfigs,
      bargainingUnitId,
      retirementSystem
    );

    allYearSummaries.push(...summaries.map((s) => ({ ...s, bargainingUnitName: unit?.name ?? null })));
  }

  // Add employee-group summaries to the district totals
  const employeeGroupsForSummary = employeeGroupIds.length > 0
    ? await db.select().from(employeeGroupsTable).where(inArray(employeeGroupsTable.id, employeeGroupIds))
    : [];

  for (const employeeGroupId of employeeGroupIds) {
    const groupData = employeeGroupsForSummary.find((g) => g.id === employeeGroupId);
    const dbYearConfigs = groupYearConfigs
      .filter((c) => c.employeeGroupId === employeeGroupId)
      .sort((a, b) => a.contractYear - b.contractYear);
    const typedConfigs = toYearConfigs(dbYearConfigs, scheduleTypeMap);

    const groupEmployeeIds = new Set(
      groupEmployees
        .filter((r) => r.employee.employeeGroupId === employeeGroupId)
        .map((r) => r.employee.id)
    );
    const groupRecords = savedRecords.filter((r) => groupEmployeeIds.has(r.employeeId));

    const fromCents = (c: number | null) => c != null ? (c / 100).toFixed(2) : null;
    const retirementSystem = (groupData?.retirementSystem as "TRS" | "IMRF" | "other") ?? "TRS";
    const summaries = calcScenarioSummary(
      groupRecords.map((r): EmployeeYearResult => ({
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
        projectedDailyRate: fromCents(r.projectedDailyRateCents ?? null),
        stipendTotalAmount: fromCents(r.stipendTotalCents ?? null),
        rangePosition: r.rangePosition ?? null,
        stipendBreakdown: null,
      })),
      typedConfigs,
      employeeGroupId,
      retirementSystem
    );

    allYearSummaries.push(...summaries.map((s) => ({
      ...s,
      bargainingUnitName: groupData?.name ?? null,
      employeeGroupId,
    })));
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
