import {
  pgTable,
  uuid,
  numeric,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { compensationSchedulesTable } from "./compensation-schedules";
import { lanesTable } from "./salary-schedules";

export const indexGridConfigsTable = pgTable("index_grid_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  compensationScheduleId: uuid("compensation_schedule_id")
    .notNull()
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  baseAnchorSalary: numeric("base_anchor_salary", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  maxSteps: integer("max_steps").notNull().default(30),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scheduleIndicesTable = pgTable("schedule_indices", {
  id: uuid("id").primaryKey().defaultRandom(),
  compensationScheduleId: uuid("compensation_schedule_id")
    .notNull()
    .references(() => compensationSchedulesTable.id, { onDelete: "cascade" }),
  laneId: uuid("lane_id")
    .notNull()
    .references(() => lanesTable.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(),
  indexValue: numeric("index_value", { precision: 10, scale: 4 })
    .notNull()
    .default("1.0000"),
  isCapped: boolean("is_capped").notNull().default(false),
});

export const insertIndexGridConfigSchema = createInsertSchema(
  indexGridConfigsTable
).omit({ id: true, createdAt: true });

export const insertScheduleIndexSchema = createInsertSchema(
  scheduleIndicesTable
).omit({ id: true });

export type InsertIndexGridConfig = z.infer<typeof insertIndexGridConfigSchema>;
export type IndexGridConfig = typeof indexGridConfigsTable.$inferSelect;
export type InsertScheduleIndex = z.infer<typeof insertScheduleIndexSchema>;
export type ScheduleIndex = typeof scheduleIndicesTable.$inferSelect;
