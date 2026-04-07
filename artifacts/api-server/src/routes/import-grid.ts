import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  lanesTable,
  importGridCellsTable,
  compensationSchedulesTable,
} from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";

const createImportGridLaneSchema = z.object({
  name: z.string().min(1),
  displayOrder: z.number().int().nonnegative().default(0),
});

const updateImportGridLaneSchema = createImportGridLaneSchema.partial();

const bulkUpsertCellsSchema = z.object({
  cells: z.array(
    z.object({
      laneId: z.string().uuid(),
      stepNumber: z.number().int().min(1),
      salaryCents: z.number().int().nonnegative(),
    })
  ),
});

const router = Router();

// ---------------------------------------------------------------------------
// Lanes scoped to a direct_import_grid compensation schedule
// ---------------------------------------------------------------------------

/**
 * GET /compensation-schedules/:scheduleId/import-grid-lanes
 */
router.get(
  "/compensation-schedules/:scheduleId/import-grid-lanes",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const lanes = await db
      .select()
      .from(lanesTable)
      .where(eq(lanesTable.compensationScheduleId, req.params.scheduleId))
      .orderBy(asc(lanesTable.displayOrder), asc(lanesTable.name));

    res.json(lanes);
  }
);

/**
 * POST /compensation-schedules/:scheduleId/import-grid-lanes
 */
router.post(
  "/compensation-schedules/:scheduleId/import-grid-lanes",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = createImportGridLaneSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [lane] = await db
      .insert(lanesTable)
      .values({
        ...parsed.data,
        compensationScheduleId: req.params.scheduleId,
        salaryScheduleId: null,
      })
      .returning();

    res.status(201).json(lane);
  }
);

/**
 * PUT /import-grid-lanes/:id
 */
router.put("/import-grid-lanes/:id", async (req, res) => {
  const parsed = updateImportGridLaneSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(lanesTable)
    .set(parsed.data)
    .where(eq(lanesTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Lane not found" });
    return;
  }
  res.json(updated);
});

/**
 * DELETE /import-grid-lanes/:id
 */
router.delete("/import-grid-lanes/:id", async (req, res) => {
  await db.delete(lanesTable).where(eq(lanesTable.id, req.params.id));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

/**
 * GET /compensation-schedules/:scheduleId/import-grid-cells
 * Returns flat list of all cells for the schedule.
 */
router.get(
  "/compensation-schedules/:scheduleId/import-grid-cells",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const cells = await db
      .select()
      .from(importGridCellsTable)
      .where(
        eq(importGridCellsTable.compensationScheduleId, req.params.scheduleId)
      )
      .orderBy(
        asc(importGridCellsTable.stepNumber),
        asc(importGridCellsTable.laneId)
      );

    res.json(cells);
  }
);

/**
 * POST /compensation-schedules/:scheduleId/import-grid-cells/bulk
 * Upsert the full cell matrix in one call (replaces all cells for the schedule).
 */
router.post(
  "/compensation-schedules/:scheduleId/import-grid-cells/bulk",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = bulkUpsertCellsSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const scheduleId = req.params.scheduleId;
    const { cells } = parsed.data;

    await db.transaction(async (tx) => {
      // Delete existing cells for this schedule
      await tx
        .delete(importGridCellsTable)
        .where(eq(importGridCellsTable.compensationScheduleId, scheduleId));

      // Insert new cells
      if (cells.length > 0) {
        await tx.insert(importGridCellsTable).values(
          cells.map((c) => ({
            compensationScheduleId: scheduleId,
            laneId: c.laneId,
            stepNumber: c.stepNumber,
            salaryCents: c.salaryCents,
          }))
        );
      }
    });

    // Return full updated cell list
    const updated = await db
      .select()
      .from(importGridCellsTable)
      .where(eq(importGridCellsTable.compensationScheduleId, scheduleId))
      .orderBy(
        asc(importGridCellsTable.stepNumber),
        asc(importGridCellsTable.laneId)
      );

    res.json(updated);
  }
);

export default router;
