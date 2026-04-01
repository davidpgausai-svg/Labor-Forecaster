import { Router } from "express";
import { z } from "zod";
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
  const scenarioIdSchema = z.string().uuid();
  const parsedId = scenarioIdSchema.safeParse(req.params.scenarioId);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid scenarioId" });
    return;
  }
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

  const stepNumbers = steps.map((s) => s.stepNumber);

  const yearsData = contractYears.map((contractYear) => {
    const config = unitYearConfigs.find((c) => c.contractYear === contractYear);
    const yearData = yearRecords.filter((r) => r.contractYear === contractYear);

    // Build flat cells map
    const cellMap = new Map<string, {
      laneId: string;
      laneName: string;
      stepNumber: number;
      employeeCount: number;
      totalSalary: Decimal;
      employees: Array<{ id: string; name: string; salary: string }>;
    }>();

    let salaryTotal = new Decimal("0");
    const stepCounts: number[] = [];
    const laneCountMap = new Map<string, number>();
    const allSalaryValues: number[] = [];

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
      const salaryDollars = (record.projectedBaseSalaryCents / 100).toFixed(2);
      const salaryNum = parseFloat(salaryDollars);
      cell.totalSalary = cell.totalSalary.plus(salaryDollars);
      cell.employees.push({ id: emp.id, name: `${emp.firstName} ${emp.lastName}`, salary: salaryDollars });
      salaryTotal = salaryTotal.plus(salaryDollars);
      stepCounts.push(record.projectedStep);
      allSalaryValues.push(salaryNum);
      laneCountMap.set(lane.name, (laneCountMap.get(lane.name) ?? 0) + 1);
    }

    const flatCells = Array.from(cellMap.values()).map((c) => ({
      laneId: c.laneId,
      laneName: c.laneName,
      stepNumber: c.stepNumber,
      employeeCount: c.employeeCount,
      totalSalary: c.totalSalary.toDecimalPlaces(2).toString(),
      employees: c.employees,
    }));

    // Build 2D matrix: rows = steps (ascending), columns = lanes (by displayOrder)
    const matrix: Array<Array<{ count: number; totalSalary: string } | null>> = stepNumbers.map((stepNum) =>
      lanes.map((lane) => {
        const cell = flatCells.find((c) => c.stepNumber === stepNum && c.laneId === lane.id);
        if (!cell || cell.employeeCount === 0) return null;
        return { count: cell.employeeCount, totalSalary: cell.totalSalary };
      })
    );

    const totalEmployees = yearData.filter((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      return emp && r.projectedLaneId;
    }).length;

    const employeesAtTopStep = yearData.filter(
      (r) => r.projectedStep === maxStep && employees.find((e) => e.id === r.employeeId)
    ).length;

    // True median salary
    allSalaryValues.sort((a, b) => a - b);
    let medianSalary: string | null = null;
    if (allSalaryValues.length > 0) {
      const mid = Math.floor(allSalaryValues.length / 2);
      const medianVal = allSalaryValues.length % 2 === 0
        ? (allSalaryValues[mid - 1] + allSalaryValues[mid]) / 2
        : allSalaryValues[mid];
      medianSalary = medianVal.toFixed(2);
    }

    // Average lane (most common lane by employee count)
    let avgLane: string | null = null;
    if (laneCountMap.size > 0) {
      let maxCount = 0;
      laneCountMap.forEach((count, laneName) => {
        if (count > maxCount) { maxCount = count; avgLane = laneName; }
      });
    }

    // Top-3 and bottom-3 step concentration
    const sortedSteps = [...new Set(stepCounts)].sort((a, b) => a - b);
    const top3Steps = new Set(sortedSteps.slice(-3));
    const bottom3Steps = new Set(sortedSteps.slice(0, 3));
    const top3Count = stepCounts.filter(s => top3Steps.has(s)).length;
    const bottom3Count = stepCounts.filter(s => bottom3Steps.has(s)).length;
    const top3StepsPct = stepCounts.length > 0 ? Math.round((top3Count / stepCounts.length) * 1000) / 10 : null;
    const bottom3StepsPct = stepCounts.length > 0 ? Math.round((bottom3Count / stepCounts.length) * 1000) / 10 : null;

    return {
      contractYear,
      yearLabel: config?.yearLabel ?? `Year ${contractYear}`,
      lanes: lanes.map((l) => ({ id: l.id, name: l.name })),
      stepHeaders: stepNumbers,
      matrix,
      cells: flatCells,
      maxStep,
      totalEmployees,
      medianSalary,
      avgStep: stepCounts.length > 0 ? Math.round((stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length) * 10) / 10 : null,
      employeesAtTopStep,
      avgLane,
      top3StepsPct,
      bottom3StepsPct,
    };
  });

  res.json({ scenarioId, bargainingUnitId: targetBargainingUnitId, bargainingUnitName: unit?.name ?? null, years: yearsData });
});

export default router;
