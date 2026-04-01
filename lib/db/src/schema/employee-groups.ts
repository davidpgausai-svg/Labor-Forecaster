import {
  pgTable,
  text,
  uuid,
  numeric,
  boolean,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { districtsTable } from "./districts";

export const EMPLOYEE_RETIREMENT_SYSTEMS = [
  "TRS",
  "IMRF",
  "PSRS",
  "other",
] as const;

export type EmployeeRetirementSystem =
  (typeof EMPLOYEE_RETIREMENT_SYSTEMS)[number];

export const employeeGroupsTable = pgTable("employee_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  districtId: uuid("district_id")
    .notNull()
    .references(() => districtsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  contractDays: integer("contract_days"),
  bargainingUnitName: text("bargaining_unit_name"),
  isUnionized: boolean("is_unionized").notNull().default(true),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  contractYears: integer("contract_years").notNull().default(5),
  retirementSystem: text("retirement_system").notNull().default("TRS"),
  retirementEmployeeRate: numeric("retirement_employee_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("0.09"),
  retirementEmployerRate: numeric("retirement_employer_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("0"),
  retirementGrossUpRate: numeric("retirement_gross_up_rate", {
    precision: 10,
    scale: 6,
  })
    .notNull()
    .default("0.008901"),
  ficaRate: numeric("fica_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0.0765"),
  ficaExempt: boolean("fica_exempt").notNull().default(false),
  healthInsuranceSingleAnnual: numeric("health_insurance_single_annual", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  healthInsuranceFamilyAnnual: numeric("health_insurance_family_annual", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  healthInsuranceEmployerCapRate: numeric("health_insurance_employer_cap_rate", {
    precision: 10,
    scale: 6,
  }),
  dentalAnnual: numeric("dental_annual", { precision: 15, scale: 2 })
    .notNull()
    .default("0"),
  lifeInsuranceAnnual: numeric("life_insurance_annual", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  disabilityInsuranceAnnual: numeric("disability_insurance_annual", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  hsaContributionSingle: numeric("hsa_contribution_single", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  hsaContributionFamily: numeric("hsa_contribution_family", {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default("0"),
  workersCompRate: numeric("workers_comp_rate", { precision: 10, scale: 6 })
    .notNull()
    .default("0"),
  displayOrder: integer("display_order").notNull().default(0),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployeeGroupSchema = createInsertSchema(
  employeeGroupsTable
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmployeeGroup = z.infer<typeof insertEmployeeGroupSchema>;
export type EmployeeGroup = typeof employeeGroupsTable.$inferSelect;
