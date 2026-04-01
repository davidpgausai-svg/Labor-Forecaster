import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { bargainingUnitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const numericString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a numeric string");

const createBargainingUnitSchema = z.object({
  districtId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  compensationType: z.enum(["salary", "hourly"]).default("salary"),
  retirementSystem: z.enum(["TRS", "IMRF", "other"]).default("TRS"),
  retirementEmployeeRate: numericString.optional(),
  retirementEmployerRate: numericString.optional(),
  retirementGrossUpRate: numericString.optional(),
  ficaRate: numericString.optional(),
  ficaExempt: z.boolean().default(false),
  healthInsuranceSingleAnnual: numericString.optional(),
  healthInsuranceFamilyAnnual: numericString.optional(),
  dentalAnnual: numericString.optional(),
  lifeInsuranceAnnual: numericString.optional(),
  disabilityInsuranceAnnual: numericString.optional(),
  hsaContributionSingle: numericString.optional(),
  hsaContributionFamily: numericString.optional(),
  workersCompRate: numericString.optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  contractYears: z.number().int().min(1).max(10).optional(),
  displayOrder: z.number().int().nonnegative().optional(),
});

const updateBargainingUnitSchema = createBargainingUnitSchema.omit({ districtId: true }).partial();

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
  const parsed = createBargainingUnitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [unit] = await db.insert(bargainingUnitsTable).values(parsed.data).returning();
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
  const parsed = updateBargainingUnitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [unit] = await db
    .update(bargainingUnitsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
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
