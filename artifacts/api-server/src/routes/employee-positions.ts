import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  employeePositionsTable,
  employeesTable,
  scenariosTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { runScenarioCalculation } from "@workspace/calc-engine";

const positionBodySchema = z.object({
  employeeGroupId: z.string().uuid().nullable().optional(),
  bargainingUnitId: z.string().uuid().nullable().optional(),
  compensationScheduleId: z.string().uuid().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  fteFraction: z.string().optional(),
  currentStep: z.number().int().nullable().optional(),
  currentLaneId: z.string().uuid().nullable().optional(),
  currentAnnualSalary: z.string().optional(),
  currentHourlyRate: z.string().nullable().optional(),
  annualHours: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  status: z.string().optional(),
  effectiveDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
});

const router = Router();

async function recalcForEmployee(employeeId: string, context: string) {
  const emp = await db
    .select({ districtId: employeesTable.districtId })
    .from(employeesTable)
    .where(eq(employeesTable.id, employeeId))
    .then((rows) => rows[0]);

  if (!emp) return;

  const scenarios = await db
    .select({ id: scenariosTable.id })
    .from(scenariosTable)
    .where(eq(scenariosTable.districtId, emp.districtId));

  for (const scenario of scenarios) {
    try {
      await runScenarioCalculation(scenario.id);
    } catch (err) {
      console.error(`[${context}] Failed to recalculate scenario ${scenario.id}:`, err);
    }
  }
}

router.get("/employees/:id/positions", async (req, res) => {
  const positions = await db
    .select()
    .from(employeePositionsTable)
    .where(eq(employeePositionsTable.employeeId, req.params.id))
    .orderBy(employeePositionsTable.displayOrder, employeePositionsTable.createdAt);

  res.json(positions);
});

router.post("/employees/:id/positions", async (req, res) => {
  const parsed = positionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;

  // If this position is being set as primary, demote all other positions first
  if (data.isPrimary) {
    await db
      .update(employeePositionsTable)
      .set({ isPrimary: false })
      .where(eq(employeePositionsTable.employeeId, req.params.id));
  }

  const [position] = await db
    .insert(employeePositionsTable)
    .values({ ...data, employeeId: req.params.id })
    .returning();

  await recalcForEmployee(req.params.id, "POST /employees/:id/positions");

  res.status(201).json(position);
});

router.put("/employee-positions/:id", async (req, res) => {
  const parsed = positionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const data = parsed.data;

  // If this position is being promoted to primary, demote others first
  if (data.isPrimary) {
    const [current] = await db
      .select({ employeeId: employeePositionsTable.employeeId })
      .from(employeePositionsTable)
      .where(eq(employeePositionsTable.id, req.params.id));

    if (current) {
      await db
        .update(employeePositionsTable)
        .set({ isPrimary: false })
        .where(
          and(
            eq(employeePositionsTable.employeeId, current.employeeId),
            // leave the current row alone — we'll set it below
          )
        );
    }
  }

  const [position] = await db
    .update(employeePositionsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(employeePositionsTable.id, req.params.id))
    .returning();

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  await recalcForEmployee(position.employeeId, "PUT /employee-positions/:id");

  res.json(position);
});

router.delete("/employee-positions/:id", async (req, res) => {
  const [position] = await db
    .delete(employeePositionsTable)
    .where(eq(employeePositionsTable.id, req.params.id))
    .returning();

  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }

  await recalcForEmployee(position.employeeId, "DELETE /employee-positions/:id");

  res.status(204).send();
});

export default router;
