import {
  pgTable,
  text,
  uuid,
  numeric,
  integer,
  bigint,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bargainingUnitsTable } from "./bargaining-units";
import { compensationSchedulesTable } from "./compensation-schedules";

export const salarySchedulesTable = pgTable("salary_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  bargainingUnitId: uuid("bargaining_unit_id")
    .references(() => bargainingUnitsTable.id, { onDelete: "cascade" }),
  compensationScheduleId: uuid("compensation_schedule_id")
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  effectiveYear: integer("effective_year").notNull().default(0),
  baseSalary: numeric("base_salary", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lanesTable = pgTable("lanes", {
  id: uuid("id").primaryKey().defaultRandom(),
  salaryScheduleId: uuid("salary_schedule_id")
    .references(() => salarySchedulesTable.id, { onDelete: "cascade" }),
  compensationScheduleId: uuid("compensation_schedule_id")
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  indexMultiplier: numeric("index_multiplier", { precision: 10, scale: 6 })
    .notNull()
    .default("1.0"),
});

export const stepsTable = pgTable("steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  salaryScheduleId: uuid("salary_schedule_id")
    .notNull()
    .references(() => salarySchedulesTable.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  incrementMultiplier: numeric("increment_multiplier", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("1.0"),
});

export const scheduleCellsTable = pgTable("schedule_cells", {
  id: uuid("id").primaryKey().defaultRandom(),
  salaryScheduleId: uuid("salary_schedule_id")
    .notNull()
    .references(() => salarySchedulesTable.id, { onDelete: "cascade" }),
  laneId: uuid("lane_id")
    .notNull()
    .references(() => lanesTable.id, { onDelete: "cascade" }),
  stepId: uuid("step_id")
    .notNull()
    .references(() => stepsTable.id, { onDelete: "cascade" }),
  salaryAmount: numeric("salary_amount", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
});

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
  (t) => [
    unique().on(t.compensationScheduleId, t.laneId, t.stepNumber),
  ]
);

export const insertSalaryScheduleSchema = createInsertSchema(
  salarySchedulesTable
).omit({ id: true, createdAt: true });
export const insertLaneSchema = createInsertSchema(lanesTable).omit({
  id: true,
});
export const insertStepSchema = createInsertSchema(stepsTable).omit({
  id: true,
});
export const insertScheduleCellSchema = createInsertSchema(
  scheduleCellsTable
).omit({ id: true });
export const insertImportGridCellSchema = createInsertSchema(
  importGridCellsTable
).omit({ id: true });

export type InsertSalarySchedule = z.infer<typeof insertSalaryScheduleSchema>;
export type SalarySchedule = typeof salarySchedulesTable.$inferSelect;
export type Lane = typeof lanesTable.$inferSelect;
export type Step = typeof stepsTable.$inferSelect;
export type ScheduleCell = typeof scheduleCellsTable.$inferSelect;
export type ImportGridCell = typeof importGridCellsTable.$inferSelect;
export type InsertImportGridCell = z.infer<typeof insertImportGridCellSchema>;
