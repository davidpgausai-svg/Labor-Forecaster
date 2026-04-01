import { Router } from "express";
import { db } from "@workspace/db";
import { bargainingUnitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/bargaining-units", async (req, res) => {
  const { districtId } = req.query;
  const units = districtId
    ? await db
        .select()
        .from(bargainingUnitsTable)
        .where(eq(bargainingUnitsTable.districtId, districtId as string))
        .orderBy(bargainingUnitsTable.displayOrder)
    : await db
        .select()
        .from(bargainingUnitsTable)
        .orderBy(bargainingUnitsTable.displayOrder);
  res.json(units);
});

router.post("/bargaining-units", async (req, res) => {
  const body = req.body;
  if (!body.districtId || !body.name || !body.code) {
    res.status(400).json({ error: "districtId, name, and code are required" });
    return;
  }
  const [unit] = await db.insert(bargainingUnitsTable).values(body).returning();
  res.status(201).json(unit);
});

router.get("/bargaining-units/:id", async (req, res) => {
  const [unit] = await db
    .select()
    .from(bargainingUnitsTable)
    .where(eq(bargainingUnitsTable.id, req.params.id));
  if (!unit) {
    res.status(404).json({ error: "Bargaining unit not found" });
    return;
  }
  res.json(unit);
});

router.put("/bargaining-units/:id", async (req, res) => {
  const body = req.body;
  const [unit] = await db
    .update(bargainingUnitsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(bargainingUnitsTable.id, req.params.id))
    .returning();
  if (!unit) {
    res.status(404).json({ error: "Bargaining unit not found" });
    return;
  }
  res.json(unit);
});

router.delete("/bargaining-units/:id", async (req, res) => {
  await db
    .delete(bargainingUnitsTable)
    .where(eq(bargainingUnitsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
