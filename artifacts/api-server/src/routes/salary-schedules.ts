import { Router } from "express";
import { db } from "@workspace/db";
import {
  salarySchedulesTable,
  lanesTable,
  stepsTable,
  scheduleCellsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

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
  res.json(schedules);
});

router.post("/salary-schedules", async (req, res) => {
  const { bargainingUnitId, name, effectiveYear, baseSalary, lanes, steps, cells } = req.body;
  if (!bargainingUnitId || !name) {
    res.status(400).json({ error: "bargainingUnitId and name are required" });
    return;
  }

  const [schedule] = await db
    .insert(salarySchedulesTable)
    .values({ bargainingUnitId, name, effectiveYear, baseSalary })
    .returning();

  let createdLanes: (typeof lanesTable.$inferSelect)[] = [];
  if (lanes?.length) {
    createdLanes = await db
      .insert(lanesTable)
      .values(
        lanes.map((l: { name: string; displayOrder?: number; indexMultiplier?: string }) => ({
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
        steps.map((s: { stepNumber: number; incrementMultiplier?: string }) => ({
          salaryScheduleId: schedule.id,
          stepNumber: s.stepNumber,
          incrementMultiplier: s.incrementMultiplier ?? "1.0",
        }))
      )
      .returning();
  }

  if (cells?.length && createdLanes.length && createdSteps.length) {
    const cellsToInsert = (
      cells as Array<{ laneIndex: number; stepNumber: number; salaryAmount: string }>
    )
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

router.delete("/salary-schedules/:id", async (req, res) => {
  await db.delete(salarySchedulesTable).where(eq(salarySchedulesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
