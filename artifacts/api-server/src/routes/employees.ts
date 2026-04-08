import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  employeesTable,
  bargainingUnitsTable,
  employeeGroupsTable,
  compensationSchedulesTable,
  lanesTable,
  scenarioYearConfigsTable,
  employeeYearRecordsTable,
  scenariosTable,
  employeePositionsTable,
} from "@workspace/db";
import { eq, and, sql, or, inArray, isNull, ilike } from "drizzle-orm";
import {
  calcRetirementOption1,
  calcRetirementOption2,
  calcRetirementOption3,
  runScenarioCalculation,
} from "@workspace/calc-engine";

const createEmployeeSchema = z.object({
  districtId: z.string().uuid(),
  bargainingUnitId: z.string().uuid().optional(),
  employeeGroupId: z.string().uuid().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeNumber: z.string().optional(),
  compensationType: z.enum(["salary", "hourly"]).default("salary"),
  currentAnnualSalary: z.string().default("0"),
  currentStep: z.number().int().min(1).optional(),
  currentLaneId: z.string().uuid().optional(),
  currentHourlyRate: z.string().optional(),
  annualHours: z.string().optional(),
  currentHourlyCategoryId: z.string().uuid().optional(),
  insuranceElection: z.enum(["single", "single_plus_spouse", "single_plus_child", "family", "waived"]).default("single"),
  retirementEligible: z.boolean().default(false),
  retirementPlan: z.enum(["none", "option1_4year", "option2_2year", "option3_longevity"]).default("none"),
  retirementTargetYear: z.number().int().optional(),
  hireDate: z.string().optional(),
  birthDate: z.string().optional(),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  yearsInDistrict: z.number().int().default(0),
  yearsTotalService: z.number().int().default(0),
  status: z.enum(["active", "new_hire", "terminated", "retired", "on_leave"]).default("active"),
  contractYear: z.number().int().default(0),
  notes: z.string().optional(),
});

const router = Router();

router.get("/employees/retirement-eligible", async (req, res) => {
  const { districtId } = req.query;

  const rows = districtId
    ? await db
        .select({
          employee: employeesTable,
          unitName: bargainingUnitsTable.name,
        })
        .from(employeesTable)
        .leftJoin(
          bargainingUnitsTable,
          eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id)
        )
        .where(
          and(
            eq(employeesTable.retirementEligible, true),
            eq(employeesTable.districtId, districtId as string)
          )
        )
    : await db
        .select({
          employee: employeesTable,
          unitName: bargainingUnitsTable.name,
        })
        .from(employeesTable)
        .leftJoin(
          bargainingUnitsTable,
          eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id)
        )
        .where(eq(employeesTable.retirementEligible, true));

  const results = rows.map((row) => {
    const emp = row.employee;
    const age = emp.birthDate
      ? new Date().getFullYear() - new Date(emp.birthDate).getFullYear()
      : 55;
    const opt1 = calcRetirementOption1(emp.currentAnnualSalary, emp.yearsInDistrict, emp.yearsTotalService, age);
    const opt2 = calcRetirementOption2(emp.currentAnnualSalary, emp.yearsInDistrict, emp.yearsTotalService, age);
    const opt3 = calcRetirementOption3(emp.currentAnnualSalary, emp.yearsInDistrict, age);
    return { ...emp, bargainingUnitName: row.unitName, retirementOptions: { option1: opt1, option2: opt2, option3: opt3 } };
  });

  res.json(results);
});

router.post("/employees/import", async (req, res) => {
  const { districtId, bargainingUnitId, employees, incremental: _incremental } = req.body;
  if (!districtId || !employees?.length) {
    res.status(400).json({ error: "districtId and employees are required" });
    return;
  }

  let imported = 0;
  const errors: Array<{ row: number; message: string }> = [];

  // Group rows by employeeNumber (rows without one are each their own group)
  type RowEntry = { index: number; row: Record<string, unknown> };
  const groups = new Map<string, RowEntry[]>();
  for (let i = 0; i < employees.length; i++) {
    const row = employees[i] as Record<string, unknown>;
    const empNum = typeof row.employeeNumber === "string" && row.employeeNumber.trim()
      ? row.employeeNumber.trim()
      : `__no_num_${i}`;
    const existing = groups.get(empNum) ?? [];
    existing.push({ index: i, row });
    groups.set(empNum, existing);
  }

  for (const [, entries] of groups) {
    const firstEntry = entries[0];
    const firstRow = firstEntry.row;
    try {
      const empValues: typeof employeesTable.$inferInsert = {
        districtId,
        bargainingUnitId: (bargainingUnitId || String(firstRow.bargainingUnitId ?? "")) as string,
        employeeGroupId: (firstRow.employeeGroupId ?? undefined) as string | undefined,
        firstName: String(firstRow.firstName ?? ""),
        lastName: String(firstRow.lastName ?? ""),
        employeeNumber: typeof firstRow.employeeNumber === "string" && firstRow.employeeNumber.trim()
          ? firstRow.employeeNumber.trim()
          : null,
        compensationType: (firstRow.compensationType ?? "salary") as "salary" | "hourly",
        currentAnnualSalary: String(firstRow.currentAnnualSalary ?? "0"),
        currentStep: firstRow.currentStep != null ? Number(firstRow.currentStep) : null,
        currentLaneId: (firstRow.currentLaneId ?? null) as string | null | undefined,
        currentHourlyRate: firstRow.currentHourlyRate != null ? String(firstRow.currentHourlyRate) : null,
        annualHours: firstRow.annualHours != null ? String(firstRow.annualHours) : null,
        insuranceElection: (firstRow.insuranceElection ?? "waived") as typeof employeesTable.$inferInsert["insuranceElection"],
        retirementEligible: firstRow.retirementEligible === true || firstRow.retirementEligible === "true",
        retirementPlan: (firstRow.retirementPlan ?? "none") as "none" | "option1_4year" | "option2_2year" | "option3_longevity",
        yearsInDistrict: Number(firstRow.yearsInDistrict ?? 0),
        yearsTotalService: Number(firstRow.yearsTotalService ?? 0),
        effectiveDate: (firstRow.effectiveDate ?? null) as string | null | undefined,
        status: (firstRow.status ?? "active") as typeof employeesTable.$inferInsert["status"],
        contractYear: Number(firstRow.contractYear ?? 0),
      };

      const [insertedEmp] = await db.insert(employeesTable).values(empValues).returning({ id: employeesTable.id });

      // If multiple rows share this employeeNumber, create a position for each
      if (entries.length > 1) {
        const positionRows: typeof employeePositionsTable.$inferInsert[] = entries.map((entry, posIdx) => ({
          employeeId: insertedEmp.id,
          employeeGroupId: (entry.row.employeeGroupId ?? null) as string | null | undefined,
          bargainingUnitId: (bargainingUnitId || entry.row.bargainingUnitId || null) as string | null | undefined,
          compensationScheduleId: (entry.row.compensationScheduleId ?? null) as string | null | undefined,
          jobTitle: (entry.row.jobTitle ?? null) as string | null | undefined,
          fteFraction: entry.row.fteFraction != null ? String(entry.row.fteFraction) : "1.0000",
          currentStep: entry.row.currentStep != null ? Number(entry.row.currentStep) : null,
          currentLaneId: (entry.row.currentLaneId ?? null) as string | null | undefined,
          currentAnnualSalary: String(entry.row.currentAnnualSalary ?? "0"),
          currentHourlyRate: entry.row.currentHourlyRate != null ? String(entry.row.currentHourlyRate) : null,
          annualHours: entry.row.annualHours != null ? String(entry.row.annualHours) : null,
          isPrimary: posIdx === 0,
          status: (entry.row.status ?? "active") as typeof employeePositionsTable.$inferInsert["status"],
          effectiveDate: (entry.row.effectiveDate ?? null) as string | null | undefined,
          displayOrder: posIdx,
        }));
        await db.insert(employeePositionsTable).values(positionRows);
      }

      imported++;
    } catch (err: unknown) {
      errors.push({ row: firstEntry.index + 1, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  res.json({ imported, skipped: 0, errors });
});

router.get("/employees", async (req, res) => {
  const { districtId, bargainingUnitId, employeeGroupId, status, contractYear, search, page = 1, pageSize = 50 } = req.query;

  const conditions = [];
  if (districtId) conditions.push(eq(employeesTable.districtId, districtId as string));
  if (bargainingUnitId) {
    // Union filter: only employees calculated on the BU path (no group override)
    conditions.push(eq(employeesTable.bargainingUnitId, bargainingUnitId as string));
    conditions.push(isNull(employeesTable.employeeGroupId));
  }
  if (employeeGroupId) conditions.push(eq(employeesTable.employeeGroupId, employeeGroupId as string));
  if (status) conditions.push(eq(employeesTable.status, status as "active" | "new_hire" | "terminated" | "retired" | "on_leave"));
  if (contractYear) conditions.push(eq(employeesTable.contractYear, Number(contractYear)));
  if (search) {
    const q = `%${search}%`;
    conditions.push(
      or(
        ilike(employeesTable.firstName, q),
        ilike(employeesTable.lastName, q),
        sql`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName}) ilike ${q}`,
        sql`concat(${employeesTable.lastName}, ', ', ${employeesTable.firstName}) ilike ${q}`,
        sql`${employeeGroupsTable.name} ilike ${q}`,
      )!
    );
  }

  const offset = (Number(page) - 1) * Number(pageSize);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [employees, countResult] = await Promise.all([
    db
      .select({
        employee: employeesTable,
        unitName: bargainingUnitsTable.name,
        groupName: employeeGroupsTable.name,
        laneName: lanesTable.name,
      })
      .from(employeesTable)
      .leftJoin(bargainingUnitsTable, eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id))
      .leftJoin(employeeGroupsTable, eq(employeesTable.employeeGroupId, employeeGroupsTable.id))
      .leftJoin(lanesTable, eq(employeesTable.currentLaneId, lanesTable.id))
      .where(whereClause)
      .orderBy(employeesTable.lastName, employeesTable.firstName)
      .limit(Number(pageSize))
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeesTable)
      .leftJoin(employeeGroupsTable, eq(employeesTable.employeeGroupId, employeeGroupsTable.id))
      .where(whereClause),
  ]);

  const result = employees.map((row) => ({
    ...row.employee,
    bargainingUnitName: row.unitName,
    employeeGroupName: row.groupName,
    laneName: row.laneName,
  }));

  res.json({ employees: result, total: countResult[0]?.count ?? 0, page: Number(page), pageSize: Number(pageSize) });
});

router.post("/employees", async (req, res) => {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const insertData: typeof employeesTable.$inferInsert = {
    ...parsed.data,
  };
  const [emp] = await db.insert(employeesTable).values(insertData).returning();
  res.status(201).json(emp);
});

router.get("/employees/export", async (req, res) => {
  const { districtId, bargainingUnitId, scenarioId } = req.query;

  const conditions = [];
  if (districtId) conditions.push(eq(employeesTable.districtId, districtId as string));
  if (bargainingUnitId) conditions.push(eq(employeesTable.bargainingUnitId, bargainingUnitId as string));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      employee: employeesTable,
      unitName: bargainingUnitsTable.name,
      laneName: lanesTable.name,
    })
    .from(employeesTable)
    .leftJoin(bargainingUnitsTable, eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id))
    .leftJoin(lanesTable, eq(employeesTable.currentLaneId, lanesTable.id))
    .where(whereClause)
    .orderBy(employeesTable.lastName, employeesTable.firstName);

  const csvHeaders = [
    "Employee Number",
    "Last Name",
    "First Name",
    "Bargaining Unit",
    "Compensation Type",
    "Current Annual Salary",
    "Current Hourly Rate",
    "Annual Hours",
    "Lane",
    "Step",
    "Insurance Election",
    "Retirement Eligible",
    "Retirement Plan",
    "Years in District",
    "Years Total Service",
    "Status",
    "Hire Date",
  ];

  const csvRows = rows.map((row) => {
    const e = row.employee;
    return [
      e.employeeNumber ?? "",
      e.lastName,
      e.firstName,
      row.unitName ?? "",
      e.compensationType,
      e.currentAnnualSalary,
      e.currentHourlyRate ?? "",
      e.annualHours ?? "",
      row.laneName ?? "",
      e.currentStep ?? "",
      e.insuranceElection,
      e.retirementEligible ? "Yes" : "No",
      e.retirementPlan,
      e.yearsInDistrict,
      e.yearsTotalService,
      e.status,
      e.hireDate ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [csvHeaders.join(","), ...csvRows].join("\n");

  const filename = `employees-export-${new Date().toISOString().split("T")[0]}.csv`;
  if (scenarioId) {
    res.setHeader("X-Scenario-Id", scenarioId as string);
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

router.get("/employees/:id", async (req, res) => {
  const { scenarioId } = req.query;

  const rows = await db
    .select({
      employee: employeesTable,
      unitName: bargainingUnitsTable.name,
      groupName: employeeGroupsTable.name,
      scheduleType: compensationSchedulesTable.scheduleType,
      laneName: lanesTable.name,
    })
    .from(employeesTable)
    .leftJoin(bargainingUnitsTable, eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id))
    .leftJoin(employeeGroupsTable, eq(employeesTable.employeeGroupId, employeeGroupsTable.id))
    .leftJoin(compensationSchedulesTable, eq(compensationSchedulesTable.employeeGroupId, employeeGroupsTable.id))
    .leftJoin(lanesTable, eq(employeesTable.currentLaneId, lanesTable.id))
    .where(eq(employeesTable.id, req.params.id));

  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const emp = row.employee;
  const employeeGroupName = row.groupName ?? null;
  const compensationScheduleType = row.scheduleType ?? null;

  const positions = await db
    .select()
    .from(employeePositionsTable)
    .where(eq(employeePositionsTable.employeeId, emp.id))
    .orderBy(employeePositionsTable.displayOrder, employeePositionsTable.createdAt);

  let yearProjections: unknown[] = [];

  if (scenarioId) {
    // Load year configs for this scenario — match by BU or by employee group
    const buCondition = emp.bargainingUnitId
      ? eq(scenarioYearConfigsTable.bargainingUnitId, emp.bargainingUnitId)
      : null;
    const groupCondition = emp.employeeGroupId
      ? eq(scenarioYearConfigsTable.employeeGroupId, emp.employeeGroupId)
      : null;

    const configConditions = [buCondition, groupCondition].filter(Boolean);
    const yearConfigs = configConditions.length > 0
      ? await db
          .select()
          .from(scenarioYearConfigsTable)
          .where(
            and(
              eq(scenarioYearConfigsTable.scenarioId, scenarioId as string),
              or(...(configConditions as Parameters<typeof or>))
            )
          )
          .orderBy(scenarioYearConfigsTable.contractYear)
      : [];

    const records = await db
      .select()
      .from(employeeYearRecordsTable)
      .where(
        and(
          eq(employeeYearRecordsTable.employeeId, emp.id),
          eq(employeeYearRecordsTable.scenarioId, scenarioId as string)
        )
      )
      .orderBy(employeeYearRecordsTable.contractYear);

    // Resolve lane names for all projected lane IDs
    const projectedLaneIds = [...new Set(records.map((r) => r.projectedLaneId).filter(Boolean))] as string[];
    const projectedLanes = projectedLaneIds.length > 0
      ? await db.select().from(lanesTable).where(inArray(lanesTable.id, projectedLaneIds))
      : [];
    const laneNameMap = new Map(projectedLanes.map((l) => [l.id, l.name]));

    yearProjections = records.map((r) => {
      const config = yearConfigs.find((c) => c.contractYear === r.contractYear);
      return {
        ...r,
        yearLabel: config?.yearLabel ?? `Year ${r.contractYear}`,
        projectedLaneName: r.projectedLaneId ? (laneNameMap.get(r.projectedLaneId) ?? null) : null,
      };
    });
  }

  // For employees whose base salary lives on a position (grid schedules), derive the
  // effective display salary from the primary position when employees.currentAnnualSalary is $0.
  const primaryPosition = positions.find((p) => p.isPrimary) ?? positions[0] ?? null;
  const effectiveSalary =
    parseFloat(emp.currentAnnualSalary) > 0
      ? emp.currentAnnualSalary
      : (primaryPosition && parseFloat(primaryPosition.currentAnnualSalary ?? "0") > 0
          ? primaryPosition.currentAnnualSalary!
          : emp.currentAnnualSalary);

  const age = emp.birthDate ? new Date().getFullYear() - new Date(emp.birthDate).getFullYear() : 55;
  let retirementOptions = null;
  if (emp.retirementEligible) {
    retirementOptions = {
      option1: calcRetirementOption1(effectiveSalary, emp.yearsInDistrict, emp.yearsTotalService, age),
      option2: calcRetirementOption2(effectiveSalary, emp.yearsInDistrict, emp.yearsTotalService, age),
      option3: calcRetirementOption3(effectiveSalary, emp.yearsInDistrict, age),
    };
  }

  res.json({ ...emp, currentAnnualSalary: effectiveSalary, bargainingUnitName: row.unitName, employeeGroupName, compensationScheduleType, laneName: row.laneName, positions, yearProjections, retirementOptions });
});

async function recalcDistrictScenarios(districtId: string, context: string): Promise<{ count: number; errors: string[] }> {
  const scenarios = await db
    .select({ id: scenariosTable.id })
    .from(scenariosTable)
    .where(eq(scenariosTable.districtId, districtId));

  const errors: string[] = [];
  for (const scenario of scenarios) {
    try {
      await runScenarioCalculation(scenario.id);
    } catch (err) {
      errors.push(scenario.id);
      console.error(`[${context}] Failed to recalculate scenario ${scenario.id}:`, err);
    }
  }
  return { count: scenarios.length, errors };
}

router.put("/employees/:id", async (req, res) => {
  const body = req.body;
  const { effectiveContractYear, ...fields } = body;

  let empResult;

  // effectiveContractYear is a 0-based index: 0 = current district year (immediate correction),
  // > 0 = future year (deferred/pending change). This maps directly to the scenario year index.
  if (effectiveContractYear != null && Number(effectiveContractYear) > 0) {
    // Future edit — write only non-positional fields to live columns.
    // Position-related fields (BU, group, step, lane, salary) go to pending_* only.
    // Live BU/group/step/lane/salary are left completely unchanged.
    const liveFields: Record<string, unknown> = { updatedAt: new Date() };
    if (fields.firstName !== undefined) liveFields.firstName = fields.firstName;
    if (fields.lastName !== undefined) liveFields.lastName = fields.lastName;
    if (fields.employeeNumber !== undefined) liveFields.employeeNumber = fields.employeeNumber;
    if (fields.status !== undefined) liveFields.status = fields.status;

    liveFields.pendingEffectiveContractYear = Number(effectiveContractYear);
    if (fields.currentStep !== undefined) liveFields.pendingCurrentStep = fields.currentStep;
    if (fields.currentLaneId !== undefined) liveFields.pendingCurrentLaneId = fields.currentLaneId;
    if (fields.currentAnnualSalary !== undefined) liveFields.pendingAnnualSalary = String(fields.currentAnnualSalary);
    // Enforce mutual exclusivity: pending BU and pending group are mutually exclusive.
    // A non-null employeeGroupId means "switch to this group"; a non-null bargainingUnitId means "switch to this BU".
    // null values are used only to signal clearing (e.g. union assignment sends employeeGroupId: null).
    if (fields.employeeGroupId != null) {
      // Switching to a group: set pending group, clear pending BU
      liveFields.pendingEmployeeGroupId = fields.employeeGroupId;
      liveFields.pendingBargainingUnitId = null;
    } else if (fields.bargainingUnitId != null) {
      // Switching to a BU: set pending BU, clear pending group
      liveFields.pendingBargainingUnitId = fields.bargainingUnitId;
      liveFields.pendingEmployeeGroupId = null;
    }

    [empResult] = await db
      .update(employeesTable)
      .set(liveFields)
      .where(eq(employeesTable.id, req.params.id))
      .returning();
  } else {
    // Immediate correction — write all fields to live columns and clear any pending state
    [empResult] = await db
      .update(employeesTable)
      .set({
        ...fields,
        pendingEffectiveContractYear: null,
        pendingBargainingUnitId: null,
        pendingEmployeeGroupId: null,
        pendingCurrentStep: null,
        pendingCurrentLaneId: null,
        pendingAnnualSalary: null,
        updatedAt: new Date(),
      })
      .where(eq(employeesTable.id, req.params.id))
      .returning();
  }

  if (!empResult) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const { count, errors } = await recalcDistrictScenarios(empResult.districtId, "PUT /employees/:id");

  if (errors.length > 0) {
    res.status(500).json({
      error: `Employee saved but recalculation failed for ${errors.length} scenario(s).`,
      scenariosRecalculated: count - errors.length,
      scenariosFailed: errors.length,
    });
    return;
  }

  res.json({ ...empResult, scenariosRecalculated: count });
});

router.delete("/employees/:id/pending", async (req, res) => {
  const [emp] = await db
    .update(employeesTable)
    .set({
      pendingEffectiveContractYear: null,
      pendingBargainingUnitId: null,
      pendingEmployeeGroupId: null,
      pendingCurrentStep: null,
      pendingCurrentLaneId: null,
      pendingAnnualSalary: null,
      updatedAt: new Date(),
    })
    .where(eq(employeesTable.id, req.params.id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const { count, errors } = await recalcDistrictScenarios(emp.districtId, "DELETE /employees/:id/pending");
  if (errors.length > 0) {
    console.error(`[DELETE /employees/:id/pending] Recalculation failed for ${errors.length} of ${count} scenario(s):`, errors);
  }
  res.json(emp);
});

router.delete("/employees/:id", async (req, res) => {
  await db.delete(employeesTable).where(eq(employeesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
