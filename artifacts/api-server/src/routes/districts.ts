import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const createDistrictSchema = z.object({
  name: z.string().min(1),
  state: z.string().length(2).optional(),
  fiscalYearStart: z.string().optional(),
  studentEnrollment: z.number().int().nonnegative().optional(),
});

const updateDistrictSchema = createDistrictSchema.partial();

const router = Router();

router.get("/districts", async (_req, res) => {
  const districts = await db.select().from(districtsTable).orderBy(districtsTable.name);
  res.json(districts);
});

router.post("/districts", async (req, res) => {
  const parsed = createDistrictSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [district] = await db
    .insert(districtsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(district);
});

router.get("/districts/:id", async (req, res) => {
  const [district] = await db
    .select()
    .from(districtsTable)
    .where(eq(districtsTable.id, req.params.id));
  if (!district) {
    res.status(404).json({ error: "District not found" });
    return;
  }
  res.json(district);
});

router.put("/districts/:id", async (req, res) => {
  const parsed = updateDistrictSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [district] = await db
    .update(districtsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(districtsTable.id, req.params.id))
    .returning();
  if (!district) {
    res.status(404).json({ error: "District not found" });
    return;
  }
  res.json(district);
});

export default router;
