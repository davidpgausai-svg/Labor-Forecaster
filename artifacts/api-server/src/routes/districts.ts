import { Router } from "express";
import { db } from "@workspace/db";
import { districtsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/districts", async (_req, res) => {
  const districts = await db.select().from(districtsTable).orderBy(districtsTable.name);
  res.json(districts);
});

router.post("/districts", async (req, res) => {
  const { name, state, fiscalYearStart, studentEnrollment } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [district] = await db
    .insert(districtsTable)
    .values({ name, state, fiscalYearStart, studentEnrollment })
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
  const { name, state, fiscalYearStart, studentEnrollment } = req.body;
  const [district] = await db
    .update(districtsTable)
    .set({ name, state, fiscalYearStart, studentEnrollment, updatedAt: new Date() })
    .where(eq(districtsTable.id, req.params.id))
    .returning();
  if (!district) {
    res.status(404).json({ error: "District not found" });
    return;
  }
  res.json(district);
});

export default router;
