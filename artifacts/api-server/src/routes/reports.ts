import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  scenariosTable,
  scenarioYearConfigsTable,
  employeeYearRecordsTable,
  employeesTable,
  bargainingUnitsTable,
  districtsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import Decimal from "decimal.js";

const router = Router();

const generateReportSchema = z.object({
  scenarioId: z.string().uuid(),
  format: z.enum(["json", "csv"]).default("json"),
  includeEmployeeDetail: z.boolean().default(false),
});

router.get("/reports", async (req, res) => {
  const { districtId } = req.query;

  const conditions = [];
  if (districtId) conditions.push(eq(scenariosTable.districtId, districtId as string));

  const scenarios = await db
    .select({
      id: scenariosTable.id,
      name: scenariosTable.name,
      status: scenariosTable.status,
      isFinal: scenariosTable.isFinal,
      districtId: scenariosTable.districtId,
      updatedAt: scenariosTable.updatedAt,
    })
    .from(scenariosTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(scenariosTable.updatedAt);

  const reportList = scenarios.map((s) => ({
    scenarioId: s.id,
    scenarioName: s.name,
    status: s.status,
    isFinal: s.isFinal,
    availableFormats: ["json", "csv"],
    lastCalculated: s.updatedAt,
  }));

  res.json(reportList);
});

router.post("/reports/generate", async (req, res) => {
  const parsed = generateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }

  const { scenarioId, format, includeEmployeeDetail } = parsed.data;

  const scenarios = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.id, scenarioId));

  const scenario = scenarios[0];
  if (!scenario) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  const district = await db
    .select()
    .from(districtsTable)
    .where(eq(districtsTable.id, scenario.districtId));

  const yearRecords = await db
    .select({
      record: employeeYearRecordsTable,
      employee: employeesTable,
      unit: bargainingUnitsTable,
    })
    .from(employeeYearRecordsTable)
    .leftJoin(employeesTable, eq(employeeYearRecordsTable.employeeId, employeesTable.id))
    .leftJoin(bargainingUnitsTable, eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id))
    .where(eq(employeeYearRecordsTable.scenarioId, scenarioId))
    .orderBy(employeeYearRecordsTable.contractYear);

  const yearMap = new Map<number, {
    totalPayroll: Decimal;
    totalBenefits: Decimal;
    totalEmployerCost: Decimal;
    employeeCount: Set<string>;
  }>();

  for (const row of yearRecords) {
    const yr = row.record.contractYear;
    if (!yearMap.has(yr)) {
      yearMap.set(yr, {
        totalPayroll: new Decimal("0"),
        totalBenefits: new Decimal("0"),
        totalEmployerCost: new Decimal("0"),
        employeeCount: new Set(),
      });
    }
    const yData = yearMap.get(yr)!;
    yData.totalPayroll = yData.totalPayroll.plus(new Decimal(row.record.projectedBaseSalaryCents).dividedBy(100));
    const benefits = new Decimal(row.record.retirementContributionCents).dividedBy(100)
      .plus(new Decimal(row.record.ficaCostCents).dividedBy(100))
      .plus(new Decimal(row.record.healthInsuranceCostCents).dividedBy(100))
      .plus(new Decimal(row.record.otherBenefitsCostCents).dividedBy(100));
    yData.totalBenefits = yData.totalBenefits.plus(benefits);
    yData.totalEmployerCost = yData.totalEmployerCost.plus(new Decimal(row.record.totalEmployerCostCents).dividedBy(100));
    yData.employeeCount.add(row.record.employeeId);
  }

  const yearSummaries = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({
      contractYear: year,
      totalPayroll: data.totalPayroll.toDecimalPlaces(2).toString(),
      totalBenefits: data.totalBenefits.toDecimalPlaces(2).toString(),
      totalEmployerCost: data.totalEmployerCost.toDecimalPlaces(2).toString(),
      employeeCount: data.employeeCount.size,
    }));

  const totalFiveYearCost = yearSummaries
    .reduce((sum, y) => sum.plus(y.totalEmployerCost), new Decimal("0"))
    .toDecimalPlaces(2)
    .toString();

  const report = {
    reportGeneratedAt: new Date().toISOString(),
    district: district[0] ?? null,
    scenarioId,
    scenarioName: scenario.name,
    scenarioStatus: scenario.status,
    isFinal: scenario.isFinal,
    totalFiveYearCost,
    yearSummaries,
    employeeDetail: includeEmployeeDetail
      ? yearRecords.map((row) => ({
          employeeId: row.record.employeeId,
          employeeName: row.employee
            ? `${row.employee.firstName} ${row.employee.lastName}`
            : "Unknown",
          bargainingUnit: row.unit?.name ?? "Unknown",
          contractYear: row.record.contractYear,
          projectedBaseSalary: (row.record.projectedBaseSalaryCents / 100).toFixed(2),
          totalEmployerCost: (row.record.totalEmployerCostCents / 100).toFixed(2),
        }))
      : undefined,
  };

  if (format === "csv") {
    const csvHeaders = [
      "Contract Year",
      "Total Payroll",
      "Total Benefits",
      "Total Employer Cost",
      "Employee Count",
    ];
    const csvRows = yearSummaries.map((y) =>
      [y.contractYear, y.totalPayroll, y.totalBenefits, y.totalEmployerCost, y.employeeCount]
        .map((v) => `"${v}"`)
        .join(",")
    );
    const csv = [csvHeaders.join(","), ...csvRows].join("\n");
    const filename = `report-${scenario.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
    return;
  }

  res.json(report);
});

router.get("/reports/:scenarioId", async (req, res) => {
  const { scenarioId } = req.params;

  const scenarios = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.id, scenarioId));

  const scenario = scenarios[0];
  if (!scenario) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  const yearRecords = await db
    .select()
    .from(employeeYearRecordsTable)
    .where(eq(employeeYearRecordsTable.scenarioId, scenarioId));

  if (yearRecords.length === 0) {
    res.status(404).json({
      error: "No calculated data found for this scenario. Run /scenarios/:id/calculate first.",
    });
    return;
  }

  const yearMap = new Map<number, { totalPayroll: Decimal; totalEmployerCost: Decimal; employeeCount: Set<string> }>();
  for (const r of yearRecords) {
    const yr = r.contractYear;
    if (!yearMap.has(yr)) yearMap.set(yr, { totalPayroll: new Decimal("0"), totalEmployerCost: new Decimal("0"), employeeCount: new Set() });
    const d = yearMap.get(yr)!;
    d.totalPayroll = d.totalPayroll.plus(new Decimal(r.projectedBaseSalaryCents).dividedBy(100));
    d.totalEmployerCost = d.totalEmployerCost.plus(new Decimal(r.totalEmployerCostCents).dividedBy(100));
    d.employeeCount.add(r.employeeId);
  }

  const yearSummaries = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({
      contractYear: year,
      totalPayroll: data.totalPayroll.toDecimalPlaces(2).toString(),
      totalEmployerCost: data.totalEmployerCost.toDecimalPlaces(2).toString(),
      employeeCount: data.employeeCount.size,
    }));

  const totalFiveYearCost = yearSummaries
    .reduce((sum, y) => sum.plus(y.totalEmployerCost), new Decimal("0"))
    .toDecimalPlaces(2)
    .toString();

  res.json({
    scenarioId,
    scenarioName: scenario.name,
    scenarioStatus: scenario.status,
    isFinal: scenario.isFinal,
    totalFiveYearCost,
    yearSummaries,
  });
});

router.get("/reports/:scenarioId/detail", async (req, res) => {
  const { scenarioId } = req.params;

  const scenarios = await db.select().from(scenariosTable).where(eq(scenariosTable.id, scenarioId));
  const scenario = scenarios[0];
  if (!scenario) { res.status(404).json({ error: "Scenario not found" }); return; }

  const district = await db.select().from(districtsTable).where(eq(districtsTable.id, scenario.districtId));
  const yearConfigs = await db.select().from(scenarioYearConfigsTable).where(eq(scenarioYearConfigsTable.scenarioId, scenarioId)).orderBy(scenarioYearConfigsTable.contractYear);
  const units = await db.select().from(bargainingUnitsTable).where(eq(bargainingUnitsTable.districtId, scenario.districtId));

  const yearRecords = await db
    .select({
      record: employeeYearRecordsTable,
      employee: employeesTable,
      unit: bargainingUnitsTable,
    })
    .from(employeeYearRecordsTable)
    .leftJoin(employeesTable, eq(employeeYearRecordsTable.employeeId, employeesTable.id))
    .leftJoin(bargainingUnitsTable, eq(employeesTable.bargainingUnitId, bargainingUnitsTable.id))
    .where(eq(employeeYearRecordsTable.scenarioId, scenarioId))
    .orderBy(employeeYearRecordsTable.contractYear);

  const yearSet = [...new Set(yearRecords.map(r => r.record.contractYear))].sort();

  const perUnitPerYear: Record<string, Record<number, {
    totalPayroll: Decimal; totalRetirement: Decimal; totalFICA: Decimal;
    totalHealth: Decimal; totalOther: Decimal; totalEmployerCost: Decimal;
    employeeCount: number;
  }>> = {};

  for (const unit of units) {
    perUnitPerYear[unit.id] = {};
    for (const yr of yearSet) {
      perUnitPerYear[unit.id][yr] = {
        totalPayroll: new Decimal(0), totalRetirement: new Decimal(0),
        totalFICA: new Decimal(0), totalHealth: new Decimal(0),
        totalOther: new Decimal(0), totalEmployerCost: new Decimal(0),
        employeeCount: 0,
      };
    }
  }

  for (const row of yearRecords) {
    const unitId = row.employee?.bargainingUnitId;
    if (!unitId || !perUnitPerYear[unitId]) continue;
    const yr = row.record.contractYear;
    if (!perUnitPerYear[unitId][yr]) continue;
    const d = perUnitPerYear[unitId][yr];
    d.totalPayroll = d.totalPayroll.plus(new Decimal(row.record.projectedBaseSalaryCents).dividedBy(100));
    d.totalRetirement = d.totalRetirement.plus(new Decimal(row.record.retirementContributionCents).dividedBy(100));
    d.totalFICA = d.totalFICA.plus(new Decimal(row.record.ficaCostCents).dividedBy(100));
    d.totalHealth = d.totalHealth.plus(new Decimal(row.record.healthInsuranceCostCents).dividedBy(100));
    d.totalOther = d.totalOther.plus(new Decimal(row.record.otherBenefitsCostCents).dividedBy(100));
    d.totalEmployerCost = d.totalEmployerCost.plus(new Decimal(row.record.totalEmployerCostCents).dividedBy(100));
    d.employeeCount++;
  }

  const unitSummaries = units.map(unit => ({
    unitId: unit.id,
    unitName: unit.name,
    retirementSystem: unit.retirementSystem,
    years: yearSet.map(yr => {
      const d = perUnitPerYear[unit.id][yr] ?? {
        totalPayroll: new Decimal(0), totalRetirement: new Decimal(0),
        totalFICA: new Decimal(0), totalHealth: new Decimal(0),
        totalOther: new Decimal(0), totalEmployerCost: new Decimal(0),
        employeeCount: 0,
      };
      const yearLabel = yearConfigs.find(yc => yc.contractYear === yr && yc.bargainingUnitId === unit.id)?.yearLabel ?? `Year ${yr}`;
      return {
        contractYear: yr,
        yearLabel,
        totalPayroll: d.totalPayroll.toDecimalPlaces(2).toString(),
        totalRetirement: d.totalRetirement.toDecimalPlaces(2).toString(),
        totalFICA: d.totalFICA.toDecimalPlaces(2).toString(),
        totalHealth: d.totalHealth.toDecimalPlaces(2).toString(),
        totalOther: d.totalOther.toDecimalPlaces(2).toString(),
        totalEmployerCost: d.totalEmployerCost.toDecimalPlaces(2).toString(),
        employeeCount: d.employeeCount,
      };
    }),
  }));

  const employeeDetail = yearRecords.map(row => ({
    employeeId: row.record.employeeId,
    employeeName: row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : "Unknown",
    employeeNumber: row.employee?.employeeNumber ?? "",
    bargainingUnit: row.unit?.name ?? "Unknown",
    bargainingUnitId: row.unit?.id ?? "",
    contractYear: row.record.contractYear,
    projectedStep: row.record.projectedStep,
    projectedSalary: (row.record.projectedBaseSalaryCents / 100).toFixed(2),
    retirementContribution: (row.record.retirementContributionCents / 100).toFixed(2),
    ficaCost: (row.record.ficaCostCents / 100).toFixed(2),
    healthInsuranceCost: (row.record.healthInsuranceCostCents / 100).toFixed(2),
    otherBenefitsCost: (row.record.otherBenefitsCostCents / 100).toFixed(2),
    totalEmployerCost: (row.record.totalEmployerCostCents / 100).toFixed(2),
  }));

  const yearConfigsFormatted = yearConfigs.map(yc => {
    const unit = units.find(u => u.id === yc.bargainingUnitId);
    return {
      yearLabel: yc.yearLabel,
      contractYear: yc.contractYear,
      bargainingUnit: unit?.name ?? yc.bargainingUnitId,
      increaseType: yc.increaseType,
      fixedPercentage: yc.fixedPercentage,
      cpiValue: yc.cpiValue,
      cpiAdder: yc.cpiAdder,
      cpiCap: yc.cpiCap,
      cpiFloor: yc.cpiFloor,
      highEarnerThreshold: yc.highEarnerThreshold,
      highEarnerFlatIncrease: yc.highEarnerFlatIncrease,
      stepAdvancement: yc.stepAdvancement,
      healthPremiumIncreaseRate: yc.healthPremiumIncreaseRate,
    };
  });

  res.json({
    scenarioId,
    scenarioName: scenario.name,
    scenarioDescription: scenario.description,
    scenarioStatus: scenario.status,
    isFinal: scenario.isFinal,
    districtName: district[0]?.name ?? null,
    districtState: district[0]?.state ?? null,
    reportGeneratedAt: new Date().toISOString(),
    yearSet,
    unitSummaries,
    employeeDetail,
    yearConfigs: yearConfigsFormatted,
  });
});

export default router;
