import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  employeeGroupsTable,
  compensationSchedulesTable,
  employeesTable,
  employeePositionsTable,
} from "@workspace/db";
import { eq, or, count } from "drizzle-orm";

const numericString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a numeric string");

const createEmployeeGroupSchema = z.object({
  districtId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  contractDays: z.number().int().positive().optional().nullable(),
  bargainingUnitName: z.string().optional().nullable(),
  isUnionized: z.boolean().default(true),
  contractStartDate: z.string().optional().nullable(),
  contractEndDate: z.string().optional().nullable(),
  contractYears: z.number().int().min(1).max(20).default(5),
  retirementSystem: z.string().default("TRS"),
  retirementEmployeeRate: numericString.optional(),
  retirementEmployerRate: numericString.optional(),
  retirementGrossUpRate: numericString.optional(),
  ficaRate: numericString.optional(),
  ficaExempt: z.boolean().default(false),
  healthInsuranceSingleAnnual: numericString.optional(),
  healthInsuranceFamilyAnnual: numericString.optional(),
  healthInsuranceEmployerCapRate: numericString.optional().nullable(),
  dentalAnnual: numericString.optional(),
  lifeInsuranceAnnual: numericString.optional(),
  disabilityInsuranceAnnual: numericString.optional(),
  hsaContributionSingle: numericString.optional(),
  hsaContributionFamily: numericString.optional(),
  workersCompRate: numericString.optional(),
  displayOrder: z.number().int().nonnegative().optional(),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

const updateEmployeeGroupSchema = createEmployeeGroupSchema
  .omit({ districtId: true })
  .partial();

async function getGroupWithSchedules(id: string) {
  const [group] = await db
    .select()
    .from(employeeGroupsTable)
    .where(eq(employeeGroupsTable.id, id));
  if (!group) return null;
  const schedules = await db
    .select()
    .from(compensationSchedulesTable)
    .where(eq(compensationSchedulesTable.employeeGroupId, id))
    .orderBy(compensationSchedulesTable.displayOrder);
  return { ...group, compensationSchedules: schedules };
}

const router = Router();

router.get("/employee-groups", async (req, res) => {
  const { districtId } = req.query;
  const groups = districtId
    ? await db
        .select()
        .from(employeeGroupsTable)
        .where(
          eq(employeeGroupsTable.districtId, districtId as string)
        )
        .orderBy(employeeGroupsTable.displayOrder)
    : await db
        .select()
        .from(employeeGroupsTable)
        .orderBy(employeeGroupsTable.displayOrder);

  const groupsWithSchedules = await Promise.all(
    groups.map(async (g) => {
      const schedules = await db
        .select()
        .from(compensationSchedulesTable)
        .where(eq(compensationSchedulesTable.employeeGroupId, g.id))
        .orderBy(compensationSchedulesTable.displayOrder);
      return { ...g, compensationSchedules: schedules };
    })
  );

  res.json(groupsWithSchedules);
});

router.post("/employee-groups", async (req, res) => {
  const parsed = createEmployeeGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues,
    });
    return;
  }
  const [group] = await db
    .insert(employeeGroupsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json({ ...group, compensationSchedules: [] });
});

router.get("/employee-groups/:id", async (req, res) => {
  const group = await getGroupWithSchedules(req.params.id);
  if (!group) {
    res.status(404).json({ error: "Employee group not found" });
    return;
  }
  res.json(group);
});

router.put("/employee-groups/:id", async (req, res) => {
  const parsed = updateEmployeeGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: parsed.error.issues,
    });
    return;
  }
  const [updated] = await db
    .update(employeeGroupsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(employeeGroupsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Employee group not found" });
    return;
  }
  const group = await getGroupWithSchedules(updated.id);
  res.json(group);
});

router.delete("/employee-groups/:id", async (req, res) => {
  const groupId = req.params.id;

  // Count employees directly assigned to this group (current or pending)
  const [empCount] = await db
    .select({ total: count() })
    .from(employeesTable)
    .where(
      or(
        eq(employeesTable.employeeGroupId, groupId),
        eq(employeesTable.pendingEmployeeGroupId, groupId)
      )
    );

  // Count positions assigned to this group
  const [posCount] = await db
    .select({ total: count() })
    .from(employeePositionsTable)
    .where(eq(employeePositionsTable.employeeGroupId, groupId));

  const employeeTotal = empCount?.total ?? 0;
  const positionTotal = posCount?.total ?? 0;

  if (employeeTotal > 0 || positionTotal > 0) {
    res.status(409).json({
      error: "Cannot delete employee group with assigned employees",
      employeeCount: employeeTotal,
      positionCount: positionTotal,
      message:
        `This group has ${employeeTotal} employee${employeeTotal !== 1 ? "s" : ""}` +
        (positionTotal > 0 ? ` and ${positionTotal} position${positionTotal !== 1 ? "s" : ""}` : "") +
        " assigned to it. Reassign them before deleting.",
    });
    return;
  }

  await db
    .delete(employeeGroupsTable)
    .where(eq(employeeGroupsTable.id, groupId));
  res.status(204).send();
});

export default router;
