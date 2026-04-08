import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  benefitPlanTypesTable,
  benefitPlanTiersTable,
  benefitPlanRatesTable,
  benefitEligibilityRulesTable,
  employerAccountContributionsTable,
  employerFlatCostsTable,
  employeeGroupBenefitAssignmentsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router = Router();

// ── Plan Types ─────────────────────────────────────────────────────────────

const planTypeBodySchema = z.object({
  districtId: z.string().uuid(),
  category: z.string().min(1),
  planName: z.string().min(1),
  calculationMethod: z.enum(["flat_dollar", "rate_per_100", "rate_per_1000", "percent_of_salary"]),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

router.get("/benefits/plans", async (req, res) => {
  const { districtId } = req.query;
  if (!districtId) { res.status(400).json({ error: "districtId required" }); return; }

  const plans = await db
    .select()
    .from(benefitPlanTypesTable)
    .where(eq(benefitPlanTypesTable.districtId, districtId as string))
    .orderBy(benefitPlanTypesTable.displayOrder, benefitPlanTypesTable.planName);

  if (plans.length === 0) { res.json([]); return; }

  const planIds = plans.map((p) => p.id);
  const [tiers, rates] = await Promise.all([
    db.select().from(benefitPlanTiersTable).where(inArray(benefitPlanTiersTable.benefitPlanTypeId, planIds)),
    db.select().from(benefitPlanRatesTable).where(inArray(benefitPlanRatesTable.benefitPlanTypeId, planIds)),
  ]);

  const result = plans.map((plan) => ({
    ...plan,
    tiers: tiers.filter((t) => t.benefitPlanTypeId === plan.id),
    rate: rates.find((r) => r.benefitPlanTypeId === plan.id) ?? null,
  }));

  res.json(result);
});

router.post("/benefits/plans", async (req, res) => {
  const parsed = planTypeBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const [plan] = await db.insert(benefitPlanTypesTable).values(parsed.data).returning();
  res.status(201).json(plan);
});

router.put("/benefits/plans/:id", async (req, res) => {
  const parsed = planTypeBodySchema.partial().omit({ districtId: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const [plan] = await db
    .update(benefitPlanTypesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(benefitPlanTypesTable.id, req.params.id))
    .returning();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(plan);
});

router.delete("/benefits/plans/:id", async (req, res) => {
  const [plan] = await db
    .delete(benefitPlanTypesTable)
    .where(eq(benefitPlanTypesTable.id, req.params.id))
    .returning();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.status(204).send();
});

// ── Plan Tiers (batch upsert all 4 tiers) ──────────────────────────────────

const tiersBodySchema = z.array(
  z.object({
    tier: z.enum(["ee_only", "ee_spouse", "ee_child", "family"]),
    employerContributionAnnual: z.string(),
  })
);

router.put("/benefits/plans/:id/tiers", async (req, res) => {
  const parsed = tiersBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const planId = req.params.id;
  const now = new Date();

  // Delete existing tiers then re-insert
  await db.delete(benefitPlanTiersTable).where(eq(benefitPlanTiersTable.benefitPlanTypeId, planId));

  if (parsed.data.length > 0) {
    await db.insert(benefitPlanTiersTable).values(
      parsed.data.map((t) => ({ ...t, benefitPlanTypeId: planId, updatedAt: now }))
    );
  }

  const tiers = await db
    .select()
    .from(benefitPlanTiersTable)
    .where(eq(benefitPlanTiersTable.benefitPlanTypeId, planId));

  res.json(tiers);
});

// ── Plan Rate (upsert single rate config) ──────────────────────────────────

const rateBodySchema = z.object({
  rate: z.string(),
  coveredEarningsCap: z.string().nullable().optional(),
  benefitMultiplier: z.string().nullable().optional(),
  flatBenefitAmount: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.put("/benefits/plans/:id/rate", async (req, res) => {
  const parsed = rateBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const planId = req.params.id;
  const existing = await db
    .select({ id: benefitPlanRatesTable.id })
    .from(benefitPlanRatesTable)
    .where(eq(benefitPlanRatesTable.benefitPlanTypeId, planId))
    .limit(1)
    .then((r) => r[0]);

  let rate;
  if (existing) {
    [rate] = await db
      .update(benefitPlanRatesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(benefitPlanRatesTable.id, existing.id))
      .returning();
  } else {
    [rate] = await db
      .insert(benefitPlanRatesTable)
      .values({ ...parsed.data, benefitPlanTypeId: planId })
      .returning();
  }

  res.json(rate);
});

// ── Eligibility Rules ──────────────────────────────────────────────────────

router.get("/benefits/eligibility", async (req, res) => {
  const { districtId } = req.query;
  if (!districtId) { res.status(400).json({ error: "districtId required" }); return; }
  const rules = await db
    .select()
    .from(benefitEligibilityRulesTable)
    .where(eq(benefitEligibilityRulesTable.districtId, districtId as string))
    .orderBy(benefitEligibilityRulesTable.category);
  res.json(rules);
});

const eligibilityBatchSchema = z.object({
  districtId: z.string().uuid(),
  rules: z.array(z.object({
    category: z.string().min(1),
    minFteThreshold: z.string(),
    includePartTime: z.boolean(),
    includeSeasonal: z.boolean(),
    notes: z.string().nullable().optional(),
  })),
});

router.put("/benefits/eligibility", async (req, res) => {
  const parsed = eligibilityBatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const { districtId, rules } = parsed.data;
  const now = new Date();

  for (const rule of rules) {
    const existing = await db
      .select({ id: benefitEligibilityRulesTable.id })
      .from(benefitEligibilityRulesTable)
      .where(
        and(
          eq(benefitEligibilityRulesTable.districtId, districtId),
          eq(benefitEligibilityRulesTable.category, rule.category)
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(benefitEligibilityRulesTable)
        .set({ ...rule, updatedAt: now })
        .where(eq(benefitEligibilityRulesTable.id, existing.id));
    } else {
      await db.insert(benefitEligibilityRulesTable).values({ ...rule, districtId });
    }
  }

  const result = await db
    .select()
    .from(benefitEligibilityRulesTable)
    .where(eq(benefitEligibilityRulesTable.districtId, districtId));
  res.json(result);
});

// ── HSA / HRA Contributions ─────────────────────────────────────────────────

router.get("/benefits/hsa-hra", async (req, res) => {
  const { districtId } = req.query;
  if (!districtId) { res.status(400).json({ error: "districtId required" }); return; }
  const rows = await db
    .select()
    .from(employerAccountContributionsTable)
    .where(eq(employerAccountContributionsTable.districtId, districtId as string))
    .orderBy(employerAccountContributionsTable.accountType, employerAccountContributionsTable.tier);
  res.json(rows);
});

const hsaHraBatchSchema = z.object({
  districtId: z.string().uuid(),
  contributions: z.array(z.object({
    accountType: z.enum(["hsa", "hra"]),
    tier: z.enum(["ee_only", "ee_spouse", "ee_child", "family"]),
    employerContributionAnnual: z.string(),
  })),
});

router.put("/benefits/hsa-hra", async (req, res) => {
  const parsed = hsaHraBatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const { districtId, contributions } = parsed.data;
  const now = new Date();

  for (const contrib of contributions) {
    const existing = await db
      .select({ id: employerAccountContributionsTable.id })
      .from(employerAccountContributionsTable)
      .where(
        and(
          eq(employerAccountContributionsTable.districtId, districtId),
          eq(employerAccountContributionsTable.accountType, contrib.accountType),
          eq(employerAccountContributionsTable.tier, contrib.tier)
        )
      )
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(employerAccountContributionsTable)
        .set({ employerContributionAnnual: contrib.employerContributionAnnual, updatedAt: now })
        .where(eq(employerAccountContributionsTable.id, existing.id));
    } else {
      await db.insert(employerAccountContributionsTable).values({ ...contrib, districtId });
    }
  }

  const result = await db
    .select()
    .from(employerAccountContributionsTable)
    .where(eq(employerAccountContributionsTable.districtId, districtId));
  res.json(result);
});

// ── Flat Costs ──────────────────────────────────────────────────────────────

router.get("/benefits/flat-costs", async (req, res) => {
  const { districtId } = req.query;
  if (!districtId) { res.status(400).json({ error: "districtId required" }); return; }
  const rows = await db
    .select()
    .from(employerFlatCostsTable)
    .where(eq(employerFlatCostsTable.districtId, districtId as string))
    .orderBy(employerFlatCostsTable.costName);
  res.json(rows);
});

const flatCostBodySchema = z.object({
  districtId: z.string().uuid(),
  costName: z.string().min(1),
  annualCostPerEmployee: z.string(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

router.post("/benefits/flat-costs", async (req, res) => {
  const parsed = flatCostBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const [row] = await db.insert(employerFlatCostsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.put("/benefits/flat-costs/:id", async (req, res) => {
  const parsed = flatCostBodySchema.partial().omit({ districtId: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const [row] = await db
    .update(employerFlatCostsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(employerFlatCostsTable.id, req.params.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/benefits/flat-costs/:id", async (req, res) => {
  const [row] = await db
    .delete(employerFlatCostsTable)
    .where(eq(employerFlatCostsTable.id, req.params.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ── Group Assignments ───────────────────────────────────────────────────────

router.get("/benefits/group-assignments", async (req, res) => {
  const { employeeGroupId } = req.query;
  if (!employeeGroupId) { res.status(400).json({ error: "employeeGroupId required" }); return; }
  const rows = await db
    .select()
    .from(employeeGroupBenefitAssignmentsTable)
    .where(eq(employeeGroupBenefitAssignmentsTable.employeeGroupId, employeeGroupId as string));
  res.json(rows);
});

const groupAssignmentsBatchSchema = z.object({
  employeeGroupId: z.string().uuid(),
  benefitPlanTypeIds: z.array(z.string().uuid()),
});

router.put("/benefits/group-assignments", async (req, res) => {
  const parsed = groupAssignmentsBatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const { employeeGroupId, benefitPlanTypeIds } = parsed.data;

  await db
    .delete(employeeGroupBenefitAssignmentsTable)
    .where(eq(employeeGroupBenefitAssignmentsTable.employeeGroupId, employeeGroupId));

  if (benefitPlanTypeIds.length > 0) {
    await db.insert(employeeGroupBenefitAssignmentsTable).values(
      benefitPlanTypeIds.map((id) => ({ employeeGroupId, benefitPlanTypeId: id }))
    );
  }

  const result = await db
    .select()
    .from(employeeGroupBenefitAssignmentsTable)
    .where(eq(employeeGroupBenefitAssignmentsTable.employeeGroupId, employeeGroupId));
  res.json(result);
});

export default router;
