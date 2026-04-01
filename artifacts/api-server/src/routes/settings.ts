import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { districtsTable, bargainingUnitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const updateDistrictSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  state: z.string().optional(),
  fiscalYearStart: z.string().optional(),
  studentEnrollment: z.number().int().positive().optional(),
  defaultCpiAssumption: z.string().optional(),
  defaultHealthIncreaseRate: z.string().optional(),
  defaultHighEarnerThreshold: z.string().optional(),
  defaultHighEarnerFlatIncrease: z.string().optional(),
});

const updateBargainingUnitSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  compensationType: z.enum(["salary", "hourly"]).optional(),
  retirementSystem: z.enum(["TRS", "IMRF", "other"]).optional(),
  retirementEmployeeRate: z.string().optional(),
  retirementEmployerRate: z.string().optional(),
  retirementGrossUpRate: z.string().optional(),
  ficaRate: z.string().optional(),
  ficaExempt: z.boolean().optional(),
  healthInsuranceSingleAnnual: z.string().optional(),
  healthInsuranceFamilyAnnual: z.string().optional(),
  dentalAnnual: z.string().optional(),
  lifeInsuranceAnnual: z.string().optional(),
  disabilityInsuranceAnnual: z.string().optional(),
  hsaContributionSingle: z.string().optional(),
  hsaContributionFamily: z.string().optional(),
  workersCompRate: z.string().optional(),
  contractYears: z.number().int().min(1).max(10).optional(),
});

router.get("/settings/district/:id", async (req, res) => {
  const [district] = await db
    .select()
    .from(districtsTable)
    .where(eq(districtsTable.id, req.params.id));

  if (!district) {
    res.status(404).json({ error: "District not found" });
    return;
  }

  const bargainingUnits = await db
    .select()
    .from(bargainingUnitsTable)
    .where(eq(bargainingUnitsTable.districtId, req.params.id));

  res.json({ district, bargainingUnits });
});

router.put("/settings/district/:id", async (req, res) => {
  const parsed = updateDistrictSettingsSchema.safeParse(req.body);
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

router.get("/settings/bargaining-unit/:id", async (req, res) => {
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

router.put("/settings/bargaining-unit/:id", async (req, res) => {
  const parsed = updateBargainingUnitSettingsSchema.safeParse(req.body);
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

router.get("/settings", async (req, res) => {
  const { districtId } = req.query;
  if (!districtId) {
    res.status(400).json({ error: "districtId query param is required" });
    return;
  }

  const [district] = await db
    .select()
    .from(districtsTable)
    .where(eq(districtsTable.id, districtId as string));

  if (!district) {
    res.status(404).json({ error: "District not found" });
    return;
  }

  const bargainingUnits = await db
    .select()
    .from(bargainingUnitsTable)
    .where(eq(bargainingUnitsTable.districtId, districtId as string))
    .orderBy(bargainingUnitsTable.name);

  res.json({
    district,
    bargainingUnits,
    defaultAssumptions: {
      cpiAssumption: "3.0",
      healthInsuranceIncreaseRate: "5.0",
      highEarnerThreshold: "125000",
      highEarnerFlatIncrease: "3000",
      ssWageBase: "176100",
    },
  });
});

export default router;
