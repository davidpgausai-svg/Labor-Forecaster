import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  perDiemConfigsTable,
  perDiemCapsTable,
  compensationSchedulesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const upsertPerDiemConfigSchema = z.object({
  contractDays: z.number().int().positive().default(187),
  derivationMethod: z.enum(["from_salary_schedule", "independent"]).default("independent"),
  sourceScheduleId: z.string().uuid().nullable().optional(),
});

const createPerDiemCapSchema = z.object({
  laneId: z.string().uuid(),
  capStep: z.number().int().nonnegative(),
  capRateCents: z.number().int().nonnegative(),
});

const updatePerDiemCapSchema = createPerDiemCapSchema.partial();

const router = Router();

// ---------------------------------------------------------------------------
// Per-Diem Config (1-per-schedule, upsert pattern)
// ---------------------------------------------------------------------------

/**
 * GET /compensation-schedules/:scheduleId/per-diem-config
 * Returns the per-diem config for a schedule, or null if not yet set.
 */
router.get(
  "/compensation-schedules/:scheduleId/per-diem-config",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const [config] = await db
      .select()
      .from(perDiemConfigsTable)
      .where(eq(perDiemConfigsTable.compensationScheduleId, req.params.scheduleId));

    res.json(config ?? null);
  }
);

/**
 * PUT /compensation-schedules/:scheduleId/per-diem-config
 * Upsert the per-diem config for a schedule.
 */
router.put(
  "/compensation-schedules/:scheduleId/per-diem-config",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = upsertPerDiemConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [existing] = await db
      .select()
      .from(perDiemConfigsTable)
      .where(eq(perDiemConfigsTable.compensationScheduleId, req.params.scheduleId));

    if (existing) {
      const [updated] = await db
        .update(perDiemConfigsTable)
        .set(parsed.data)
        .where(eq(perDiemConfigsTable.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(perDiemConfigsTable)
        .values({ ...parsed.data, compensationScheduleId: req.params.scheduleId })
        .returning();
      res.status(201).json(created);
    }
  }
);

// ---------------------------------------------------------------------------
// Per-Diem Caps
// ---------------------------------------------------------------------------

/**
 * GET /compensation-schedules/:scheduleId/per-diem-caps
 * List all caps for a schedule.
 */
router.get(
  "/compensation-schedules/:scheduleId/per-diem-caps",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const caps = await db
      .select()
      .from(perDiemCapsTable)
      .where(eq(perDiemCapsTable.compensationScheduleId, req.params.scheduleId));

    res.json(caps);
  }
);

/**
 * POST /compensation-schedules/:scheduleId/per-diem-caps
 * Add a per-diem cap.
 */
router.post(
  "/compensation-schedules/:scheduleId/per-diem-caps",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = createPerDiemCapSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [cap] = await db
      .insert(perDiemCapsTable)
      .values({ ...parsed.data, compensationScheduleId: req.params.scheduleId })
      .returning();

    res.status(201).json(cap);
  }
);

/**
 * PUT /per-diem-caps/:id
 * Update a per-diem cap.
 */
router.put("/per-diem-caps/:id", async (req, res) => {
  const parsed = updatePerDiemCapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(perDiemCapsTable)
    .set(parsed.data)
    .where(eq(perDiemCapsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Per-diem cap not found" });
    return;
  }
  res.json(updated);
});

/**
 * DELETE /per-diem-caps/:id
 */
router.delete("/per-diem-caps/:id", async (req, res) => {
  await db.delete(perDiemCapsTable).where(eq(perDiemCapsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
