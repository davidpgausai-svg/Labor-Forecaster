import {
  pgTable,
  text,
  uuid,
  numeric,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { benefitPlanTypesTable } from "./benefit-plan-types";

export const BENEFIT_TIERS = ["ee_only", "ee_spouse", "ee_child", "family"] as const;
export type BenefitTier = (typeof BENEFIT_TIERS)[number];

export const benefitPlanTiersTable = pgTable(
  "benefit_plan_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    benefitPlanTypeId: uuid("benefit_plan_type_id")
      .notNull()
      .references(() => benefitPlanTypesTable.id, { onDelete: "cascade" }),
    tier: text("tier").notNull(),
    employerContributionAnnual: numeric("employer_contribution_annual", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.benefitPlanTypeId, t.tier)]
);

export const insertBenefitPlanTierSchema = createInsertSchema(
  benefitPlanTiersTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertBenefitPlanTier = z.infer<typeof insertBenefitPlanTierSchema>;
export type BenefitPlanTier = typeof benefitPlanTiersTable.$inferSelect;
