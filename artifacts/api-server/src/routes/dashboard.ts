import { Router } from "express";
import { db } from "@workspace/db";
import {
  districtsTable,
  employeesTable,
  bargainingUnitsTable,
  scenariosTable,
  employeeYearRecordsTable,
  scenarioYearConfigsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import Decimal from "decimal.js";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const { districtId, scenarioId } = req.query;

  let district = null;
  if (districtId) {
    const [d] = await db
      .select()
      .from(districtsTable)
      .where(eq(districtsTable.id, districtId as string));
    district = d ?? null;
  }

  const conditions = districtId
    ? [eq(employeesTable.districtId, districtId as string)]
    : [];

  const employees = await db
    .select({
      employee: employeesTable,
      unitName: bargainingUnitsTable.name,
    })
    .from(employeesTable)
    .leftJoin(
      bargainingUnitsTable,
      eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const totalEmployees = employees.length;
  const totalCurrentPayroll = employees
    .reduce(
      (sum, r) => sum.plus(r.employee.currentAnnualSalary),
      new Decimal("0")
    )
    .toDecimalPlaces(2)
    .toString();

  const retirementEligibleCount = employees.filter(
    (r) => r.employee.retirementEligible
  ).length;

  const HIGH_EARNER_THRESHOLD = 125000;
  const highEarnerCount = employees.filter((r) =>
    new Decimal(r.employee.currentAnnualSalary).gte(HIGH_EARNER_THRESHOLD)
  ).length;

  const employeesAtTopStepCount = employees.filter(
    (r) => r.employee.currentStep !== null && r.employee.currentStep >= 15
  ).length;

  const units = await db
    .select()
    .from(bargainingUnitsTable)
    .where(
      districtId
        ? eq(bargainingUnitsTable.districtId, districtId as string)
        : undefined
    )
    .orderBy(bargainingUnitsTable.displayOrder);

  const employeeCountByUnit = units.map((unit) => {
    const unitEmps = employees.filter(
      (r) => r.employee.bargainingUnitId === unit.id
    );
    const totalPayroll = unitEmps
      .reduce(
        (sum, r) => sum.plus(r.employee.currentAnnualSalary),
        new Decimal("0")
      )
      .toDecimalPlaces(2)
      .toString();
    return {
      bargainingUnitId: unit.id,
      bargainingUnitName: unit.name,
      employeeCount: unitEmps.length,
      totalPayroll,
    };
  });

  const activeScenarios = await db
    .select()
    .from(scenariosTable)
    .where(
      districtId
        ? and(
            eq(scenariosTable.districtId, districtId as string),
            sql`${scenariosTable.status} != 'archived'`
          )
        : sql`${scenariosTable.status} != 'archived'`
    )
    .orderBy(scenariosTable.updatedAt)
    .limit(10);

  const finalScenarios = activeScenarios.filter((s) => s.isFinal);
  const finalScenario = finalScenarios[0] ?? null;

  let fiveYearProjection = null;
  const targetScenarioId = (scenarioId as string) || finalScenario?.id;
  if (targetScenarioId) {
    const yearConfigs = await db
      .select()
      .from(scenarioYearConfigsTable)
      .where(eq(scenarioYearConfigsTable.scenarioId, targetScenarioId))
      .orderBy(scenarioYearConfigsTable.contractYear);

    const yearRecords = await db
      .select()
      .from(employeeYearRecordsTable)
      .where(eq(employeeYearRecordsTable.scenarioId, targetScenarioId));

    if (yearRecords.length > 0) {
      const yearMap = new Map<
        number,
        { contractYear: number; yearLabel: string; totalEmployerCost: Decimal }
      >();
      for (const r of yearRecords) {
        const config = yearConfigs.find((c) => c.contractYear === r.contractYear);
        const label = config?.yearLabel ?? `Year ${r.contractYear}`;
        const existing = yearMap.get(r.contractYear);
        if (existing) {
          existing.totalEmployerCost = existing.totalEmployerCost.plus(r.totalEmployerCost);
        } else {
          yearMap.set(r.contractYear, {
            contractYear: r.contractYear,
            yearLabel: label,
            totalEmployerCost: new Decimal(r.totalEmployerCost),
          });
        }
      }

      fiveYearProjection = Array.from(yearMap.values())
        .sort((a, b) => a.contractYear - b.contractYear)
        .map((y) => ({
          contractYear: y.contractYear,
          yearLabel: y.yearLabel,
          totalEmployerCost: y.totalEmployerCost.toDecimalPlaces(2).toString(),
        }));
    }
  }

  res.json({
    district,
    employeeCountByUnit,
    totalEmployees,
    totalCurrentPayroll,
    retirementEligibleCount,
    highEarnerCount,
    employeesAtTopStepCount,
    activeScenarios: activeScenarios.filter((s) => !s.isFinal),
    finalScenario,
    fiveYearProjection,
  });
});

export default router;
