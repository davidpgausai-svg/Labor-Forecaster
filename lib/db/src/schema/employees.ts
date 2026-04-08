import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  integer,
  timestamp,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";
import { bargainingUnitsTable } from "./bargaining-units";
import { lanesTable } from "./salary-schedules";
import { hourlyCategoriesTable } from "./hourly-schedules";
import { employeeGroupsTable } from "./employee-groups";
import { compensationSchedulesTable } from "./compensation-schedules";

export const insuranceElectionEnum = pgEnum("insurance_election", [
  "single",
  "single_plus_spouse",
  "single_plus_child",
  "family",
  "waived",
]);

export const retirementPlanEnum = pgEnum("retirement_plan", [
  "none",
  "option1_4year",
  "option2_2year",
  "option3_longevity",
]);

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "new_hire",
  "terminated",
  "retired",
  "on_leave",
]);

export const employeesTable = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .notNull()
    .references(() => districtsTable.id, { onDelete: "cascade" }),
  bargainingUnitId: uuid("bargaining_unit_id")
    .references(() => bargainingUnitsTable.id),
  employeeNumber: text("employee_number"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  hireDate: date("hire_date"),
  birthDate: date("birth_date"),
  effectiveDate: date("effective_date"),
  terminationDate: date("termination_date"),
  yearsInDistrict: integer("years_in_district").notNull().default(0),
  yearsTotalService: integer("years_total_service").notNull().default(0),
  compensationType: text("compensation_type").notNull().default("salary"),
  currentLaneId: uuid("current_lane_id").references(() => lanesTable.id),
  currentStep: integer("current_step"),
  currentHourlyCategoryId: uuid("current_hourly_category_id").references(
    () => hourlyCategoriesTable.id
  ),
  currentHourlyRate: numeric("current_hourly_rate", { precision: 10, scale: 4 }),
  annualHours: numeric("annual_hours", { precision: 10, scale: 2 }),
  currentAnnualSalary: numeric("current_annual_salary", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  insuranceElection: insuranceElectionEnum("insurance_election")
    .notNull()
    .default("single"),
  retirementEligible: boolean("retirement_eligible").notNull().default(false),
  retirementPlan: retirementPlanEnum("retirement_plan").notNull().default("none"),
  retirementTargetYear: integer("retirement_target_year"),
  status: employeeStatusEnum("status").notNull().default("active"),
  contractYear: integer("contract_year").notNull().default(0),
  notes: text("notes"),
  employeeGroupId: uuid("employee_group_id").references(
    () => employeeGroupsTable.id
  ),
  primaryScheduleId: uuid("primary_schedule_id").references(
    () => compensationSchedulesTable.id
  ),
  pendingEffectiveContractYear: integer("pending_effective_contract_year"),
  pendingBargainingUnitId: uuid("pending_bargaining_unit_id").references(
    () => bargainingUnitsTable.id
  ),
  pendingEmployeeGroupId: uuid("pending_employee_group_id").references(
    () => employeeGroupsTable.id
  ),
  pendingCurrentStep: integer("pending_current_step"),
  pendingCurrentLaneId: uuid("pending_current_lane_id").references(
    () => lanesTable.id
  ),
  pendingAnnualSalary: numeric("pending_annual_salary", { precision: 15, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
