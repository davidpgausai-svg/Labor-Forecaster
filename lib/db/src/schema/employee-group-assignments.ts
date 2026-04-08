import {
  pgTable,
  uuid,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeeGroupsTable } from "./employee-groups";
import { benefitPlanTypesTable } from "./benefit-plan-types";
import { retirementPlansTable } from "./retirement-plans";

export const employeeGroupBenefitAssignmentsTable = pgTable(
  "employee_group_benefit_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeGroupId: uuid("employee_group_id")
      .notNull()
      .references(() => employeeGroupsTable.id, { onDelete: "cascade" }),
    benefitPlanTypeId: uuid("benefit_plan_type_id")
      .notNull()
      .references(() => benefitPlanTypesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.employeeGroupId, t.benefitPlanTypeId)]
);

export const employeeGroupRetirementAssignmentsTable = pgTable(
  "employee_group_retirement_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeGroupId: uuid("employee_group_id")
      .notNull()
      .references(() => employeeGroupsTable.id, { onDelete: "cascade" }),
    retirementPlanId: uuid("retirement_plan_id")
      .notNull()
      .references(() => retirementPlansTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.employeeGroupId, t.retirementPlanId)]
);

export const insertGroupBenefitAssignmentSchema = createInsertSchema(
  employeeGroupBenefitAssignmentsTable
).omit({ id: true, createdAt: true });

export const insertGroupRetirementAssignmentSchema = createInsertSchema(
  employeeGroupRetirementAssignmentsTable
).omit({ id: true, createdAt: true });

export type InsertGroupBenefitAssignment = z.infer<
  typeof insertGroupBenefitAssignmentSchema
>;
export type GroupBenefitAssignment =
  typeof employeeGroupBenefitAssignmentsTable.$inferSelect;

export type InsertGroupRetirementAssignment = z.infer<
  typeof insertGroupRetirementAssignmentSchema
>;
export type GroupRetirementAssignment =
  typeof employeeGroupRetirementAssignmentsTable.$inferSelect;
