import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  scenariosTable,
  scenarioYearConfigsTable,
  employeeYearRecordsTable,
  bargainingUnitsTable,
  employeeGroupsTable,
  compensationSchedulesTable,
  districtsTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { runScenarioCalculation } from "@workspace/calc-engine";
import type { YearConfig, YearConfigWithSchedule } from "@workspace/calc-engine";

const yearConfigSchema = z.object({
  bargainingUnitId: z.string().uuid().nullable().optional(),
  employeeGroupId: z.string().uuid().nullable().optional(),
  compensationScheduleId: z.string().uuid().nullable().optional(),
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
  baseAdjustmentType: z.enum(["percentage", "dollar", "set_directly"]).nullable().optional(),
  baseAdjustmentValue: z.string().nullable().optional(),
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
  bargainingUnitId?: string | null;
  employeeGroupId?: string | null;
  compensationScheduleId?: string | null;
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
  baseAdjustmentType?: "percentage" | "dollar" | "set_directly" | null;
  baseAdjustmentValue?: string | null;
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

function buildYearLabel(baseYear: number, offset: number): string {
  return `${baseYear + offset}-${baseYear + offset + 1}`;
}

function extractFiscalYear(fiscalYearStart: string | null | undefined): number {
  if (!fiscalYearStart) return new Date().getFullYear();
  const match = fiscalYearStart.match(/\b(19|20)\d{2}\b/);
  if (match) return parseInt(match[0], 10);
  return new Date().getFullYear();
}

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
      bargainingUnitId: c.bargainingUnitId ?? undefined,
      employeeGroupId: c.employeeGroupId ?? undefined,
      compensationScheduleId: c.compensationScheduleId ?? undefined,
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
      baseAdjustmentType: c.baseAdjustmentType ?? null,
      baseAdjustmentValue: c.baseAdjustmentValue ?? null,
      notes: c.notes ?? null,
    }));
    await db.insert(scenarioYearConfigsTable).values(configsToInsert as any);
  } else {
    // Auto-generate year configs for all bargaining units + employee groups in the district
    const [district, units, employeeGroups] = await Promise.all([
      db.select().from(districtsTable).where(eq(districtsTable.id, districtId)).then((r) => r[0]),
      db.select().from(bargainingUnitsTable).where(eq(bargainingUnitsTable.districtId, districtId)),
      db.select().from(employeeGroupsTable).where(eq(employeeGroupsTable.districtId, districtId)),
    ]);

    // Derive base fiscal year robustly — handles ISO ("2026-07-01") and text ("July 1") formats
    const baseYear = extractFiscalYear(district?.fiscalYearStart);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allAutoConfigs: any[] = [];

    if (units.length > 0) {
      const buConfigs = units.flatMap((unit) => {
        const numYears = unit.contractYears && unit.contractYears > 0 ? unit.contractYears : 5;
        return Array.from({ length: numYears }, (_, i) => ({
          scenarioId: scenario.id,
          bargainingUnitId: unit.id,
          contractYear: i,
          yearLabel: buildYearLabel(baseYear, i),
          increaseType: "fixed_percentage" as const,
          fixedPercentage: "0",
          stepAdvancement: true,
          cpiValue: null,
          cpiAdder: null,
          cpiCap: null,
          cpiFloor: null,
          cpiIndexName: null,
          highEarnerThreshold: null,
          highEarnerFlatIncrease: null,
          educationalAdvancementBa15: null,
          educationalAdvancementMa: null,
          educationalAdvancementMa15: null,
          healthPremiumIncreaseRate: null,
          healthEmployerCapRate: null,
          notes: null,
        }));
      });
      allAutoConfigs.push(...buConfigs);
    }

    if (employeeGroups.length > 0) {
      // Load primary compensation schedules for each group
      const primarySchedules = await db
        .select()
        .from(compensationSchedulesTable)
        .where(
          and(
            inArray(
              compensationSchedulesTable.employeeGroupId,
              employeeGroups.map((g) => g.id)
            ),
            eq(compensationSchedulesTable.isPrimary, true)
          )
        );

      const groupConfigs = employeeGroups.flatMap((group) => {
        const primarySchedule = primarySchedules.find(
          (s) => s.employeeGroupId === group.id
        );
        const numYears = group.contractYears && group.contractYears > 0 ? group.contractYears : 5;
        const scheduleType = primarySchedule?.scheduleType ?? null;

        return Array.from({ length: numYears }, (_, i) => ({
          scenarioId: scenario.id,
          employeeGroupId: group.id,
          compensationScheduleId: primarySchedule?.id ?? undefined,
          contractYear: i,
          yearLabel: buildYearLabel(baseYear, i),
          increaseType: "fixed_percentage" as const,
          fixedPercentage: "0",
          stepAdvancement: true,
          baseAdjustmentType:
            scheduleType === "index_based_grid" ? ("percentage" as const) : null,
          baseAdjustmentValue: scheduleType === "index_based_grid" ? "0" : null,
          cpiValue: null,
          cpiAdder: null,
          cpiCap: null,
          cpiFloor: null,
          cpiIndexName: null,
          highEarnerThreshold: null,
          highEarnerFlatIncrease: null,
          educationalAdvancementBa15: null,
          educationalAdvancementMa: null,
          educationalAdvancementMa15: null,
          healthPremiumIncreaseRate: null,
          healthEmployerCapRate: null,
          notes: null,
        }));
      });
      allAutoConfigs.push(...groupConfigs);
    }

    if (allAutoConfigs.length > 0) {
      await db.insert(scenarioYearConfigsTable).values(allAutoConfigs as any);
    }
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

  // Load pre-computed records for all scenarios in one batch
  const allRecords = await db
    .select({
      scenarioId: employeeYearRecordsTable.scenarioId,
      contractYear: employeeYearRecordsTable.contractYear,
      projectedBaseSalaryCents: employeeYearRecordsTable.projectedBaseSalaryCents,
      totalEmployerCostCents: employeeYearRecordsTable.totalEmployerCostCents,
    })
    .from(employeeYearRecordsTable)
    .where(inArray(employeeYearRecordsTable.scenarioId, scenarioIds));

  if (allRecords.length === 0) {
    res.status(422).json({
      error: "No pre-computed records found. Run POST /scenarios/:id/calculate for each scenario first.",
    });
    return;
  }

  // Aggregate five-year totals per scenario
  const fiveYearCosts = validResults.map((s) => {
    const rows = allRecords.filter((r) => r.scenarioId === s.id);
    const totalCents = rows.reduce((sum, r) => sum + (r.totalEmployerCostCents ?? 0), 0);
    const total = new Decimal(totalCents).dividedBy(100);
    return { id: s.id, name: s.name, cost: total };
  });

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

  // Build year-by-year aligned comparison: for each contract year, one entry per scenario
  const allYears = [...new Set(allRecords.map((r) => r.contractYear))].sort((a, b) => a - b);
  const byYear = allYears.map((contractYear) => {
    const yearLabel = validResults[0]?.yearConfigs?.find((c) => c.contractYear === contractYear)?.yearLabel
      ?? `Year ${contractYear}`;
    return {
      contractYear,
      yearLabel,
      scenarios: validResults.map((s) => {
        const yearRows = allRecords.filter((r) => r.scenarioId === s.id && r.contractYear === contractYear);
        const payrollCents = yearRows.reduce((sum, r) => sum + (r.projectedBaseSalaryCents ?? 0), 0);
        const costCents = yearRows.reduce((sum, r) => sum + (r.totalEmployerCostCents ?? 0), 0);
        return {
          scenarioId: s.id,
          name: s.name,
          totalPayroll: new Decimal(payrollCents).dividedBy(100).toDecimalPlaces(2).toString(),
          totalEmployerCost: new Decimal(costCents).dividedBy(100).toDecimalPlaces(2).toString(),
          employeeCount: yearRows.length,
        };
      }),
    };
  });

  res.json({
    scenarios: validResults.map((s) => ({ id: s.id, name: s.name, status: s.status, isFinal: s.isFinal })),
    fiveYearSummary: fiveYearCosts.map((f) => ({
      scenarioId: f.id,
      name: f.name,
      totalFiveYearCost: f.cost.toDecimalPlaces(2).toString(),
    })),
    byYear,
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
      bargainingUnitId: c.bargainingUnitId ?? undefined,
      employeeGroupId: c.employeeGroupId ?? undefined,
      compensationScheduleId: c.compensationScheduleId ?? undefined,
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
      baseAdjustmentType: c.baseAdjustmentType ?? null,
      baseAdjustmentValue: c.baseAdjustmentValue ?? null,
      notes: c.notes ?? null,
    }));
    await db.insert(scenarioYearConfigsTable).values(configsToInsert as any);
  }

  const result = await getScenarioWithConfigs(req.params.id);
  res.json(result);
});

router.delete("/scenarios/:id", async (req, res) => {
  await db.delete(scenariosTable).where(eq(scenariosTable.id, req.params.id));
  res.status(204).send();
});


router.post("/scenarios/:id/calculate", async (req, res) => {
  const result = await runScenarioCalculation(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.json(result);
});

router.post("/scenarios/:id/apply", async (req, res) => {
  const result = await runScenarioCalculation(req.params.id);
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
    bargainingUnitId: c.bargainingUnitId ?? undefined,
    employeeGroupId: c.employeeGroupId ?? undefined,
    compensationScheduleId: c.compensationScheduleId ?? undefined,
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
    baseAdjustmentType: c.baseAdjustmentType ?? null,
    baseAdjustmentValue: c.baseAdjustmentValue ?? null,
    notes: c.notes ?? null,
  }));

  const inserted = await db.insert(scenarioYearConfigsTable).values(configsToInsert as any).returning();
  res.json(inserted);
});

router.get("/scenarios/:id/summary", async (req, res) => {
  const result = await runScenarioCalculation(req.params.id);
  if (!result) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }
  res.json(result);
});

export default router;
