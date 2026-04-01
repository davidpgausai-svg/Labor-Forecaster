import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  salarySchedulesTable,
  lanesTable,
  stepsTable,
  scheduleCellsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const numericString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a numeric string");

const laneSchema = z.object({
  name: z.string().min(1),
  displayOrder: z.number().int().nonnegative().optional(),
  indexMultiplier: numericString.optional(),
});

const stepSchema = z.object({
  stepNumber: z.number().int().min(1),
  incrementMultiplier: numericString.optional(),
});

const cellSchema = z.object({
  laneIndex: z.number().int().nonnegative(),
  stepNumber: z.number().int().min(1),
  salaryAmount: numericString,
});

const createSalaryScheduleSchema = z.object({
  bargainingUnitId: z.string().uuid(),
  name: z.string().min(1),
  effectiveYear: z.number().int().nonnegative().optional(),
  baseSalary: numericString.optional(),
  lanes: z.array(laneSchema).optional(),
  steps: z.array(stepSchema).optional(),
  cells: z.array(cellSchema).optional(),
});

const router = Router();

router.get("/salary-schedules", async (req, res) => {
  const { bargainingUnitId } = req.query;
  const schedules = bargainingUnitId
    ? await db
        .select()
        .from(salarySchedulesTable)
        .where(eq(salarySchedulesTable.bargainingUnitId, bargainingUnitId as string))
        .orderBy(salarySchedulesTable.effectiveYear)
    : await db.select().from(salarySchedulesTable).orderBy(salarySchedulesTable.effectiveYear);

  const schedulesWithGrid = await Promise.all(
    schedules.map(async (schedule) => {
      const [lanes, steps, cells] = await Promise.all([
        db.select().from(lanesTable).where(eq(lanesTable.salaryScheduleId, schedule.id)).orderBy(lanesTable.displayOrder),
        db.select().from(stepsTable).where(eq(stepsTable.salaryScheduleId, schedule.id)).orderBy(stepsTable.stepNumber),
        db.select().from(scheduleCellsTable).where(eq(scheduleCellsTable.salaryScheduleId, schedule.id)),
      ]);
      const cellsWithStepNumber = cells.map((c) => {
        const step = steps.find((s) => s.id === c.stepId);
        return { ...c, stepNumber: step?.stepNumber ?? 0 };
      });
      return { ...schedule, lanes, steps, cells: cellsWithStepNumber };
    })
  );

  res.json(schedulesWithGrid);
});

router.post("/salary-schedules", async (req, res) => {
  const parsed = createSalaryScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { bargainingUnitId, name, effectiveYear, baseSalary, lanes, steps, cells } = parsed.data;

  const [schedule] = await db
    .insert(salarySchedulesTable)
    .values({ bargainingUnitId, name, effectiveYear, baseSalary })
    .returning();

  let createdLanes: (typeof lanesTable.$inferSelect)[] = [];
  if (lanes?.length) {
    createdLanes = await db
      .insert(lanesTable)
      .values(
        lanes.map((l) => ({
          salaryScheduleId: schedule.id,
          name: l.name,
          displayOrder: l.displayOrder ?? 0,
          indexMultiplier: l.indexMultiplier ?? "1.0",
        }))
      )
      .returning();
  }

  let createdSteps: (typeof stepsTable.$inferSelect)[] = [];
  if (steps?.length) {
    createdSteps = await db
      .insert(stepsTable)
      .values(
        steps.map((s) => ({
          salaryScheduleId: schedule.id,
          stepNumber: s.stepNumber,
          incrementMultiplier: s.incrementMultiplier ?? "1.0",
        }))
      )
      .returning();
  }

  if (cells?.length && createdLanes.length && createdSteps.length) {
    const cellsToInsert = cells
      .map((c) => {
        const lane = createdLanes[c.laneIndex];
        const step = createdSteps.find((s) => s.stepNumber === c.stepNumber);
        if (!lane || !step) return null;
        return { salaryScheduleId: schedule.id, laneId: lane.id, stepId: step.id, salaryAmount: c.salaryAmount };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (cellsToInsert.length > 0) {
      await db.insert(scheduleCellsTable).values(cellsToInsert);
    }
  }

  res.status(201).json({ ...schedule, lanes: createdLanes, steps: createdSteps });
});

router.get("/salary-schedules/:id", async (req, res) => {
  const schedules = await db
    .select()
    .from(salarySchedulesTable)
    .where(eq(salarySchedulesTable.id, req.params.id));
  const schedule = schedules[0];
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }

  const [lanes, steps, cells] = await Promise.all([
    db.select().from(lanesTable).where(eq(lanesTable.salaryScheduleId, schedule.id)).orderBy(lanesTable.displayOrder),
    db.select().from(stepsTable).where(eq(stepsTable.salaryScheduleId, schedule.id)).orderBy(stepsTable.stepNumber),
    db.select().from(scheduleCellsTable).where(eq(scheduleCellsTable.salaryScheduleId, schedule.id)),
  ]);

  const cellsWithStepNumber = cells.map((c) => {
    const step = steps.find((s) => s.id === c.stepId);
    return { ...c, stepNumber: step?.stepNumber ?? 0 };
  });

  res.json({ ...schedule, lanes, steps, cells: cellsWithStepNumber });
});

const updateSalaryScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  effectiveYear: z.number().int().nonnegative().optional(),
  baseSalary: numericString.optional(),
});

router.put("/salary-schedules/:id", async (req, res) => {
  const parsed = updateSalaryScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [schedule] = await db
    .update(salarySchedulesTable)
    .set(parsed.data)
    .where(eq(salarySchedulesTable.id, req.params.id))
    .returning();
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  res.json(schedule);
});

router.delete("/salary-schedules/:id", async (req, res) => {
  await db.delete(salarySchedulesTable).where(eq(salarySchedulesTable.id, req.params.id));
  res.status(204).send();
});

const updateCellsSchema = z.object({
  cells: z.array(
    z.object({
      stepId: z.string().uuid(),
      laneId: z.string().uuid(),
      salaryAmount: numericString,
    })
  ),
});

router.put("/salary-schedules/:id/cells", async (req, res) => {
  const parsed = updateCellsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const schedules = await db
    .select()
    .from(salarySchedulesTable)
    .where(eq(salarySchedulesTable.id, req.params.id));
  if (!schedules[0]) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }

  const { cells } = parsed.data;

  await db.delete(scheduleCellsTable).where(eq(scheduleCellsTable.salaryScheduleId, req.params.id));

  if (cells.length > 0) {
    await db.insert(scheduleCellsTable).values(
      cells.map((c) => ({
        salaryScheduleId: req.params.id,
        stepId: c.stepId,
        laneId: c.laneId,
        salaryAmount: c.salaryAmount,
      }))
    );
  }

  res.json({ updated: cells.length });
});

export default router;
