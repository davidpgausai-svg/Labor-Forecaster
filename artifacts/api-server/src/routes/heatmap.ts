import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  employeeYearRecordsTable,
  employeesTable,
  scenariosTable,
  scenarioYearConfigsTable,
  bargainingUnitsTable,
  employeeGroupsTable,
  compensationSchedulesTable,
  lanesTable,
  stepsTable,
  salarySchedulesTable,
  indexGridConfigsTable,
  importGridCellsTable,
} from "@workspace/db";
import { eq, and, isNull, max } from "drizzle-orm";
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
  const { bargainingUnitId: buQuery, employeeGroupId: groupQuery, compensationScheduleId: schedQuery } = req.query;

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

  // Employee-group mode
  if (groupQuery) {
    const targetGroupId = groupQuery as string;
    const targetScheduleId = schedQuery as string | undefined;

    const groupData = await db.select().from(employeeGroupsTable).where(eq(employeeGroupsTable.id, targetGroupId)).then((r) => r[0]);

    const groupEmployees = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.districtId, scenario.districtId), eq(employeesTable.employeeGroupId, targetGroupId)));

    if (groupEmployees.length === 0) {
      res.json({ scenarioId, employeeGroupId: targetGroupId, groupName: groupData?.name ?? null, scheduleType: null, isSummaryOnly: false, years: [] });
      return;
    }

    // Resolve which compensation schedule to use
    const targetSchedule = targetScheduleId
      ? await db.select().from(compensationSchedulesTable).where(eq(compensationSchedulesTable.id, targetScheduleId)).limit(1).then((r) => r[0])
      : await db.select().from(compensationSchedulesTable).where(and(eq(compensationSchedulesTable.employeeGroupId, targetGroupId), eq(compensationSchedulesTable.isPrimary, true))).limit(1).then((r) => r[0]);

    if (!targetSchedule) {
      res.json({ scenarioId, employeeGroupId: targetGroupId, groupName: groupData?.name ?? null, scheduleType: null, isSummaryOnly: false, years: [] });
      return;
    }

    const compScheduleId = targetSchedule.id;
    const scheduleType = targetSchedule.scheduleType;
    const isGrid = scheduleType === "index_based_grid" || scheduleType === "direct_import_grid";

    const yearRecords = await db.select().from(employeeYearRecordsTable).where(eq(employeeYearRecordsTable.scenarioId, scenarioId));
    const groupYearConfigs = yearConfigs.filter((c) => c.employeeGroupId === targetGroupId);
    const contractYearsList = [...new Set(groupYearConfigs.map((c) => c.contractYear))].sort((a, b) => a - b);
    const employeeIds = new Set(groupEmployees.map((e) => e.id));

    // ── Summary-only mode for non-grid schedules ──────────────────────────────
    if (!isGrid) {
      const yearsData = contractYearsList.map((contractYear) => {
        const config = groupYearConfigs.find((c) => c.contractYear === contractYear);
        const yearData = yearRecords.filter((r) => r.contractYear === contractYear && employeeIds.has(r.employeeId));
        const salaries = yearData.map((r) => r.projectedBaseSalaryCents / 100).filter((s) => s > 0);
        salaries.sort((a, b) => a - b);
        const totalPayroll = salaries.reduce((sum, s) => sum + s, 0);
        const avgSalary = salaries.length > 0 ? totalPayroll / salaries.length : 0;
        const minSalary = salaries[0] ?? 0;
        const maxSalary = salaries[salaries.length - 1] ?? 0;
        const mid = Math.floor(salaries.length / 2);
        const medianSalary = salaries.length === 0 ? null
          : (salaries.length % 2 === 0 ? (salaries[mid - 1] + salaries[mid]) / 2 : salaries[mid]).toFixed(2);
        return {
          contractYear,
          yearLabel: config?.yearLabel ?? `Year ${contractYear}`,
          cells: [], lanes: [], maxStep: 0, totalEmployees: yearData.length, employeesAtTopStep: 0,
          medianSalary, avgStep: null, avgLane: null, top3StepsPct: null, bottom3StepsPct: null,
          totalPayroll: totalPayroll.toFixed(2),
          avgSalary: avgSalary.toFixed(2),
          minSalary: minSalary.toFixed(2),
          maxSalary: maxSalary.toFixed(2),
        };
      });
      res.json({ scenarioId, employeeGroupId: targetGroupId, groupName: groupData?.name ?? null, scheduleType, isSummaryOnly: true, years: yearsData });
      return;
    }

    // ── Grid mode ─────────────────────────────────────────────────────────────
    const lanes = await db
      .select()
      .from(lanesTable)
      .where(eq(lanesTable.compensationScheduleId, compScheduleId))
      .orderBy(lanesTable.displayOrder);

    if (lanes.length === 0) {
      res.json({ scenarioId, employeeGroupId: targetGroupId, groupName: groupData?.name ?? null, scheduleType, isSummaryOnly: false, years: [] });
      return;
    }

    let stepNumbers: number[] = [];
    if (scheduleType === "index_based_grid") {
      const config = await db.select().from(indexGridConfigsTable).where(eq(indexGridConfigsTable.compensationScheduleId, compScheduleId)).limit(1).then((r) => r[0]);
      const maxSteps = config?.maxSteps ?? 20;
      stepNumbers = Array.from({ length: maxSteps }, (_, i) => i + 1);
    } else {
      const result = await db.select({ maxStep: max(importGridCellsTable.stepNumber) }).from(importGridCellsTable).where(eq(importGridCellsTable.compensationScheduleId, compScheduleId));
      const maxStepVal = result[0]?.maxStep ?? 0;
      stepNumbers = Array.from({ length: maxStepVal }, (_, i) => i + 1);
    }

    if (stepNumbers.length === 0) {
      res.json({ scenarioId, employeeGroupId: targetGroupId, groupName: groupData?.name ?? null, scheduleType, isSummaryOnly: false, years: [] });
      return;
    }

    const maxStep = stepNumbers[stepNumbers.length - 1];
    const laneIdSet = new Set(lanes.map((l) => l.id));

    const yearsData = contractYearsList.map((contractYear) => {
      const config = groupYearConfigs.find((c) => c.contractYear === contractYear);
      // Only include records whose lane belongs to this schedule's lanes
      const yearData = yearRecords.filter((r) => r.contractYear === contractYear && employeeIds.has(r.employeeId) && r.projectedLaneId && laneIdSet.has(r.projectedLaneId));
      const cellMap = new Map<string, { laneId: string; laneName: string; stepNumber: number; employeeCount: number; totalSalary: Decimal; employees: Array<{ id: string; name: string; salary: string }> }>();
      const stepCounts: number[] = [];
      const laneCountMap = new Map<string, number>();
      const allSalaryValues: number[] = [];

      for (const record of yearData) {
        const emp = groupEmployees.find((e) => e.id === record.employeeId);
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
        cell.totalSalary = cell.totalSalary.plus(salaryDollars);
        cell.employees.push({ id: emp.id, name: `${emp.firstName} ${emp.lastName}`, salary: salaryDollars });
        stepCounts.push(record.projectedStep);
        allSalaryValues.push(parseFloat(salaryDollars));
        laneCountMap.set(lane.name, (laneCountMap.get(lane.name) ?? 0) + 1);
      }

      const flatCells = Array.from(cellMap.values()).map((c) => ({ laneId: c.laneId, laneName: c.laneName, stepNumber: c.stepNumber, employeeCount: c.employeeCount, totalSalary: c.totalSalary.toDecimalPlaces(2).toString(), employees: c.employees }));
      const totalEmployees = yearData.filter((r) => r.projectedLaneId).length;
      const employeesAtTopStep = yearData.filter((r) => r.projectedStep === maxStep).length;
      allSalaryValues.sort((a, b) => a - b);
      let medianSalary: string | null = null;
      if (allSalaryValues.length > 0) {
        const mid = Math.floor(allSalaryValues.length / 2);
        medianSalary = (allSalaryValues.length % 2 === 0 ? (allSalaryValues[mid - 1] + allSalaryValues[mid]) / 2 : allSalaryValues[mid]).toFixed(2);
      }
      let avgLane: string | null = null;
      if (laneCountMap.size > 0) {
        let maxCount = 0;
        laneCountMap.forEach((count, laneName) => { if (count > maxCount) { maxCount = count; avgLane = laneName; } });
      }
      const sortedSteps = [...new Set(stepCounts)].sort((a, b) => a - b);
      const top3Steps = new Set(sortedSteps.slice(-3));
      const bottom3Steps = new Set(sortedSteps.slice(0, 3));
      const top3Count = stepCounts.filter(s => top3Steps.has(s)).length;
      const bottom3Count = stepCounts.filter(s => bottom3Steps.has(s)).length;

      return {
        contractYear, yearLabel: config?.yearLabel ?? `Year ${contractYear}`,
        lanes: lanes.map((l) => ({ id: l.id, name: l.name })), stepHeaders: stepNumbers, matrix: [],
        cells: flatCells, maxStep, totalEmployees, medianSalary,
        avgStep: stepCounts.length > 0 ? Math.round((stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length) * 10) / 10 : null,
        employeesAtTopStep, avgLane,
        top3StepsPct: stepCounts.length > 0 ? Math.round((top3Count / stepCounts.length) * 1000) / 10 : null,
        bottom3StepsPct: stepCounts.length > 0 ? Math.round((bottom3Count / stepCounts.length) * 1000) / 10 : null,
        totalPayroll: null, avgSalary: null, minSalary: null, maxSalary: null,
      };
    });

    res.json({ scenarioId, employeeGroupId: targetGroupId, groupName: groupData?.name ?? null, scheduleType, isSummaryOnly: false, years: yearsData });
    return;
  }

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

  // Only include employees calculated on the BU path — exclude anyone with
  // an employeeGroupId because the calc engine routes those through the group
  // config, not the bargaining-unit schedule.
  const employees = await db
    .select()
    .from(employeesTable)
    .where(and(
      eq(employeesTable.districtId, scenario.districtId),
      eq(employeesTable.bargainingUnitId, targetBargainingUnitId),
      isNull(employeesTable.employeeGroupId),
    ));

  // All employees in this BU are assigned to an employee group — return empty
  // so the UI shows the "no employees" state instead of a ghost grid.
  if (employees.length === 0) {
    res.json({ scenarioId, bargainingUnitId: targetBargainingUnitId, bargainingUnitName: unit?.name ?? null, years: [], allInGroups: true });
    return;
  }

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
