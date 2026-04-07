import { pgTable, text, uuid, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const districtsTable = pgTable("districts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  state: text("state").notNull().default("IL"),
  fiscalYearStart: text("fiscal_year_start").notNull().default("July 1"),
  studentEnrollment: integer("student_enrollment"),
  // FTE threshold at or above which an employee qualifies for employer-paid benefits
  benefitEligibleFteThreshold: numeric("benefit_eligible_fte_threshold", {
    precision: 5,
    scale: 4,
  })
    .notNull()
    .default("0.7500"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDistrictSchema = createInsertSchema(districtsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDistrict = z.infer<typeof insertDistrictSchema>;
export type District = typeof districtsTable.$inferSelect;
