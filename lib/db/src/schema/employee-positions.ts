import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  integer,
  timestamp,
  date,
  bigint,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { employeeGroupsTable } from "./employee-groups";
import { bargainingUnitsTable } from "./bargaining-units";
import { compensationSchedulesTable } from "./compensation-schedules";
import { lanesTable } from "./salary-schedules";
import { scenariosTable } from "./scenarios";

// ---------------------------------------------------------------------------
// employee_positions — one row per concurrent job held by an employee
// ---------------------------------------------------------------------------

export const POSITION_STATUSES = ["active", "inactive", "on_leave"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const employeePositionsTable = pgTable("employee_positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  employeeGroupId: uuid("employee_group_id").references(
    () => employeeGroupsTable.id
  ),
  bargainingUnitId: uuid("bargaining_unit_id").references(
    () => bargainingUnitsTable.id
  ),
  compensationScheduleId: uuid("compensation_schedule_id").references(
    () => compensationSchedulesTable.id
  ),
  jobTitle: text("job_title"),
  // FTE fraction for this position, e.g. 1.0 = full-time, 0.5 = half-time
  fteFraction: numeric("fte_fraction", { precision: 5, scale: 4 })
    .notNull()
    .default("1.0000"),
  currentStep: integer("current_step"),
  currentLaneId: uuid("current_lane_id").references(() => lanesTable.id),
  currentAnnualSalary: numeric("current_annual_salary", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  currentHourlyRate: numeric("current_hourly_rate", {
    precision: 10,
    scale: 4,
  }),
  annualHours: numeric("annual_hours", { precision: 10, scale: 2 }),
  // isPrimary: drives benefit rates + header display
  isPrimary: boolean("is_primary").notNull().default(false),
  status: text("status").notNull().default("active"),
  effectiveDate: date("effective_date"),
  endDate: date("end_date"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployeePositionSchema = createInsertSchema(
  employeePositionsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertEmployeePosition = z.infer<typeof insertEmployeePositionSchema>;
export type EmployeePosition = typeof employeePositionsTable.$inferSelect;

// ---------------------------------------------------------------------------
// employee_position_year_records — per-position projection detail
// Linked to the aggregate employee_year_records row.
// ---------------------------------------------------------------------------

export const employeePositionYearRecordsTable = pgTable(
  "employee_position_year_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // aggregate parent
    employeeYearRecordId: uuid("employee_year_record_id").notNull(),
    positionId: uuid("position_id")
      .notNull()
      .references(() => employeePositionsTable.id, { onDelete: "cascade" }),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenariosTable.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employeesTable.id, { onDelete: "cascade" }),
    contractYear: integer("contract_year").notNull(),
    // snapshot of FTE at calculation time
    fteFraction: numeric("fte_fraction", { precision: 5, scale: 4 })
      .notNull()
      .default("1.0000"),
    projectedBaseSalaryCents: bigint("projected_base_salary_cents", {
      mode: "number",
    }).notNull(),
    projectedStep: integer("projected_step"),
    projectedLaneId: uuid("projected_lane_id"),
    projectedHourlyRate: numeric("projected_hourly_rate", {
      precision: 10,
      scale: 4,
    }),
    // retirement for this position (system determined by employeeGroup)
    retirementContributionCents: bigint("retirement_contribution_cents", {
      mode: "number",
    })
      .notNull()
      .default(0),
    ficaCostCents: bigint("fica_cost_cents", { mode: "number" })
      .notNull()
      .default(0),
    workersCompCents: bigint("workers_comp_cents", { mode: "number" })
      .notNull()
      .default(0),
    effectiveRate: numeric("effective_rate", { precision: 10, scale: 4 }),
  }
);

export const insertEmployeePositionYearRecordSchema = createInsertSchema(
  employeePositionYearRecordsTable
).omit({ id: true });

export type InsertEmployeePositionYearRecord = z.infer<
  typeof insertEmployeePositionYearRecordSchema
>;
export type EmployeePositionYearRecord =
  typeof employeePositionYearRecordsTable.$inferSelect;
