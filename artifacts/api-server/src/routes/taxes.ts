import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { employerTaxConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const taxConfigBodySchema = z.object({
  districtId: z.string().uuid(),
  ssRate: z.string().default("0.062000"),
  ssWageBase: z.string().default("176100.00"),
  medicareRate: z.string().default("0.014500"),
  futaRate: z.string().default("0.006000"),
  futaWageBase: z.string().default("7000.00"),
  sutaRate: z.string().default("0.027000"),
  sutaWageBase: z.string().default("13000.00"),
  workersCompRatePer100: z.string().default("0.000000"),
  notes: z.string().nullable().optional(),
});

router.get("/taxes/config", async (req, res) => {
  const { districtId } = req.query;
  if (!districtId) { res.status(400).json({ error: "districtId required" }); return; }

  const config = await db
    .select()
    .from(employerTaxConfigTable)
    .where(eq(employerTaxConfigTable.districtId, districtId as string))
    .limit(1)
    .then((r) => r[0] ?? null);

  res.json(config);
});

router.put("/taxes/config", async (req, res) => {
  const parsed = taxConfigBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const { districtId, ...fields } = parsed.data;
  const existing = await db
    .select({ id: employerTaxConfigTable.id })
    .from(employerTaxConfigTable)
    .where(eq(employerTaxConfigTable.districtId, districtId))
    .limit(1)
    .then((r) => r[0]);

  let config;
  if (existing) {
    [config] = await db
      .update(employerTaxConfigTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(employerTaxConfigTable.id, existing.id))
      .returning();
  } else {
    [config] = await db
      .insert(employerTaxConfigTable)
      .values({ districtId, ...fields })
      .returning();
  }

  res.json(config);
});

export default router;
