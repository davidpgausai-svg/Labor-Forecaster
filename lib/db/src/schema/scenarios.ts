import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  integer,
  bigint,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";
import { bargainingUnitsTable } from "./bargaining-units";
import { employeesTable } from "./employees";
import { lanesTable } from "./salary-schedules";
import { employeeGroupsTable } from "./employee-groups";
import { compensationSchedulesTable } from "./compensation-schedules";

export const scenarioStatusEnum = pgEnum("scenario_status", [
  "draft",
  "active",
  "final",
  "archived",
]);

export const increaseTypeEnum = pgEnum("increase_type", [
  "fixed_percentage",
  "cpi_formula",
  "flat_dollar",
  "step_only",
  "custom",
]);

export const scenariosTable = pgTable("scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .notNull()
    .references(() => districtsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isFinal: boolean("is_final").notNull().default(false),
  status: scenarioStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const scenarioYearConfigsTable = pgTable("scenario_year_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  scenarioId: uuid("scenario_id")
    .notNull()
    .references(() => scenariosTable.id, { onDelete: "cascade" }),
  bargainingUnitId: uuid("bargaining_unit_id")
    .references(() => bargainingUnitsTable.id, { onDelete: "cascade" }),
  contractYear: integer("contract_year").notNull(),
  yearLabel: text("year_label").notNull(),
  increaseType: increaseTypeEnum("increase_type")
    .notNull()
    .default("fixed_percentage"),
  fixedPercentage: numeric("fixed_percentage", { precision: 10, scale: 4 }),
  cpiValue: numeric("cpi_value", { precision: 10, scale: 4 }),
  cpiAdder: numeric("cpi_adder", { precision: 10, scale: 4 }),
  cpiCap: numeric("cpi_cap", { precision: 10, scale: 4 }),
  cpiFloor: numeric("cpi_floor", { precision: 10, scale: 4 }),
  cpiIndexName: text("cpi_index_name"),
  highEarnerThreshold: numeric("high_earner_threshold", {
    precision: 15,
    scale: 2,
  }),
  highEarnerFlatIncrease: numeric("high_earner_flat_increase", {
    precision: 15,
    scale: 2,
  }),
  effectiveRate: numeric("effective_rate", { precision: 10, scale: 4 }),
  educationalAdvancementBa15: numeric("educational_advancement_ba15", {
    precision: 15,
    scale: 2,
  }),
  educationalAdvancementMa: numeric("educational_advancement_ma", {
    precision: 15,
    scale: 2,
  }),
  educationalAdvancementMa15: numeric("educational_advancement_ma15", {
    precision: 15,
    scale: 2,
  }),
  stepAdvancement: boolean("step_advancement").notNull().default(true),
  healthPremiumIncreaseRate: numeric("health_premium_increase_rate", {
    precision: 10,
    scale: 4,
  }),
  healthEmployerCapRate: numeric("health_employer_cap_rate", {
    precision: 10,
    scale: 4,
  }),
  // Unified benefit cost trend rate — applies to all flat-dollar benefits.
  // If set, takes precedence over healthPremiumIncreaseRate / healthEmployerCapRate.
  benefitCostTrendRate: numeric("benefit_cost_trend_rate", {
    precision: 10,
    scale: 4,
  }),
  notes: text("notes"),
  employeeGroupId: uuid("employee_group_id").references(
    () => employeeGroupsTable.id
  ),
  compensationScheduleId: uuid("compensation_schedule_id").references(
    () => compensationSchedulesTable.id
  ),
  baseAdjustmentType: text("base_adjustment_type"),
  baseAdjustmentValue: numeric("base_adjustment_value", {
    precision: 15,
    scale: 4,
  }),
});

export const employeeYearRecordsTable = pgTable("employee_year_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  scenarioId: uuid("scenario_id")
    .notNull()
    .references(() => scenariosTable.id, { onDelete: "cascade" }),
  contractYear: integer("contract_year").notNull(),
  projectedStep: integer("projected_step"),
  projectedLaneId: uuid("projected_lane_id").references(() => lanesTable.id),
  projectedHourlyRate: numeric("projected_hourly_rate", {
    precision: 10,
    scale: 4,
  }),
  projectedBaseSalaryCents: bigint("projected_base_salary_cents", { mode: "number" }).notNull(),
  projectedTotalCompensationCents: bigint("projected_total_compensation_cents", { mode: "number" }).notNull(),
  retirementContributionCents: bigint("retirement_contribution_cents", { mode: "number" }).notNull(),
  ficaCostCents: bigint("fica_cost_cents", { mode: "number" }).notNull(),
  futaCostCents: bigint("futa_cost_cents", { mode: "number" }).notNull().default(0),
  sutaCostCents: bigint("suta_cost_cents", { mode: "number" }).notNull().default(0),
  healthInsuranceCostCents: bigint("health_insurance_cost_cents", { mode: "number" }).notNull(),
  otherBenefitsCostCents: bigint("other_benefits_cost_cents", { mode: "number" }).notNull(),
  totalEmployerCostCents: bigint("total_employer_cost_cents", { mode: "number" }).notNull(),
  effectiveRate: numeric("effective_rate", { precision: 10, scale: 4 }),
  isRetirementYear: boolean("is_retirement_year").notNull().default(false),
  retirementIncentiveAmountCents: bigint("retirement_incentive_amount_cents", { mode: "number" }),
  projectedDailyRateCents: bigint("projected_daily_rate_cents", { mode: "number" }),
  stipendTotalCents: bigint("stipend_total_cents", { mode: "number" }),
  rangePosition: text("range_position"),
  // Multi-position aggregates (null for legacy single-position employees)
  totalFteFraction: numeric("total_fte_fraction", { precision: 5, scale: 4 }),
  benefitEligible: boolean("benefit_eligible"),
});

export const insertScenarioSchema = createInsertSchema(scenariosTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertScenarioYearConfigSchema = createInsertSchema(
  scenarioYearConfigsTable
).omit({ id: true });
export const insertEmployeeYearRecordSchema = createInsertSchema(
  employeeYearRecordsTable
).omit({ id: true });

export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type Scenario = typeof scenariosTable.$inferSelect;
export type InsertScenarioYearConfig = z.infer<
  typeof insertScenarioYearConfigSchema
>;
export type ScenarioYearConfig = typeof scenarioYearConfigsTable.$inferSelect;

export type ScenarioYearConfigInsert = Omit<
  typeof scenarioYearConfigsTable.$inferInsert,
  "bargainingUnitId" | "employeeGroupId" | "compensationScheduleId"
> & {
  bargainingUnitId?: string | null;
  employeeGroupId?: string | null;
  compensationScheduleId?: string | null;
};
export type InsertEmployeeYearRecord = z.infer<
  typeof insertEmployeeYearRecordSchema
>;
export type EmployeeYearRecord = typeof employeeYearRecordsTable.$inferSelect;
