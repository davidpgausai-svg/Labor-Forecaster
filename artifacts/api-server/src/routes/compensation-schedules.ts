import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  compensationSchedulesTable,
  COMPENSATION_SCHEDULE_TYPES,
  COMPENSATION_PAY_TYPES,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const createCompensationScheduleSchema = z.object({
  employeeGroupId: z.string().uuid(),
  name: z.string().min(1),
  scheduleType: z.enum(COMPENSATION_SCHEDULE_TYPES),
  payType: z.enum(COMPENSATION_PAY_TYPES).default("salary"),
  isPrimary: z.boolean().default(false),
  displayOrder: z.number().int().nonnegative().default(0),
  description: z.string().optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  effectiveDateRule: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

const updateCompensationScheduleSchema = createCompensationScheduleSchema
  .omit({ employeeGroupId: true })
  .partial();

const router = Router();

router.get("/compensation-schedules", async (req, res) => {
  const { employeeGroupId } = req.query;
  const schedules = employeeGroupId
    ? await db
        .select()
        .from(compensationSchedulesTable)
        .where(
          eq(
            compensationSchedulesTable.employeeGroupId,
            employeeGroupId as string
          )
        )
        .orderBy(compensationSchedulesTable.displayOrder)
    : await db
        .select()
        .from(compensationSchedulesTable)
        .orderBy(compensationSchedulesTable.displayOrder);
  res.json(schedules);
});

router.post("/compensation-schedules", async (req, res) => {
  const parsed = createCompensationScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues,
    });
    return;
  }
  const [schedule] = await db
    .insert(compensationSchedulesTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(schedule);
});

router.get("/compensation-schedules/:id", async (req, res) => {
  const [schedule] = await db
    .select()
    .from(compensationSchedulesTable)
    .where(eq(compensationSchedulesTable.id, req.params.id));
  if (!schedule) {
    res.status(404).json({ error: "Compensation schedule not found" });
    return;
  }
  res.json(schedule);
});

router.put("/compensation-schedules/:id", async (req, res) => {
  const parsed = updateCompensationScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues,
    });
    return;
  }
  const [updated] = await db
    .update(compensationSchedulesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(compensationSchedulesTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Compensation schedule not found" });
    return;
  }
  res.json(updated);
});

router.delete("/compensation-schedules/:id", async (req, res) => {
  await db
    .delete(compensationSchedulesTable)
    .where(eq(compensationSchedulesTable.id, req.params.id));
  res.status(204).send();
});

router.post("/compensation-schedules/:id/set-primary", async (req, res) => {
  const [schedule] = await db
    .select()
    .from(compensationSchedulesTable)
    .where(eq(compensationSchedulesTable.id, req.params.id));
  if (!schedule) {
    res.status(404).json({ error: "Compensation schedule not found" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(compensationSchedulesTable)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(
        eq(
          compensationSchedulesTable.employeeGroupId,
          schedule.employeeGroupId
        )
      );
    await tx
      .update(compensationSchedulesTable)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(compensationSchedulesTable.id, req.params.id));
  });

  const [updated] = await db
    .select()
    .from(compensationSchedulesTable)
    .where(eq(compensationSchedulesTable.id, req.params.id));
  res.json(updated);
});

export default router;
