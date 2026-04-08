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
import { districtsTable } from "./districts";

export const employerAccountContributionsTable = pgTable(
  "employer_account_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: uuid("district_id")
      .notNull()
      .references(() => districtsTable.id, { onDelete: "cascade" }),
    accountType: text("account_type").notNull(), // 'hsa' | 'hra'
    tier: text("tier").notNull(), // 'ee_only' | 'ee_spouse' | 'ee_child' | 'family'
    employerContributionAnnual: numeric("employer_contribution_annual", {
      precision: 15,
      scale: 2,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.districtId, t.accountType, t.tier)]
);

export const insertEmployerAccountContributionSchema = createInsertSchema(
  employerAccountContributionsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertEmployerAccountContribution = z.infer<
  typeof insertEmployerAccountContributionSchema
>;
export type EmployerAccountContribution =
  typeof employerAccountContributionsTable.$inferSelect;
