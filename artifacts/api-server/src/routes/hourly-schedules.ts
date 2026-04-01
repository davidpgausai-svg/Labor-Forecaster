import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { hourlySchedulesTable, hourlyCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const numericString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a numeric string");

const categorySchema = z.object({
  name: z.string().min(1),
  baseHourlyRate: numericString,
  annualHours: numericString.optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});

const createHourlyScheduleSchema = z.object({
  bargainingUnitId: z.string().uuid(),
  effectiveYear: z.number().int().nonnegative().optional(),
  categories: z.array(categorySchema).optional(),
});

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
  const parsed = createHourlyScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const { bargainingUnitId, effectiveYear, categories } = parsed.data;

  const [schedule] = await db
    .insert(hourlySchedulesTable)
    .values({ bargainingUnitId, effectiveYear })
    .returning();

  let createdCategories: (typeof hourlyCategoriesTable.$inferSelect)[] = [];
  if (categories?.length) {
    createdCategories = await db
      .insert(hourlyCategoriesTable)
      .values(
        categories.map((c) => ({
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
