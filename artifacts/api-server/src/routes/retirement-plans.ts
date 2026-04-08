import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  retirementPlansTable,
  employeeGroupRetirementAssignmentsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const retirementPlanBodySchema = z.object({
  districtId: z.string().uuid(),
  planName: z.string().min(1),
  planType: z.enum(["defined_benefit", "defined_contribution"]),
  employerRate: z.string().default("0"),
  employerMatchCapPercent: z.string().nullable().optional(),
  grossUpRate: z.string().default("0"),
  employeeRate: z.string().default("0"),
  isFicaExempt: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
});

router.get("/retirement/plans", async (req, res) => {
  const { districtId } = req.query;
  if (!districtId) { res.status(400).json({ error: "districtId required" }); return; }
  const plans = await db
    .select()
    .from(retirementPlansTable)
    .where(eq(retirementPlansTable.districtId, districtId as string))
    .orderBy(retirementPlansTable.displayOrder, retirementPlansTable.planName);
  res.json(plans);
});

router.post("/retirement/plans", async (req, res) => {
  const parsed = retirementPlanBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const [plan] = await db.insert(retirementPlansTable).values(parsed.data).returning();
  res.status(201).json(plan);
});

router.put("/retirement/plans/:id", async (req, res) => {
  const parsed = retirementPlanBodySchema.partial().omit({ districtId: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }
  const [plan] = await db
    .update(retirementPlansTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(retirementPlansTable.id, req.params.id))
    .returning();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.json(plan);
});

router.delete("/retirement/plans/:id", async (req, res) => {
  const [plan] = await db
    .delete(retirementPlansTable)
    .where(eq(retirementPlansTable.id, req.params.id))
    .returning();
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  res.status(204).send();
});

// ── Group Assignments ───────────────────────────────────────────────────────

router.get("/retirement/group-assignments", async (req, res) => {
  const { employeeGroupId } = req.query;
  if (!employeeGroupId) { res.status(400).json({ error: "employeeGroupId required" }); return; }
  const rows = await db
    .select()
    .from(employeeGroupRetirementAssignmentsTable)
    .where(eq(employeeGroupRetirementAssignmentsTable.employeeGroupId, employeeGroupId as string));
  res.json(rows);
});

const groupAssignmentsBatchSchema = z.object({
  employeeGroupId: z.string().uuid(),
  retirementPlanIds: z.array(z.string().uuid()),
});

router.put("/retirement/group-assignments", async (req, res) => {
  const parsed = groupAssignmentsBatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.issues }); return; }

  const { employeeGroupId, retirementPlanIds } = parsed.data;

  await db
    .delete(employeeGroupRetirementAssignmentsTable)
    .where(eq(employeeGroupRetirementAssignmentsTable.employeeGroupId, employeeGroupId));

  if (retirementPlanIds.length > 0) {
    await db.insert(employeeGroupRetirementAssignmentsTable).values(
      retirementPlanIds.map((id) => ({ employeeGroupId, retirementPlanId: id }))
    );
  }

  const result = await db
    .select()
    .from(employeeGroupRetirementAssignmentsTable)
    .where(eq(employeeGroupRetirementAssignmentsTable.employeeGroupId, employeeGroupId));
  res.json(result);
});

export default router;
