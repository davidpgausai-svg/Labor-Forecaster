import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  compensationHourlyCategoriesTable,
  compensationSchedulesTable,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const createHourlyCategorySchema = z.object({
  name: z.string().min(1),
  baseHourlyRate: z.string().regex(/^\d+(\.\d{1,4})?$/),
  annualHours: z.string().regex(/^\d+(\.\d{1,2})?$/).default("2080"),
  displayOrder: z.number().int().nonnegative().default(0),
});

const updateHourlyCategorySchema = createHourlyCategorySchema.partial();

const router = Router();

/**
 * GET /compensation-schedules/:scheduleId/hourly-categories
 */
router.get(
  "/compensation-schedules/:scheduleId/hourly-categories",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const categories = await db
      .select()
      .from(compensationHourlyCategoriesTable)
      .where(
        eq(
          compensationHourlyCategoriesTable.compensationScheduleId,
          req.params.scheduleId
        )
      )
      .orderBy(
        asc(compensationHourlyCategoriesTable.displayOrder),
        asc(compensationHourlyCategoriesTable.name)
      );

    res.json(categories);
  }
);

/**
 * POST /compensation-schedules/:scheduleId/hourly-categories
 */
router.post(
  "/compensation-schedules/:scheduleId/hourly-categories",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = createHourlyCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [category] = await db
      .insert(compensationHourlyCategoriesTable)
      .values({
        ...parsed.data,
        compensationScheduleId: req.params.scheduleId,
      })
      .returning();

    res.status(201).json(category);
  }
);

/**
 * PUT /hourly-categories/:id
 */
router.put("/hourly-categories/:id", async (req, res) => {
  const parsed = updateHourlyCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(compensationHourlyCategoriesTable)
    .set(parsed.data)
    .where(eq(compensationHourlyCategoriesTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Hourly category not found" });
    return;
  }
  res.json(updated);
});

/**
 * DELETE /hourly-categories/:id
 */
router.delete("/hourly-categories/:id", async (req, res) => {
  await db
    .delete(compensationHourlyCategoriesTable)
    .where(eq(compensationHourlyCategoriesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
