import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  employeePositionsTable,
  employeesTable,
  scenariosTable,
  compensationSchedulesTable,
  indexGridConfigsTable,
  scheduleIndicesTable,
  importGridCellsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import Decimal from "decimal.js";
import { runScenarioCalculation } from "@workspace/calc-engine";

const positionBodySchema = z.object({
  employeeGroupId: z.string().uuid().nullable().optional(),
  bargainingUnitId: z.string().uuid().nullable().optional(),
  compensationScheduleId: z.string().uuid().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  fteFraction: z.string().optional(),
  currentStep: z.number().int().nullable().optional(),
  currentLaneId: z.string().uuid().nullable().optional(),
  currentAnnualSalary: z.string().optional(),
  currentHourlyRate: z.string().nullable().optional(),
  annualHours: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  status: z.string().optional(),
  effectiveDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
});

/**
 * For grid-based schedules (index_based_grid, direct_import_grid), derive the
 * year-0 salary from the grid cell so currentAnnualSalary is never left at $0.
 */
async function resolveGridSalary(
  compensationScheduleId: string | null | undefined,
  currentStep: number | null | undefined,
  currentLaneId: string | null | undefined,
): Promise<string | null> {
  if (!compensationScheduleId || currentStep == null || !currentLaneId) return null;

  const schedule = await db
    .select({ scheduleType: compensationSchedulesTable.scheduleType })
    .from(compensationSchedulesTable)
    .where(eq(compensationSchedulesTable.id, compensationScheduleId))
    .limit(1)
    .then((r) => r[0]);

  if (!schedule) return null;

  if (schedule.scheduleType === "index_based_grid") {
    const [config, indexRow] = await Promise.all([
      db.select().from(indexGridConfigsTable)
        .where(eq(indexGridConfigsTable.compensationScheduleId, compensationScheduleId))
        .limit(1)
        .then((r) => r[0]),
      db.select().from(scheduleIndicesTable)
        .where(
          and(
            eq(scheduleIndicesTable.compensationScheduleId, compensationScheduleId),
            eq(scheduleIndicesTable.laneId, currentLaneId),
            eq(scheduleIndicesTable.stepNumber, currentStep),
          )
        )
        .limit(1)
        .then((r) => r[0]),
    ]);
    if (!config || !indexRow) return null;
    const salary = new Decimal(config.baseAnchorSalary).times(new Decimal(indexRow.indexValue)).ceil();
    return salary.toFixed(2);
  }

  if (schedule.scheduleType === "direct_import_grid") {
    const cell = await db.select().from(importGridCellsTable)
      .where(
        and(
          eq(importGridCellsTable.compensationScheduleId, compensationScheduleId),
          eq(importGridCellsTable.laneId, currentLaneId),
          eq(importGridCellsTable.stepNumber, currentStep),
        )
      )
      .limit(1)
      .then((r) => r[0]);
    if (!cell) return null;
    return (cell.salaryCents / 100).toFixed(2);
  }

  return null;
}

const router = Router();

async function recalcForEmployee(employeeId: string, context: string) {
  const emp = await db
    .select({ districtId: employeesTable.districtId })
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .then((rows) => rows[0]);

  if (!emp) return;

  const scenarios = await db
    .select({ id: scenariosTable.id })
    .from(scenariosTable)
    .where(eq(scenariosTable.districtId, emp.districtId));

  for (const scenario of scenarios) {
    try {
      await runScenarioCalculation(scenario.id);
    } catch (err) {
      console.error(`[${context}] Failed to recalculate scenario ${scenario.id}:`, err);
    }
  }
}

router.get("/employees/:id/positions", async (req, res) => {
  const positions = await db
    .select()
    .from(employeePositionsTable)
    .where(eq(employeePositionsTable.employeeId, req.params.id))
    .orderBy(employeePositionsTable.displayOrder, employeePositionsTable.createdAt);

  res.json(positions);
});

router.post("/employees/:id/positions", async (req, res) => {
  const parsed = positionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;

  // For grid schedules, derive currentAnnualSalary from the grid cell
  const gridSalary = await resolveGridSalary(data.compensationScheduleId, data.currentStep, data.currentLaneId);
  if (gridSalary !== null) {
    data.currentAnnualSalary = gridSalary;
  }

  // If this position is being set as primary, demote all other positions first
  if (data.isPrimary) {
    await db
      .update(employeePositionsTable)
      .set({ isPrimary: false })
      .where(eq(employeePositionsTable.employeeId, req.params.id));
  }

  const [position] = await db
    .insert(employeePositionsTable)
    .values({ ...data, employeeId: req.params.id })
    .returning();

  await recalcForEmployee(req.params.id, "POST /employees/:id/positions");

  res.status(201).json(position);
});

router.put("/employee-positions/:id", async (req, res) => {
  const parsed = positionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;

  // For grid schedules, derive currentAnnualSalary from the grid cell
  const gridSalary = await resolveGridSalary(data.compensationScheduleId, data.currentStep, data.currentLaneId);
  if (gridSalary !== null) {
    data.currentAnnualSalary = gridSalary;
  }

  // If this position is being promoted to primary, demote others first
  if (data.isPrimary) {
    const [current] = await db
      .select({ employeeId: employeePositionsTable.employeeId })
      .from(employeePositionsTable)
      .where(eq(employeePositionsTable.id, req.params.id));

    if (current) {
      await db
        .update(employeePositionsTable)
        .set({ isPrimary: false })
        .where(
          and(
            eq(employeePositionsTable.employeeId, current.employeeId),
            // leave the current row alone — we'll set it below
          )
        );
    }
  }

  const [position] = await db
    .update(employeePositionsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(employeePositionsTable.id, req.params.id))
    .returning();

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  await recalcForEmployee(position.employeeId, "PUT /employee-positions/:id");

  res.json(position);
});

router.delete("/employee-positions/:id", async (req, res) => {
  const [position] = await db
    .delete(employeePositionsTable)
    .where(eq(employeePositionsTable.id, req.params.id))
    .returning();

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  await recalcForEmployee(position.employeeId, "DELETE /employee-positions/:id");

  res.status(204).send();
});

export default router;
