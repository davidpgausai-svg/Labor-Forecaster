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
  employeePositionYearRecordsTable,
  lanesTable,
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
 *
 * When the exact laneId doesn't match (e.g. position was created under a
 * different version of the schedule), falls back to matching by lane name.
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
    const config = await db.select().from(indexGridConfigsTable)
      .where(eq(indexGridConfigsTable.compensationScheduleId, compensationScheduleId))
      .limit(1)
      .then((r) => r[0]);
    if (!config) return null;

    // Try exact laneId match first
    let indexRow = await db.select().from(scheduleIndicesTable)
      .where(
        and(
          eq(scheduleIndicesTable.compensationScheduleId, compensationScheduleId),
          eq(scheduleIndicesTable.laneId, currentLaneId),
          eq(scheduleIndicesTable.stepNumber, currentStep),
        )
      )
      .limit(1)
      .then((r) => r[0]);

    // Fallback: match by lane name (handles stale laneId from a prior schedule version)
    if (!indexRow) {
      const posLane = await db.select({ name: lanesTable.name })
        .from(lanesTable)
        .where(eq(lanesTable.id, currentLaneId))
        .limit(1)
        .then((r) => r[0]);

      if (posLane) {
        const schedLane = await db.select({ id: lanesTable.id })
          .from(lanesTable)
          .where(
            and(
              eq(lanesTable.compensationScheduleId, compensationScheduleId),
              eq(lanesTable.name, posLane.name),
            )
          )
          .limit(1)
          .then((r) => r[0]);

        if (schedLane) {
          indexRow = await db.select().from(scheduleIndicesTable)
            .where(
              and(
                eq(scheduleIndicesTable.compensationScheduleId, compensationScheduleId),
                eq(scheduleIndicesTable.laneId, schedLane.id),
                eq(scheduleIndicesTable.stepNumber, currentStep),
              )
            )
            .limit(1)
            .then((r) => r[0]);
        }
      }
    }

    if (!indexRow) return null;
    const salary = new Decimal(config.baseAnchorSalary).times(new Decimal(indexRow.indexValue)).ceil();
    return salary.toFixed(2);
  }

  if (schedule.scheduleType === "direct_import_grid") {
    let cell = await db.select().from(importGridCellsTable)
      .where(
        and(
          eq(importGridCellsTable.compensationScheduleId, compensationScheduleId),
          eq(importGridCellsTable.laneId, currentLaneId),
          eq(importGridCellsTable.stepNumber, currentStep),
        )
      )
      .limit(1)
      .then((r) => r[0]);

    // Fallback: lane name match
    if (!cell) {
      const posLane = await db.select({ name: lanesTable.name })
        .from(lanesTable)
        .where(eq(lanesTable.id, currentLaneId))
        .limit(1)
        .then((r) => r[0]);

      if (posLane) {
        const schedLane = await db.select({ id: lanesTable.id })
          .from(lanesTable)
          .where(
            and(
              eq(lanesTable.compensationScheduleId, compensationScheduleId),
              eq(lanesTable.name, posLane.name),
            )
          )
          .limit(1)
          .then((r) => r[0]);

        if (schedLane) {
          cell = await db.select().from(importGridCellsTable)
            .where(
              and(
                eq(importGridCellsTable.compensationScheduleId, compensationScheduleId),
                eq(importGridCellsTable.laneId, schedLane.id),
                eq(importGridCellsTable.stepNumber, currentStep),
              )
            )
            .limit(1)
            .then((r) => r[0]);
        }
      }
    }

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

  // Backfill: for any grid position that still has $0 stored, resolve and persist the correct salary.
  // Tries three paths in order:
  //   1. Grid cell lookup using position's compensationScheduleId
  //   2. Grid cell lookup using the group's primary schedule (handles positions saved with null scheduleId)
  //   3. employee_position_year_records year 0 — available once any scenario has been calculated
  const needsBackfill = positions.filter(
    p => parseFloat(p.currentAnnualSalary ?? "0") === 0 &&
      p.currentStep != null && p.currentLaneId
  );

  if (needsBackfill.length > 0) {
    await Promise.all(
      needsBackfill.map(async (pos) => {
        // Path 1: use the stored compensationScheduleId
        let resolved: string | null = await resolveGridSalary(
          pos.compensationScheduleId, pos.currentStep, pos.currentLaneId
        );

        // Path 2: compensationScheduleId was never saved — look up the group's primary schedule
        if (resolved === null && pos.employeeGroupId) {
          const primarySched = await db
            .select({ id: compensationSchedulesTable.id })
            .from(compensationSchedulesTable)
            .where(
              and(
                eq(compensationSchedulesTable.employeeGroupId, pos.employeeGroupId),
                eq(compensationSchedulesTable.isPrimary, true)
              )
            )
            .limit(1)
            .then(r => r[0]);

          if (primarySched) {
            resolved = await resolveGridSalary(primarySched.id, pos.currentStep, pos.currentLaneId);
            // Also persist the correct compensationScheduleId so this only runs once
            if (resolved !== null) {
              await db
                .update(employeePositionsTable)
                .set({ compensationScheduleId: primarySched.id })
                .where(eq(employeePositionsTable.id, pos.id));
              pos.compensationScheduleId = primarySched.id;
            }
          }
        }

        // Path 3: fall back to year-0 position projection
        if (resolved === null) {
          const yearRec = await db
            .select({ projectedBaseSalaryCents: employeePositionYearRecordsTable.projectedBaseSalaryCents })
            .from(employeePositionYearRecordsTable)
            .where(
              and(
                eq(employeePositionYearRecordsTable.positionId, pos.id),
                eq(employeePositionYearRecordsTable.contractYear, 0)
              )
            )
            .limit(1)
            .then(r => r[0]);

          if (yearRec && yearRec.projectedBaseSalaryCents > 0) {
            resolved = (yearRec.projectedBaseSalaryCents / 100).toFixed(2);
          }
        }

        if (resolved !== null) {
          await db
            .update(employeePositionsTable)
            .set({ currentAnnualSalary: resolved, updatedAt: new Date() })
            .where(eq(employeePositionsTable.id, pos.id));
          pos.currentAnnualSalary = resolved;
        } else {
          console.warn(`[positions backfill] Could not resolve salary for position ${pos.id}`);
        }
      })
    );
  }

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
