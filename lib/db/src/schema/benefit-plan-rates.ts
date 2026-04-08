import {
  pgTable,
  uuid,
  numeric,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { benefitPlanTypesTable } from "./benefit-plan-types";

export const benefitPlanRatesTable = pgTable(
  "benefit_plan_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    benefitPlanTypeId: uuid("benefit_plan_type_id")
      .notNull()
      .references(() => benefitPlanTypesTable.id, { onDelete: "cascade" }),
    rate: numeric("rate", { precision: 10, scale: 6 }).notNull(),
    coveredEarningsCap: numeric("covered_earnings_cap", { precision: 15, scale: 2 }),
    benefitMultiplier: numeric("benefit_multiplier", { precision: 5, scale: 2 }),
    flatBenefitAmount: numeric("flat_benefit_amount", { precision: 15, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.benefitPlanTypeId)]
);

export const insertBenefitPlanRateSchema = createInsertSchema(
  benefitPlanRatesTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertBenefitPlanRate = z.infer<typeof insertBenefitPlanRateSchema>;
export type BenefitPlanRate = typeof benefitPlanRatesTable.$inferSelect;
