import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  scenariosTable,
  scenarioYearConfigsTable,
  employeeYearRecordsTable,
  employeesTable,
  bargainingUnitsTable,
  salarySchedulesTable,
  lanesTable,
  stepsTable,
  scheduleCellsTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { calcEmployeeProjection, calcScenarioSummary } from "../lib/calculations/scenario-engine";
import type {
  YearConfig,
  EmployeeInput,
  BargainingUnitConfig,
  SalaryScheduleData,
  ScheduleCell,
  EmployeeYearResult,
} from "../lib/calculations/types";

const yearConfigSchema = z.object({
  bargainingUnitId: z.string().uuid(),
  contractYear: z.number().int().min(0),
  yearLabel: z.string().min(1),
  increaseType: z.enum(["fixed_percentage", "cpi_formula", "flat_dollar", "step_only", "custom"]),
  fixedPercentage: z.string().nullable().optional(),
  cpiValue: z.string().nullable().optional(),
  cpiAdder: z.string().nullable().optional(),
  cpiCap: z.string().nullable().optional(),
  cpiFloor: z.string().nullable().optional(),
  cpiIndexName: z.string().nullable().optional(),
  highEarnerThreshold: z.string().nullable().optional(),
  highEarnerFlatIncrease: z.string().nullable().optional(),
  educationalAdvancementBa15: z.string().nullable().optional(),
  educationalAdvancementMa: z.string().nullable().optional(),
  educationalAdvancementMa15: z.string().nullable().optional(),
  stepAdvancement: z.boolean().optional(),
  healthPremiumIncreaseRate: z.string().nullable().optional(),
  healthEmployerCapRate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const createScenarioSchema = z.object({
  districtId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  yearConfigs: z.array(yearConfigSchema).optional(),
});

const updateScenarioSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "final", "archived"]).optional(),
  yearConfigs: z.array(yearConfigSchema).optional(),
});

const router = Router();

type YearConfigInput = {
  bargainingUnitId: string;
  contractYear: number;
  yearLabel: string;
  increaseType: string;
  fixedPercentage?: string | null;
  cpiValue?: string | null;
  cpiAdder?: string | null;
  cpiCap?: string | null;
  cpiFloor?: string | null;
  cpiIndexName?: string | null;
  highEarnerThreshold?: string | null;
  highEarnerFlatIncrease?: string | null;
  educationalAdvancementBa15?: string | null;
  educationalAdvancementMa?: string | null;
  educationalAdvancementMa15?: string | null;
  stepAdvancement?: boolean;
  healthPremiumIncreaseRate?: string | null;
  healthEmployerCapRate?: string | null;
  notes?: string | null;
};

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

router.get("/scenarios", async (req, res) => {
  const { districtId } = req.query;
  const scenarios = districtId
    ? await db
        .select()
        .from(scenariosTable)
        .where(eq(scenariosTable.districtId, districtId as string))
        .orderBy(scenariosTable.updatedAt)
    : await db.select().from(scenariosTable).orderBy(scenariosTable.updatedAt);
  res.json(scenarios);
});

router.post("/scenarios", async (req, res) => {
  const parsed = createScenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { districtId, name, description, yearConfigs } = parsed.data;

  const [scenario] = await db
    .insert(scenariosTable)
    .values({ districtId, name, description })
    .returning();

  if (yearConfigs?.length) {
    const configsToInsert = (yearConfigs as YearConfigInput[]).map((c) => ({
      scenarioId: scenario.id,
      bargainingUnitId: c.bargainingUnitId,
      contractYear: c.contractYear,
      yearLabel: c.yearLabel,
      increaseType: c.increaseType as "fixed_percentage" | "cpi_formula" | "flat_dollar" | "step_only" | "custom",
      fixedPercentage: c.fixedPercentage ?? null,
      cpiValue: c.cpiValue ?? null,
      cpiAdder: c.cpiAdder ?? null,
      cpiCap: c.cpiCap ?? null,
      cpiFloor: c.cpiFloor ?? null,
      cpiIndexName: c.cpiIndexName ?? null,
      highEarnerThreshold: c.highEarnerThreshold ?? null,
      highEarnerFlatIncrease: c.highEarnerFlatIncrease ?? null,
      educationalAdvancementBa15: c.educationalAdvancementBa15 ?? null,
      educationalAdvancementMa: c.educationalAdvancementMa ?? null,
      educationalAdvancementMa15: c.educationalAdvancementMa15 ?? null,
      stepAdvancement: c.stepAdvancement ?? true,
      healthPremiumIncreaseRate: c.healthPremiumIncreaseRate ?? null,
      healthEmployerCapRate: c.healthEmployerCapRate ?? null,
      notes: c.notes ?? null,
    }));
    await db.insert(scenarioYearConfigsTable).values(configsToInsert);
  }

  const result = await getScenarioWithConfigs(scenario.id);
  res.status(201).json(result);
});

router.get("/scenarios/compare", async (req, res) => {
  const { ids } = req.query;
  if (!ids) {
    res.status(400).json({ error: "ids query param is required" });
    return;
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const scenarioIds = (ids as string)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s));
  if (scenarioIds.length === 0) {
    res.status(400).json({ error: "No valid scenario IDs provided" });
    return;
  }

  // Read-only compare: uses pre-computed employee_year_records (call POST /calculate first)
  const results = await Promise.all(
    scenarioIds.map((id) => getScenarioWithConfigs(id))
  );
  const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);

  if (validResults.length === 0) {
    res.status(404).json({ error: "No valid scenarios found for the provided IDs" });
    return;
  }

  // Sum totalFiveYearCost from pre-computed records for each scenario
  const fiveYearCosts = await Promise.all(
    validResults.map(async (s) => {
      const rows = await db
        .select({ totalEmployerCostCents: employeeYearRecordsTable.totalEmployerCostCents })
        .from(employeeYearRecordsTable)
        .where(eq(employeeYearRecordsTable.scenarioId, s.id));
      const totalCents = rows.reduce(
        (sum, r) => sum + (r.totalEmployerCostCents ?? 0),
        0
      );
      const total = new Decimal(totalCents).dividedBy(100);
      return { id: s.id, name: s.name, cost: total };
    })
  );

  const validCosts = fiveYearCosts.filter((f) => f.cost.gt(0));
  if (validCosts.length === 0) {
    res.status(422).json({
      error: "No pre-computed records found. Run POST /scenarios/:id/calculate for each scenario first.",
    });
    return;
  }

  const cheapest = validCosts.reduce((min, c) => (c.cost.lt(min.cost) ? c : min));
  const mostExpensive = validCosts.reduce((max, c) => (c.cost.gt(max.cost) ? c : max));

  const delta =
    validCosts.length >= 2
      ? mostExpensive.cost.minus(cheapest.cost).toDecimalPlaces(2).toString()
      : null;

  res.json({
    scenarios: validResults,
    fiveYearSummary: fiveYearCosts.map((f) => ({
      scenarioId: f.id,
      name: f.name,
      totalFiveYearCost: f.cost.toDecimalPlaces(2).toString(),
    })),
    cheapestScenarioId: cheapest.id,
    mostExpensiveScenarioId: mostExpensive.id,
    maxDeltaFiveYear: delta,
  });
});

router.get("/scenarios/:id", async (req, res) => {
  const result = await getScenarioWithConfigs(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.json(result);
});

router.put("/scenarios/:id", async (req, res) => {
  const parsed = updateScenarioSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { name, description, status, yearConfigs } = parsed.data;
  const updated = await db
    .update(scenariosTable)
    .set({ name, description, status, updatedAt: new Date() })
    .where(eq(scenariosTable.id, req.params.id))
    .returning();

  if (!updated[0]) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  if (yearConfigs?.length) {
    await db
      .delete(scenarioYearConfigsTable)
      .where(eq(scenarioYearConfigsTable.scenarioId, req.params.id));

    const configsToInsert = (yearConfigs as YearConfigInput[]).map((c) => ({
      scenarioId: req.params.id,
      bargainingUnitId: c.bargainingUnitId,
      contractYear: c.contractYear,
      yearLabel: c.yearLabel,
      increaseType: c.increaseType as "fixed_percentage" | "cpi_formula" | "flat_dollar" | "step_only" | "custom",
      fixedPercentage: c.fixedPercentage ?? null,
      cpiValue: c.cpiValue ?? null,
      cpiAdder: c.cpiAdder ?? null,
      cpiCap: c.cpiCap ?? null,
      cpiFloor: c.cpiFloor ?? null,
      cpiIndexName: c.cpiIndexName ?? null,
      highEarnerThreshold: c.highEarnerThreshold ?? null,
      highEarnerFlatIncrease: c.highEarnerFlatIncrease ?? null,
      educationalAdvancementBa15: c.educationalAdvancementBa15 ?? null,
      educationalAdvancementMa: c.educationalAdvancementMa ?? null,
      educationalAdvancementMa15: c.educationalAdvancementMa15 ?? null,
      stepAdvancement: c.stepAdvancement ?? true,
      healthPremiumIncreaseRate: c.healthPremiumIncreaseRate ?? null,
      healthEmployerCapRate: c.healthEmployerCapRate ?? null,
      notes: c.notes ?? null,
    }));
    await db.insert(scenarioYearConfigsTable).values(configsToInsert);
  }

  const result = await getScenarioWithConfigs(req.params.id);
  res.json(result);
});

router.delete("/scenarios/:id", async (req, res) => {
  await db.delete(scenariosTable).where(eq(scenariosTable.id, req.params.id));
  res.status(204).send();
});

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

function toYearConfigs(dbConfigs: (typeof scenarioYearConfigsTable.$inferSelect)[]): YearConfig[] {
  return dbConfigs.map((c) => ({
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
  }));
}

async function runCalculation(scenarioId: string) {
  const scenario = await getScenarioWithConfigs(scenarioId);
  if (!scenario) return null;

  const bargainingUnitIds = [...new Set(scenario.yearConfigs.map((c) => c.bargainingUnitId))];

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

  const allYearRecords: (typeof employeeYearRecordsTable.$inferInsert)[] = [];

  for (const bargainingUnitId of bargainingUnitIds) {
    const unitEmployees = allEmployees.filter((r) => r.employee.bargainingUnitId === bargainingUnitId);
    if (unitEmployees.length === 0) continue;

    const unitConfig = unitEmployees.find((r) => r.unit)?.unit;
    if (!unitConfig) continue;

    const dbYearConfigs = scenario.yearConfigs
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

    const typedYearConfigs = toYearConfigs(dbYearConfigs);
    const scheduleData = await loadScheduleForUnit(bargainingUnitId);

    for (const { employee } of unitEmployees) {
      const empInput: EmployeeInput = {
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

      const yearResults = calcEmployeeProjection(empInput, typedYearConfigs, buConfig, scheduleData, scenarioId);
      for (const r of yearResults) {
        const toCents = (s: string | null) => s ? Math.round(parseFloat(s) * 100) : null;
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
    const dbYearConfigs = scenario.yearConfigs
      .filter((c) => c.bargainingUnitId === bargainingUnitId)
      .sort((a, b) => a.contractYear - b.contractYear);
    const typedConfigs = toYearConfigs(dbYearConfigs);

    const unitEmployeeIds = new Set(
      allEmployees
        .filter((r) => r.employee.bargainingUnitId === bargainingUnitId)
        .map((r) => r.employee.id)
    );
    const unitRecords = savedRecords.filter((r) => unitEmployeeIds.has(r.employeeId));

    const fromCents = (c: number | null) => c != null ? (c / 100).toFixed(2) : null;
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
      bargainingUnitId
    );

    allYearSummaries.push(...summaries.map((s) => ({ ...s, bargainingUnitName: unit?.name ?? null })));
  }

  const districtWideSummary = groupDistrictWide(allYearSummaries);

  const totalFiveYearCost = districtWideSummary
    .reduce((sum, y) => sum.plus(y.totalEmployerCost), new Decimal("0"))
    .toDecimalPlaces(2)
    .toString();

  const employeeCount = [...new Set(savedRecords.map((r) => r.employeeId))].length;

  return { scenarioId, scenarioName: scenario.name, status: scenario.status, yearSummaries: allYearSummaries, districtWideSummary, totalFiveYearCost, employeeCount };
}

function groupDistrictWide(yearSummaries: Array<{ contractYear: number; yearLabel: string; totalPayroll: string; totalBenefits: string; totalEmployerCost: string; employeeCount: number }>) {
  const yearMap = new Map<number, { contractYear: number; yearLabel: string; totalPayroll: Decimal; totalBenefits: Decimal; totalEmployerCost: Decimal; employeeCount: number }>();

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

router.post("/scenarios/:id/calculate", async (req, res) => {
  const result = await runCalculation(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.json(result);
});

router.post("/scenarios/:id/apply", async (req, res) => {
  const result = await runCalculation(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  // Fetch the scenario to get its districtId (ensures cross-district isolation)
  const [scenario] = await db
    .select({ districtId: scenariosTable.districtId })
    .from(scenariosTable)
    .where(eq(scenariosTable.id, req.params.id));

  if (!scenario) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  // Mark this scenario as final
  await db
    .update(scenariosTable)
    .set({ isFinal: true, status: "final", updatedAt: new Date() })
    .where(eq(scenariosTable.id, req.params.id));

  // Un-mark any other final scenario in the SAME district only
  await db
    .update(scenariosTable)
    .set({ isFinal: false })
    .where(
      and(
        eq(scenariosTable.districtId, scenario.districtId),
        eq(scenariosTable.isFinal, true),
        sql`${scenariosTable.id} != ${req.params.id}`
      )
    );

  res.json(result);
});

router.post("/scenarios/:id/year-configs", async (req, res) => {
  const yearConfigs = req.body;
  if (!Array.isArray(yearConfigs)) {
    res.status(400).json({ error: "Request body must be an array of year configs" });
    return;
  }

  await db
    .delete(scenarioYearConfigsTable)
    .where(eq(scenarioYearConfigsTable.scenarioId, req.params.id));

  const configsToInsert = (yearConfigs as YearConfigInput[]).map((c) => ({
    scenarioId: req.params.id,
    bargainingUnitId: c.bargainingUnitId,
    contractYear: c.contractYear,
    yearLabel: c.yearLabel,
    increaseType: c.increaseType as "fixed_percentage" | "cpi_formula" | "flat_dollar" | "step_only" | "custom",
    fixedPercentage: c.fixedPercentage ?? null,
    cpiValue: c.cpiValue ?? null,
    cpiAdder: c.cpiAdder ?? null,
    cpiCap: c.cpiCap ?? null,
    cpiFloor: c.cpiFloor ?? null,
    cpiIndexName: c.cpiIndexName ?? null,
    highEarnerThreshold: c.highEarnerThreshold ?? null,
    highEarnerFlatIncrease: c.highEarnerFlatIncrease ?? null,
    educationalAdvancementBa15: c.educationalAdvancementBa15 ?? null,
    educationalAdvancementMa: c.educationalAdvancementMa ?? null,
    educationalAdvancementMa15: c.educationalAdvancementMa15 ?? null,
    stepAdvancement: c.stepAdvancement ?? true,
    healthPremiumIncreaseRate: c.healthPremiumIncreaseRate ?? null,
    healthEmployerCapRate: c.healthEmployerCapRate ?? null,
    notes: c.notes ?? null,
  }));

  const inserted = await db.insert(scenarioYearConfigsTable).values(configsToInsert).returning();
  res.json(inserted);
});

router.get("/scenarios/:id/summary", async (req, res) => {
  const result = await runCalculation(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.json(result);
});

export default router;
