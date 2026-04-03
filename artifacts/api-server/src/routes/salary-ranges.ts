import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { salaryRangesTable, compensationSchedulesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const createSalaryRangeSchema = z.object({
  positionTitle: z.string().min(1),
  minSalaryCents: z.number().int().nonnegative(),
  midSalaryCents: z.number().int().nonnegative(),
  maxSalaryCents: z.number().int().nonnegative(),
  displayOrder: z.number().int().nonnegative().default(0),
});

const updateSalaryRangeSchema = createSalaryRangeSchema.partial();

const router = Router();

/**
 * GET /compensation-schedules/:scheduleId/salary-ranges
 */
router.get(
  "/compensation-schedules/:scheduleId/salary-ranges",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const ranges = await db
      .select()
      .from(salaryRangesTable)
      .where(
        eq(salaryRangesTable.compensationScheduleId, req.params.scheduleId)
      )
      .orderBy(
        asc(salaryRangesTable.displayOrder),
        asc(salaryRangesTable.positionTitle)
      );

    res.json(ranges);
  }
);

/**
 * POST /compensation-schedules/:scheduleId/salary-ranges
 */
router.post(
  "/compensation-schedules/:scheduleId/salary-ranges",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = createSalaryRangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [range] = await db
      .insert(salaryRangesTable)
      .values({
        ...parsed.data,
        compensationScheduleId: req.params.scheduleId,
      })
      .returning();

    res.status(201).json(range);
  }
);

/**
 * PUT /salary-ranges/:id
 */
router.put("/salary-ranges/:id", async (req, res) => {
  const parsed = updateSalaryRangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(salaryRangesTable)
    .set(parsed.data)
    .where(eq(salaryRangesTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Salary range not found" });
    return;
  }
  res.json(updated);
});

/**
 * DELETE /salary-ranges/:id
 */
router.delete("/salary-ranges/:id", async (req, res) => {
  await db
    .delete(salaryRangesTable)
    .where(eq(salaryRangesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
