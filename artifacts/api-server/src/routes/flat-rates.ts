import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { flatRatesTable, compensationSchedulesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const createFlatRateCategorySchema = z.object({
  positionTitle: z.string().min(1),
  annualAmountCents: z.number().int().nonnegative(),
  displayOrder: z.number().int().nonnegative().default(0),
});

const updateFlatRateCategorySchema = createFlatRateCategorySchema.partial();

const router = Router();

/**
 * GET /compensation-schedules/:scheduleId/flat-rate-categories
 * List all flat rate categories for a schedule, ordered by displayOrder.
 */
router.get(
  "/compensation-schedules/:scheduleId/flat-rate-categories",
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
      .from(flatRatesTable)
      .where(eq(flatRatesTable.compensationScheduleId, req.params.scheduleId))
      .orderBy(asc(flatRatesTable.displayOrder), asc(flatRatesTable.positionTitle));

    res.json(categories);
  }
);

/**
 * POST /compensation-schedules/:scheduleId/flat-rate-categories
 * Create a flat rate category.
 */
router.post(
  "/compensation-schedules/:scheduleId/flat-rate-categories",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = createFlatRateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [category] = await db
      .insert(flatRatesTable)
      .values({ ...parsed.data, compensationScheduleId: req.params.scheduleId })
      .returning();

    res.status(201).json(category);
  }
);

/**
 * PUT /flat-rate-categories/:id
 * Update a flat rate category.
 */
router.put("/flat-rate-categories/:id", async (req, res) => {
  const parsed = updateFlatRateCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(flatRatesTable)
    .set(parsed.data)
    .where(eq(flatRatesTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Flat rate category not found" });
    return;
  }
  res.json(updated);
});

/**
 * DELETE /flat-rate-categories/:id
 */
router.delete("/flat-rate-categories/:id", async (req, res) => {
  await db.delete(flatRatesTable).where(eq(flatRatesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
