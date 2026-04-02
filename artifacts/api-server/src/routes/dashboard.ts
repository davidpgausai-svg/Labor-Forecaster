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

  let fiveYearProjection: Array<{
    contractYear: number;
    yearLabel: string;
    totalEmployerCost: string;
    byUnit: Array<{ bargainingUnitId: string; bargainingUnitName: string; cost: string }>;
  }> | null = null;

  // Year 1 projected totals — only populated when a scenarioId is explicitly selected.
  // These drive the KPI card overrides and Units projected costs.
  // The fiveYearProjection chart may still fall back to the final scenario,
  // but KPI/unit overrides are strictly explicit-only to avoid showing unexpected projections.
  let scenarioYear1TotalCost: string | null = null;
  let scenarioYear1ByUnit: Array<{
    bargainingUnitId: string;
    bargainingUnitName: string;
    employeeCount: number;
    totalPayroll: string;
  }> | null = null;
  let selectedScenarioName: string | null = null;

  // For the 5-year chart, fall back to final scenario when no explicit selection.
  // For KPI/unit overrides, require explicit scenarioId.
  const explicitScenarioId = scenarioId as string | undefined;
  const targetScenarioId = explicitScenarioId || finalScenario?.id;

  if (targetScenarioId) {
    // Resolve scenario name only when explicitly selected
    if (explicitScenarioId) {
      const matchedScenario = activeScenarios.find((s) => s.id === targetScenarioId);
      selectedScenarioName = matchedScenario?.name ?? null;

      if (!selectedScenarioName) {
        const [scRow] = await db
          .select({ name: scenariosTable.name })
          .from(scenariosTable)
          .where(eq(scenariosTable.id, targetScenarioId));
        selectedScenarioName = scRow?.name ?? null;
      }
    }

    const yearConfigs = await db
      .select()
      .from(scenarioYearConfigsTable)
      .where(eq(scenarioYearConfigsTable.scenarioId, targetScenarioId))
      .orderBy(scenarioYearConfigsTable.contractYear);

    const yearRecordsWithUnit = await db
      .select({
        record: employeeYearRecordsTable,
        bargainingUnitId: employeesTable.bargainingUnitId,
      })
      .from(employeeYearRecordsTable)
      .leftJoin(employeesTable, eq(employeeYearRecordsTable.employeeId, employeesTable.id))
      .where(eq(employeeYearRecordsTable.scenarioId, targetScenarioId));

    if (yearRecordsWithUnit.length > 0) {
      type YearEntry = {
        contractYear: number;
        yearLabel: string;
        totalEmployerCost: Decimal;
        unitCosts: Map<string, Decimal>;
      };
      const yearMap = new Map<number, YearEntry>();

      for (const row of yearRecordsWithUnit) {
        const r = row.record;
        const buId = row.bargainingUnitId ?? "unknown";
        const config = yearConfigs.find((c) => c.contractYear === r.contractYear);
        const label = config?.yearLabel ?? `Year ${r.contractYear}`;
        const cost = new Decimal(r.totalEmployerCostCents).dividedBy(100);

        const existing = yearMap.get(r.contractYear);
        if (existing) {
          existing.totalEmployerCost = existing.totalEmployerCost.plus(cost);
          const buCost = existing.unitCosts.get(buId) ?? new Decimal(0);
          existing.unitCosts.set(buId, buCost.plus(cost));
        } else {
          const unitCosts = new Map<string, Decimal>();
          unitCosts.set(buId, cost);
          yearMap.set(r.contractYear, {
            contractYear: r.contractYear,
            yearLabel: label,
            totalEmployerCost: cost,
            unitCosts,
          });
        }
      }

      const sortedYears = Array.from(yearMap.values()).sort(
        (a, b) => a.contractYear - b.contractYear
      );

      fiveYearProjection = sortedYears.map((y) => ({
        contractYear: y.contractYear,
        yearLabel: y.yearLabel,
        totalEmployerCost: y.totalEmployerCost.toDecimalPlaces(2).toString(),
        byUnit: units.map((u) => ({
          bargainingUnitId: u.id,
          bargainingUnitName: u.name,
          cost: (y.unitCosts.get(u.id) ?? new Decimal(0)).toDecimalPlaces(2).toString(),
        })),
      }));

      // Extract Year 1 (first negotiated contract year) for KPI cards —
      // only when the caller explicitly passed a scenarioId (not the final-scenario fallback).
      if (explicitScenarioId) {
        const year1Entry =
          sortedYears.find((y) => y.contractYear === 1) ??
          sortedYears.find((y) => y.contractYear > 0) ??
          sortedYears[0];

        if (year1Entry) {
          scenarioYear1TotalCost = year1Entry.totalEmployerCost
            .toDecimalPlaces(2)
            .toString();

          scenarioYear1ByUnit = units.map((u) => {
            const buEntry = employeeCountByUnit.find(
              (ecu) => ecu.bargainingUnitId === u.id
            );
            return {
              bargainingUnitId: u.id,
              bargainingUnitName: u.name,
              employeeCount: buEntry?.employeeCount ?? 0,
              totalPayroll: (year1Entry.unitCosts.get(u.id) ?? new Decimal(0))
                .toDecimalPlaces(2)
                .toString(),
            };
          });
        }
      }
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
    scenarioYear1TotalCost,
    scenarioYear1ByUnit,
    selectedScenarioName,
  });
});

export default router;
