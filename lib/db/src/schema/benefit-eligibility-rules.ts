import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";

export const benefitEligibilityRulesTable = pgTable(
  "benefit_eligibility_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: uuid("district_id")
      .notNull()
      .references(() => districtsTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    minFteThreshold: numeric("min_fte_threshold", { precision: 5, scale: 4 })
      .notNull()
      .default("1.0000"),
    includePartTime: boolean("include_part_time").notNull().default(false),
    includeSeasonal: boolean("include_seasonal").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.districtId, t.category)]
);

export const insertBenefitEligibilityRuleSchema = createInsertSchema(
  benefitEligibilityRulesTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertBenefitEligibilityRule = z.infer<
  typeof insertBenefitEligibilityRuleSchema
>;
export type BenefitEligibilityRule =
  typeof benefitEligibilityRulesTable.$inferSelect;
