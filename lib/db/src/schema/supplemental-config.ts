import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  bigint,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { compensationSchedulesTable } from "./compensation-schedules";
import { lanesTable } from "./salary-schedules";
import { employeesTable } from "./employees";

export const perDiemConfigsTable = pgTable("per_diem_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  compensationScheduleId: uuid("compensation_schedule_id")
    .notNull()
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  sourceScheduleId: uuid("source_schedule_id").references(
    () => compensationSchedulesTable.id
  ),
  contractDays: integer("contract_days").notNull().default(187),
  derivationMethod: text("derivation_method")
    .notNull()
    .default("independent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const perDiemCapsTable = pgTable("per_diem_caps", {
  id: uuid("id").primaryKey().defaultRandom(),
  compensationScheduleId: uuid("compensation_schedule_id")
    .notNull()
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  laneId: uuid("lane_id")
    .notNull()
    .references(() => lanesTable.id, { onDelete: "cascade" }),
  capStep: integer("cap_step").notNull(),
  capRateCents: bigint("cap_rate_cents", { mode: "number" }).notNull(),
});

export const stipendDefinitionsTable = pgTable("stipend_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  compensationScheduleId: uuid("compensation_schedule_id")
    .notNull()
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  amountType: text("amount_type").notNull().default("fixed_dollar"),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull().default(0),
  percentageValue: numeric("percentage_value", { precision: 10, scale: 4 }),
  maxAmountCents: bigint("max_amount_cents", { mode: "number" }),
  increaseWithBase: boolean("increase_with_base").notNull().default(false),
  trsCreditable: boolean("trs_creditable").notNull().default(false),
  imrfCreditable: boolean("imrf_creditable").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const salaryRangesTable = pgTable("salary_ranges", {
  id: uuid("id").primaryKey().defaultRandom(),
  compensationScheduleId: uuid("compensation_schedule_id")
    .notNull()
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  positionTitle: text("position_title").notNull(),
  minSalaryCents: bigint("min_salary_cents", { mode: "number" })
    .notNull()
    .default(0),
  midSalaryCents: bigint("mid_salary_cents", { mode: "number" })
    .notNull()
    .default(0),
  maxSalaryCents: bigint("max_salary_cents", { mode: "number" })
    .notNull()
    .default(0),
  displayOrder: integer("display_order").notNull().default(0),
});

export const flatRatesTable = pgTable("flat_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  compensationScheduleId: uuid("compensation_schedule_id")
    .notNull()
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  positionTitle: text("position_title").notNull(),
  annualAmountCents: bigint("annual_amount_cents", { mode: "number" })
    .notNull()
    .default(0),
  displayOrder: integer("display_order").notNull().default(0),
});

export const employeeStipendsTable = pgTable("employee_stipends", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employeesTable.id, { onDelete: "cascade" }),
  stipendDefinitionId: uuid("stipend_definition_id")
    .notNull()
    .references(() => stipendDefinitionsTable.id, { onDelete: "cascade" }),
  effectiveYear: integer("effective_year").notNull().default(0),
  overrideAmountCents: bigint("override_amount_cents", { mode: "number" }),
  hoursOrEvents: numeric("hours_or_events", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const compensationHourlyCategoriesTable = pgTable(
  "compensation_hourly_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compensationScheduleId: uuid("compensation_schedule_id")
      .notNull()
      .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    baseHourlyRate: numeric("base_hourly_rate", { precision: 10, scale: 4 })
      .notNull()
      .default("0"),
    annualHours: numeric("annual_hours", { precision: 10, scale: 2 })
      .notNull()
      .default("2080"),
    displayOrder: integer("display_order").notNull().default(0),
  }
);

export const insertPerDiemConfigSchema = createInsertSchema(
  perDiemConfigsTable
).omit({ id: true, createdAt: true });
export const insertStipendDefinitionSchema = createInsertSchema(
  stipendDefinitionsTable
).omit({ id: true });
export const insertSalaryRangeSchema = createInsertSchema(
  salaryRangesTable
).omit({ id: true });
export const insertFlatRateSchema = createInsertSchema(flatRatesTable).omit({
  id: true,
});

export const insertEmployeeStipendSchema = createInsertSchema(employeeStipendsTable).omit({ id: true, createdAt: true });

export const insertCompensationHourlyCategorySchema = createInsertSchema(
  compensationHourlyCategoriesTable
).omit({ id: true });
export type CompensationHourlyCategory =
  typeof compensationHourlyCategoriesTable.$inferSelect;

export const importGridCellsTable = pgTable(
  "import_grid_cells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compensationScheduleId: uuid("compensation_schedule_id")
      .notNull()
      .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
    laneId: uuid("lane_id")
      .notNull()
      .references(() => lanesTable.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    salaryCents: bigint("salary_cents", { mode: "number" }).notNull().default(0),
  },
  (t) => [unique().on(t.compensationScheduleId, t.laneId, t.stepNumber)]
);

export const insertImportGridCellSchema = createInsertSchema(
  importGridCellsTable
).omit({ id: true });
export type ImportGridCell = typeof importGridCellsTable.$inferSelect;

export type PerDiemConfig = typeof perDiemConfigsTable.$inferSelect;
export type PerDiemCap = typeof perDiemCapsTable.$inferSelect;
export type StipendDefinition = typeof stipendDefinitionsTable.$inferSelect;
export type SalaryRange = typeof salaryRangesTable.$inferSelect;
export type FlatRate = typeof flatRatesTable.$inferSelect;
export type EmployeeStipend = typeof employeeStipendsTable.$inferSelect;
export type InsertEmployeeStipend = z.infer<typeof insertEmployeeStipendSchema>;
