import { Router } from "express";
import { db } from "@workspace/db";
import {
  employeeYearRecordsTable,
  employeesTable,
  scenariosTable,
  scenarioYearConfigsTable,
  bargainingUnitsTable,
  lanesTable,
  stepsTable,
  salarySchedulesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import Decimal from "decimal.js";

const router = Router();

router.get("/heatmap/:scenarioId", async (req, res) => {
  const { scenarioId } = req.params;
  const { bargainingUnitId: buQuery } = req.query;

  const scenarios = await db.select().from(scenariosTable).where(eq(scenariosTable.id, scenarioId));
  const scenario = scenarios[0];
  if (!scenario) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  const yearConfigs = await db
    .select()
    .from(scenarioYearConfigsTable)
    .where(eq(scenarioYearConfigsTable.scenarioId, scenarioId))
    .orderBy(scenarioYearConfigsTable.contractYear);

  let targetBargainingUnitId: string;
  if (buQuery) {
    targetBargainingUnitId = buQuery as string;
  } else {
    const salaryUnits = await db
      .select()
      .from(bargainingUnitsTable)
      .where(and(eq(bargainingUnitsTable.districtId, scenario.districtId), eq(bargainingUnitsTable.compensationType, "salary")))
      .limit(1);
    if (!salaryUnits[0]) {
      res.json({ scenarioId, bargainingUnitId: null, years: [] });
      return;
    }
    targetBargainingUnitId = salaryUnits[0].id;
  }

  const units = await db.select().from(bargainingUnitsTable).where(eq(bargainingUnitsTable.id, targetBargainingUnitId));
  const unit = units[0];

  const schedules = await db
    .select()
    .from(salarySchedulesTable)
    .where(eq(salarySchedulesTable.bargainingUnitId, targetBargainingUnitId))
    .limit(1);
  const schedule = schedules[0];

  if (!schedule) {
    res.json({ scenarioId, bargainingUnitId: targetBargainingUnitId, bargainingUnitName: unit?.name ?? null, years: [] });
    return;
  }

  const [lanes, steps] = await Promise.all([
    db.select().from(lanesTable).where(eq(lanesTable.salaryScheduleId, schedule.id)).orderBy(lanesTable.displayOrder),
    db.select().from(stepsTable).where(eq(stepsTable.salaryScheduleId, schedule.id)).orderBy(stepsTable.stepNumber),
  ]);

  const employees = await db
    .select()
    .from(employeesTable)
    .where(and(eq(employeesTable.districtId, scenario.districtId), eq(employeesTable.bargainingUnitId, targetBargainingUnitId)));

  const yearRecords = await db
    .select()
    .from(employeeYearRecordsTable)
    .where(eq(employeeYearRecordsTable.scenarioId, scenarioId));

  const unitYearConfigs = yearConfigs.filter((c) => c.bargainingUnitId === targetBargainingUnitId);
  const contractYears = [...new Set(unitYearConfigs.map((c) => c.contractYear))].sort((a, b) => a - b);
  const maxStep = steps.length > 0 ? Math.max(...steps.map((s) => s.stepNumber)) : 0;

  const yearsData = contractYears.map((contractYear) => {
    const config = unitYearConfigs.find((c) => c.contractYear === contractYear);
    const yearData = yearRecords.filter((r) => r.contractYear === contractYear);

    const cellMap = new Map<string, { laneId: string; laneName: string; stepNumber: number; employeeCount: number; totalSalary: Decimal; employees: Array<{ id: string; name: string; salary: string }> }>();

    let salaryTotal = new Decimal("0");
    const stepCounts: number[] = [];

    for (const record of yearData) {
      const emp = employees.find((e) => e.id === record.employeeId);
      if (!emp || !record.projectedLaneId || record.projectedStep === null) continue;

      const lane = lanes.find((l) => l.id === record.projectedLaneId);
      if (!lane) continue;

      const key = `${record.projectedLaneId}:${record.projectedStep}`;
      let cell = cellMap.get(key);
      if (!cell) {
        cell = { laneId: record.projectedLaneId, laneName: lane.name, stepNumber: record.projectedStep, employeeCount: 0, totalSalary: new Decimal("0"), employees: [] };
        cellMap.set(key, cell);
      }
      cell.employeeCount++;
      cell.totalSalary = cell.totalSalary.plus(record.projectedBaseSalary);
      cell.employees.push({ id: emp.id, name: `${emp.firstName} ${emp.lastName}`, salary: record.projectedBaseSalary });
      salaryTotal = salaryTotal.plus(record.projectedBaseSalary);
      stepCounts.push(record.projectedStep);
    }

    const totalEmployees = yearData.filter((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      return emp && r.projectedLaneId;
    }).length;

    const employeesAtTopStep = yearData.filter(
      (r) => r.projectedStep === maxStep && employees.find((e) => e.id === r.employeeId)
    ).length;

    return {
      contractYear,
      yearLabel: config?.yearLabel ?? `Year ${contractYear}`,
      cells: Array.from(cellMap.values()).map((c) => ({ ...c, totalSalary: c.totalSalary.toDecimalPlaces(2).toString() })),
      lanes: lanes.map((l) => ({ id: l.id, salaryScheduleId: l.salaryScheduleId, name: l.name, displayOrder: l.displayOrder, indexMultiplier: l.indexMultiplier })),
      maxStep,
      totalEmployees,
      medianSalary: totalEmployees > 0 ? salaryTotal.dividedBy(totalEmployees).toDecimalPlaces(2).toString() : null,
      avgStep: stepCounts.length > 0 ? Math.round((stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length) * 10) / 10 : null,
      employeesAtTopStep,
    };
  });

  res.json({ scenarioId, bargainingUnitId: targetBargainingUnitId, bargainingUnitName: unit?.name ?? null, years: yearsData });
});

export default router;
