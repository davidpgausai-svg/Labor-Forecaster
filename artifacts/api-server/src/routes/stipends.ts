import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  stipendDefinitionsTable,
  employeeStipendsTable,
  compensationSchedulesTable,
  employeesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const AMOUNT_TYPES = [
  "fixed_dollar",
  "percentage_of_base",
  "hourly",
  "per_event",
] as const;

const createStipendDefinitionSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("General"),
  amountType: z.enum(AMOUNT_TYPES),
  amountCents: z.number().int().nonnegative().default(0),
  percentageValue: z.string().regex(/^\d+(\.\d+)?$/).optional().nullable(),
  maxAmountCents: z.number().int().nonnegative().optional().nullable(),
  increaseWithBase: z.boolean().default(false),
  trsCreditable: z.boolean().default(false),
  imrfCreditable: z.boolean().default(false),
  displayOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

const updateStipendDefinitionSchema = createStipendDefinitionSchema.partial();

const createEmployeeStipendSchema = z.object({
  employeeId: z.string().uuid(),
  stipendDefinitionId: z.string().uuid(),
  effectiveYear: z.number().int().nonnegative().default(0),
  overrideAmountCents: z.number().int().nonnegative().optional().nullable(),
  hoursOrEvents: z.string().regex(/^\d+(\.\d+)?$/).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateEmployeeStipendSchema = createEmployeeStipendSchema
  .omit({ employeeId: true, stipendDefinitionId: true })
  .partial();

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// --- Stipend Definitions ---

/**
 * GET /compensation-schedules/:scheduleId/stipend-definitions
 * List all stipend definitions for a compensation schedule, ordered by displayOrder.
 */
router.get(
  "/compensation-schedules/:scheduleId/stipend-definitions",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const definitions = await db
      .select()
      .from(stipendDefinitionsTable)
      .where(
        eq(
          stipendDefinitionsTable.compensationScheduleId,
          req.params.scheduleId
        )
      )
      .orderBy(stipendDefinitionsTable.displayOrder);

    res.json(definitions);
  }
);

/**
 * POST /compensation-schedules/:scheduleId/stipend-definitions
 * Create a new stipend definition on a compensation schedule.
 */
router.post(
  "/compensation-schedules/:scheduleId/stipend-definitions",
  async (req, res) => {
    const [schedule] = await db
      .select()
      .from(compensationSchedulesTable)
      .where(eq(compensationSchedulesTable.id, req.params.scheduleId));
    if (!schedule) {
      res.status(404).json({ error: "Compensation schedule not found" });
      return;
    }

    const parsed = createStipendDefinitionSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [definition] = await db
      .insert(stipendDefinitionsTable)
      .values({
        ...parsed.data,
        compensationScheduleId: req.params.scheduleId,
      })
      .returning();

    res.status(201).json(definition);
  }
);

/**
 * GET /stipend-definitions/:id
 * Get a single stipend definition with its employee assignments.
 */
router.get("/stipend-definitions/:id", async (req, res) => {
  const [definition] = await db
    .select()
    .from(stipendDefinitionsTable)
    .where(eq(stipendDefinitionsTable.id, req.params.id));
  if (!definition) {
    res.status(404).json({ error: "Stipend definition not found" });
    return;
  }

  const assignments = await db
    .select({
      id: employeeStipendsTable.id,
      employeeId: employeeStipendsTable.employeeId,
      stipendDefinitionId: employeeStipendsTable.stipendDefinitionId,
      effectiveYear: employeeStipendsTable.effectiveYear,
      overrideAmountCents: employeeStipendsTable.overrideAmountCents,
      hoursOrEvents: employeeStipendsTable.hoursOrEvents,
      notes: employeeStipendsTable.notes,
      createdAt: employeeStipendsTable.createdAt,
      employeeFirstName: employeesTable.firstName,
      employeeLastName: employeesTable.lastName,
    })
    .from(employeeStipendsTable)
    .innerJoin(
      employeesTable,
      eq(employeeStipendsTable.employeeId, employeesTable.id)
    )
    .where(
      eq(employeeStipendsTable.stipendDefinitionId, req.params.id)
    )
    .orderBy(employeesTable.lastName, employeesTable.firstName);

  res.json({ ...definition, assignments });
});

/**
 * PUT /stipend-definitions/:id
 * Update a stipend definition.
 */
router.put("/stipend-definitions/:id", async (req, res) => {
  const parsed = updateStipendDefinitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(stipendDefinitionsTable)
    .set(parsed.data)
    .where(eq(stipendDefinitionsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Stipend definition not found" });
    return;
  }
  res.json(updated);
});

/**
 * DELETE /stipend-definitions/:id
 * Delete a stipend definition (cascades to employee_stipends via FK).
 */
router.delete("/stipend-definitions/:id", async (req, res) => {
  await db
    .delete(stipendDefinitionsTable)
    .where(eq(stipendDefinitionsTable.id, req.params.id));
  res.status(204).send();
});

// --- Employee Stipend Assignments ---

/**
 * GET /stipend-definitions/:definitionId/assignments
 * List all employee assignments for a stipend definition (with employee names).
 */
router.get(
  "/stipend-definitions/:definitionId/assignments",
  async (req, res) => {
    const assignments = await db
      .select({
        id: employeeStipendsTable.id,
        employeeId: employeeStipendsTable.employeeId,
        stipendDefinitionId: employeeStipendsTable.stipendDefinitionId,
        effectiveYear: employeeStipendsTable.effectiveYear,
        overrideAmountCents: employeeStipendsTable.overrideAmountCents,
        hoursOrEvents: employeeStipendsTable.hoursOrEvents,
        notes: employeeStipendsTable.notes,
        createdAt: employeeStipendsTable.createdAt,
        employeeFirstName: employeesTable.firstName,
        employeeLastName: employeesTable.lastName,
      })
      .from(employeeStipendsTable)
      .innerJoin(
        employeesTable,
        eq(employeeStipendsTable.employeeId, employeesTable.id)
      )
      .where(
        eq(
          employeeStipendsTable.stipendDefinitionId,
          req.params.definitionId
        )
      )
      .orderBy(employeesTable.lastName, employeesTable.firstName);

    res.json(assignments);
  }
);

/**
 * POST /stipend-definitions/:definitionId/assignments
 * Assign an employee to a stipend definition.
 */
router.post(
  "/stipend-definitions/:definitionId/assignments",
  async (req, res) => {
    const [definition] = await db
      .select()
      .from(stipendDefinitionsTable)
      .where(eq(stipendDefinitionsTable.id, req.params.definitionId));
    if (!definition) {
      res.status(404).json({ error: "Stipend definition not found" });
      return;
    }

    const parsed = createEmployeeStipendSchema.safeParse({
      ...req.body,
      stipendDefinitionId: req.params.definitionId,
    });
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
      return;
    }

    const [assignment] = await db
      .insert(employeeStipendsTable)
      .values(parsed.data)
      .returning();

    res.status(201).json(assignment);
  }
);

/**
 * PUT /stipend-assignments/:id
 * Update an employee stipend assignment (override amount, hours/events, notes).
 */
router.put("/stipend-assignments/:id", async (req, res) => {
  const parsed = updateEmployeeStipendSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(employeeStipendsTable)
    .set(parsed.data)
    .where(eq(employeeStipendsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Stipend assignment not found" });
    return;
  }
  res.json(updated);
});

/**
 * DELETE /stipend-assignments/:id
 * Remove an employee from a stipend.
 */
router.delete("/stipend-assignments/:id", async (req, res) => {
  await db
    .delete(employeeStipendsTable)
    .where(eq(employeeStipendsTable.id, req.params.id));
  res.status(204).send();
});

/**
 * GET /employees/:employeeId/stipends
 * All stipend assignments for a single employee (with definition details).
 * Useful for the employee detail page.
 */
router.get("/employees/:employeeId/stipends", async (req, res) => {
  const assignments = await db
    .select({
      id: employeeStipendsTable.id,
      employeeId: employeeStipendsTable.employeeId,
      stipendDefinitionId: employeeStipendsTable.stipendDefinitionId,
      effectiveYear: employeeStipendsTable.effectiveYear,
      overrideAmountCents: employeeStipendsTable.overrideAmountCents,
      hoursOrEvents: employeeStipendsTable.hoursOrEvents,
      notes: employeeStipendsTable.notes,
      createdAt: employeeStipendsTable.createdAt,
      definitionName: stipendDefinitionsTable.name,
      definitionCategory: stipendDefinitionsTable.category,
      definitionAmountType: stipendDefinitionsTable.amountType,
      definitionAmountCents: stipendDefinitionsTable.amountCents,
      definitionPercentageValue: stipendDefinitionsTable.percentageValue,
      definitionTrsCreditable: stipendDefinitionsTable.trsCreditable,
      definitionImrfCreditable: stipendDefinitionsTable.imrfCreditable,
    })
    .from(employeeStipendsTable)
    .innerJoin(
      stipendDefinitionsTable,
      eq(
        employeeStipendsTable.stipendDefinitionId,
        stipendDefinitionsTable.id
      )
    )
    .where(eq(employeeStipendsTable.employeeId, req.params.employeeId))
    .orderBy(stipendDefinitionsTable.displayOrder);

  res.json(assignments);
});

export default router;
