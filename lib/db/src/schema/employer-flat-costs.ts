import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";

export const employerFlatCostsTable = pgTable("employer_flat_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .notNull()
    .references(() => districtsTable.id, { onDelete: "cascade" }),
  costName: text("cost_name").notNull(),
  annualCostPerEmployee: numeric("annual_cost_per_employee", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployerFlatCostSchema = createInsertSchema(
  employerFlatCostsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertEmployerFlatCost = z.infer<typeof insertEmployerFlatCostSchema>;
export type EmployerFlatCost = typeof employerFlatCostsTable.$inferSelect;
