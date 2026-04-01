import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const districtsTable = pgTable("districts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  state: text("state").notNull().default("IL"),
  fiscalYearStart: text("fiscal_year_start").notNull().default("July 1"),
  studentEnrollment: integer("student_enrollment"),
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
