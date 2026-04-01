import {
  pgTable,
  text,
  uuid,
  numeric,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { bargainingUnitsTable } from "./bargaining-units";

export const hourlySchedulesTable = pgTable("hourly_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  bargainingUnitId: uuid("bargaining_unit_id")
    .notNull()
    .references(() => bargainingUnitsTable.id, { onDelete: "cascade" }),
  effectiveYear: integer("effective_year").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const hourlyCategoriesTable = pgTable("hourly_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  hourlyScheduleId: uuid("hourly_schedule_id")
    .notNull()
    .references(() => hourlySchedulesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  baseHourlyRate: numeric("base_hourly_rate", { precision: 10, scale: 4 })
    .notNull()
    .default("0"),
  annualHours: numeric("annual_hours", { precision: 10, scale: 2 })
    .notNull()
    .default("2080"),
  displayOrder: integer("display_order").notNull().default(0),
});

export const insertHourlyScheduleSchema = createInsertSchema(
  hourlySchedulesTable
).omit({ id: true, createdAt: true });
export const insertHourlyCategorySchema = createInsertSchema(
  hourlyCategoriesTable
).omit({ id: true });

export type InsertHourlySchedule = z.infer<typeof insertHourlyScheduleSchema>;
export type HourlySchedule = typeof hourlySchedulesTable.$inferSelect;
export type InsertHourlyCategory = z.infer<typeof insertHourlyCategorySchema>;
export type HourlyCategory = typeof hourlyCategoriesTable.$inferSelect;
