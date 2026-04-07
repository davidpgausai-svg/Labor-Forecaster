import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeeGroupsTable } from "./employee-groups";

export const COMPENSATION_SCHEDULE_TYPES = [
  "index_based_grid",
  "individual_salary",
  "direct_import_grid",
  "hourly",
  "per_diem",
  "flat_rate",
  "stipend_table",
  "range_based",
] as const;

export const COMPENSATION_PAY_TYPES = ["salary", "hourly", "per_diem"] as const;

export type CompensationScheduleType = (typeof COMPENSATION_SCHEDULE_TYPES)[number];
export type CompensationPayType = (typeof COMPENSATION_PAY_TYPES)[number];

export const compensationSchedulesTable = pgTable("compensation_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeGroupId: uuid("employee_group_id")
    .notNull()
    .references(() => employeeGroupsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  scheduleType: text("schedule_type").notNull(),
  payType: text("pay_type").notNull().default("salary"),
  isPrimary: boolean("is_primary").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  description: text("description"),
  effectiveDate: date("effective_date"),
  effectiveDateRule: text("effective_date_rule"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompensationScheduleSchema = createInsertSchema(
  compensationSchedulesTable
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCompensationSchedule = z.infer<
  typeof insertCompensationScheduleSchema
>;
export type CompensationSchedule =
  typeof compensationSchedulesTable.$inferSelect;
