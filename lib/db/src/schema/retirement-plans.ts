import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";

export const retirementPlansTable = pgTable("retirement_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .notNull()
    .references(() => districtsTable.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull(),
  planType: text("plan_type").notNull(), // 'defined_benefit' | 'defined_contribution'
  employerRate: numeric("employer_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),
  employerMatchCapPercent: numeric("employer_match_cap_percent", {
    precision: 10,
    scale: 6,
  }),
  grossUpRate: numeric("gross_up_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),
  employeeRate: numeric("employee_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),
  isFicaExempt: boolean("is_fica_exempt").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRetirementPlanSchema = createInsertSchema(
  retirementPlansTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertRetirementPlan = z.infer<typeof insertRetirementPlanSchema>;
export type RetirementPlan = typeof retirementPlansTable.$inferSelect;
