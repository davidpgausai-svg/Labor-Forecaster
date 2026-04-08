import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";

export const BENEFIT_CATEGORIES = [
  "health",
  "dental",
  "vision",
  "life",
  "add",
  "ltd",
  "std",
  "other",
] as const;
export type BenefitCategory = (typeof BENEFIT_CATEGORIES)[number];

export const BENEFIT_CALC_METHODS = [
  "flat_dollar",
  "rate_per_100",
  "rate_per_1000",
  "percent_of_salary",
] as const;
export type BenefitCalcMethod = (typeof BENEFIT_CALC_METHODS)[number];

export const benefitPlanTypesTable = pgTable("benefit_plan_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .notNull()
    .references(() => districtsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  planName: text("plan_name").notNull(),
  calculationMethod: text("calculation_method").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBenefitPlanTypeSchema = createInsertSchema(
  benefitPlanTypesTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertBenefitPlanType = z.infer<typeof insertBenefitPlanTypeSchema>;
export type BenefitPlanType = typeof benefitPlanTypesTable.$inferSelect;
