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
import { districtsTable } from "./districts";

export const employerTaxConfigTable = pgTable(
  "employer_tax_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    districtId: uuid("district_id")
      .notNull()
      .references(() => districtsTable.id, { onDelete: "cascade" }),
    ssRate: numeric("ss_rate", { precision: 10, scale: 6 })
      .notNull()
      .default("0.062000"),
    ssWageBase: numeric("ss_wage_base", { precision: 15, scale: 2 })
      .notNull()
      .default("176100.00"),
    medicareRate: numeric("medicare_rate", { precision: 10, scale: 6 })
      .notNull()
      .default("0.014500"),
    futaRate: numeric("futa_rate", { precision: 10, scale: 6 })
      .notNull()
      .default("0.006000"),
    futaWageBase: numeric("futa_wage_base", { precision: 15, scale: 2 })
      .notNull()
      .default("7000.00"),
    sutaRate: numeric("suta_rate", { precision: 10, scale: 6 })
      .notNull()
      .default("0.027000"),
    sutaWageBase: numeric("suta_wage_base", { precision: 15, scale: 2 })
      .notNull()
      .default("13000.00"),
    workersCompRatePer100: numeric("workers_comp_rate_per_100", {
      precision: 10,
      scale: 6,
    })
      .notNull()
      .default("0.000000"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.districtId)]
);

export const insertEmployerTaxConfigSchema = createInsertSchema(
  employerTaxConfigTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertEmployerTaxConfig = z.infer<
  typeof insertEmployerTaxConfigSchema
>;
export type EmployerTaxConfig = typeof employerTaxConfigTable.$inferSelect;
