import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";
import { bargainingUnitsTable } from "./bargaining-units";
import { employeesTable } from "./employees";
import { lanesTable } from "./salary-schedules";

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
    .notNull()
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
  notes: text("notes"),
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
  projectedBaseSalary: numeric("projected_base_salary", {
    precision: 15,
    scale: 2,
  }).notNull(),
  projectedTotalCompensation: numeric("projected_total_compensation", {
    precision: 15,
    scale: 2,
  }).notNull(),
  retirementContribution: numeric("retirement_contribution", {
    precision: 15,
    scale: 2,
  }).notNull(),
  ficaCost: numeric("fica_cost", { precision: 15, scale: 2 }).notNull(),
  healthInsuranceCost: numeric("health_insurance_cost", {
    precision: 15,
    scale: 2,
  }).notNull(),
  otherBenefitsCost: numeric("other_benefits_cost", {
    precision: 15,
    scale: 2,
  }).notNull(),
  totalEmployerCost: numeric("total_employer_cost", {
    precision: 15,
    scale: 2,
  }).notNull(),
  effectiveRate: numeric("effective_rate", { precision: 10, scale: 4 }),
  isRetirementYear: boolean("is_retirement_year").notNull().default(false),
  retirementIncentiveAmount: numeric("retirement_incentive_amount", {
    precision: 15,
    scale: 2,
  }),
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
export type InsertEmployeeYearRecord = z.infer<
  typeof insertEmployeeYearRecordSchema
>;
export type EmployeeYearRecord = typeof employeeYearRecordsTable.$inferSelect;
