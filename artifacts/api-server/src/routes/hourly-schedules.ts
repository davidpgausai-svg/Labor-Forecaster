import { Router } from "express";
import { db } from "@workspace/db";
import { hourlySchedulesTable, hourlyCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/hourly-schedules", async (req, res) => {
  const { bargainingUnitId } = req.query;
  const schedules = bargainingUnitId
    ? await db
        .select()
        .from(hourlySchedulesTable)
        .where(eq(hourlySchedulesTable.bargainingUnitId, bargainingUnitId as string))
    : await db.select().from(hourlySchedulesTable);

  const results = await Promise.all(
    schedules.map(async (s) => {
      const categories = await db
        .select()
        .from(hourlyCategoriesTable)
        .where(eq(hourlyCategoriesTable.hourlyScheduleId, s.id))
        .orderBy(hourlyCategoriesTable.displayOrder);
      return { ...s, categories };
    })
  );

  res.json(results);
});

router.post("/hourly-schedules", async (req, res) => {
  const { bargainingUnitId, effectiveYear, categories } = req.body;
  if (!bargainingUnitId) {
    res.status(400).json({ error: "bargainingUnitId is required" });
    return;
  }

  const [schedule] = await db
    .insert(hourlySchedulesTable)
    .values({ bargainingUnitId, effectiveYear })
    .returning();

  let createdCategories: (typeof hourlyCategoriesTable.$inferSelect)[] = [];
  if (categories?.length) {
    createdCategories = await db
      .insert(hourlyCategoriesTable)
      .values(
        categories.map((c: { name: string; baseHourlyRate: string; annualHours?: string; displayOrder?: number }) => ({
          hourlyScheduleId: schedule.id,
          name: c.name,
          baseHourlyRate: c.baseHourlyRate,
          annualHours: c.annualHours ?? "2080",
          displayOrder: c.displayOrder ?? 0,
        }))
      )
      .returning();
  }

  res.status(201).json({ ...schedule, categories: createdCategories });
});

export default router;
