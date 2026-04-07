import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  indexGridConfigsTable,
  scheduleIndicesTable,
  lanesTable,
  compensationSchedulesTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const upsertConfigSchema = z.object({
  baseAnchorSalary: z.string().regex(/^\d+(\.\d+)?$/),
  maxSteps: z.number().int().min(1).max(100),
});

const bulkUpsertIndicesSchema = z.object({
  indices: z.array(
    z.object({
      laneId: z.string().uuid(),
      stepNumber: z.number().int().min(1),
      indexValue: z.string().regex(/^\d+(\.\d+)?$/),
      isCapped: z.boolean().default(false),
    })
  ),
});

const router = Router();

/**
 * GET /compensation-schedules/:scheduleId/index-grid-config
 * Returns the grid config + all indices. Creates a default config if none exists.
 */
router.get(
  "/compensation-schedules/:scheduleId/index-grid-config",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    let [config] = await db
      .select()
      .from(indexGridConfigsTable)
      .where(
        eq(
          indexGridConfigsTable.compensationScheduleId,
          req.params.scheduleId
        )
      );

    // Auto-create default config on first access
    if (!config) {
      [config] = await db
        .insert(indexGridConfigsTable)
        .values({
          compensationScheduleId: req.params.scheduleId,
          baseAnchorSalary: "40000",
          maxSteps: 20,
        })
        .returning();
    }

    const indices = await db
      .select()
      .from(scheduleIndicesTable)
      .where(
        eq(
          scheduleIndicesTable.compensationScheduleId,
          req.params.scheduleId
        )
      )
      .orderBy(
        asc(scheduleIndicesTable.stepNumber),
        asc(scheduleIndicesTable.laneId)
      );

    res.json({ ...config, indices });
  }
);

/**
 * PUT /compensation-schedules/:scheduleId/index-grid-config
 * Upsert base anchor salary and max steps.
 */
router.put(
  "/compensation-schedules/:scheduleId/index-grid-config",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = upsertConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const existing = await db
      .select()
      .from(indexGridConfigsTable)
      .where(
        eq(
          indexGridConfigsTable.compensationScheduleId,
          req.params.scheduleId
        )
      );

    let config;
    if (existing[0]) {
      [config] = await db
        .update(indexGridConfigsTable)
        .set(parsed.data)
        .where(eq(indexGridConfigsTable.id, existing[0].id))
        .returning();
    } else {
      [config] = await db
        .insert(indexGridConfigsTable)
        .values({
          compensationScheduleId: req.params.scheduleId,
          ...parsed.data,
        })
        .returning();
    }

    res.json(config);
  }
);

/**
 * PUT /compensation-schedules/:scheduleId/index-grid-indices
 * Bulk replace all index values for the schedule.
 */
router.put(
  "/compensation-schedules/:scheduleId/index-grid-indices",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = bulkUpsertIndicesSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const scheduleId = req.params.scheduleId;

    await db.transaction(async (tx) => {
      await tx
        .delete(scheduleIndicesTable)
        .where(eq(scheduleIndicesTable.compensationScheduleId, scheduleId));

      if (parsed.data.indices.length > 0) {
        await tx.insert(scheduleIndicesTable).values(
          parsed.data.indices.map((idx) => ({
            compensationScheduleId: scheduleId,
            laneId: idx.laneId,
            stepNumber: idx.stepNumber,
            indexValue: idx.indexValue,
            isCapped: idx.isCapped,
          }))
        );
      }
    });

    const updated = await db
      .select()
      .from(scheduleIndicesTable)
      .where(eq(scheduleIndicesTable.compensationScheduleId, scheduleId))
      .orderBy(
        asc(scheduleIndicesTable.stepNumber),
        asc(scheduleIndicesTable.laneId)
      );

    res.json(updated);
  }
);

export default router;
