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
} from "@workspace/db";
import { eq, and, sql, or, inArray } from "drizzle-orm";
import {
  calcRetirementOption1,
  calcRetirementOption2,
  calcRetirementOption3,
} from "@workspace/calc-engine";

const createEmployeeSchema = z.object({
  districtId: z.string().uuid(),
  bargainingUnitId: z.string().uuid(),
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

  for (let i = 0; i < employees.length; i++) {
    try {
      const emp = { ...employees[i], districtId, bargainingUnitId: bargainingUnitId || employees[i].bargainingUnitId };
      await db.insert(employeesTable).values(emp);
      imported++;
    } catch (err: unknown) {
      errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  res.json({ imported, skipped: 0, errors });
});

router.get("/employees", async (req, res) => {
  const { districtId, bargainingUnitId, employeeGroupId, status, contractYear, page = 1, pageSize = 50 } = req.query;

  const conditions = [];
  if (districtId) conditions.push(eq(employeesTable.districtId, districtId as string));
  if (bargainingUnitId) conditions.push(eq(employeesTable.bargainingUnitId, bargainingUnitId as string));
  if (employeeGroupId) conditions.push(eq(employeesTable.employeeGroupId, employeeGroupId as string));
  if (status) conditions.push(eq(employeesTable.status, status as "active" | "new_hire" | "terminated" | "retired" | "on_leave"));
  if (contractYear) conditions.push(eq(employeesTable.contractYear, Number(contractYear)));

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
  const [emp] = await db.insert(employeesTable).values(parsed.data).returning();
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

  const age = emp.birthDate ? new Date().getFullYear() - new Date(emp.birthDate).getFullYear() : 55;
  let retirementOptions = null;
  if (emp.retirementEligible) {
    retirementOptions = {
      option1: calcRetirementOption1(emp.currentAnnualSalary, emp.yearsInDistrict, emp.yearsTotalService, age),
      option2: calcRetirementOption2(emp.currentAnnualSalary, emp.yearsInDistrict, emp.yearsTotalService, age),
      option3: calcRetirementOption3(emp.currentAnnualSalary, emp.yearsInDistrict, age),
    };
  }

  res.json({ ...emp, bargainingUnitName: row.unitName, employeeGroupName, compensationScheduleType, laneName: row.laneName, yearProjections, retirementOptions });
});

router.put("/employees/:id", async (req, res) => {
  const body = req.body;
  const [emp] = await db
    .update(employeesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(employeesTable.id, req.params.id))
    .returning();
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(emp);
});

router.delete("/employees/:id", async (req, res) => {
  await db.delete(employeesTable).where(eq(employeesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
