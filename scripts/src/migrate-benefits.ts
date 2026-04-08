/**
 * migrate-benefits.ts
 *
 * One-time migration: reads existing employee_groups benefit/retirement/tax
 * flat fields and creates normalized records in the new Employer Cost Center tables.
 *
 * Safe to run multiple times — skips districts that already have data.
 *
 * Usage: cd scripts && pnpm run migrate-benefits
 */
import { db } from "@workspace/db";
import {
  employeeGroupsTable,
  districtsTable,
  benefitPlanTypesTable,
  benefitPlanTiersTable,
  retirementPlansTable,
  employerTaxConfigTable,
  employeeGroupBenefitAssignmentsTable,
  employeeGroupRetirementAssignmentsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("Starting benefits migration...");

  const districts = await db.select().from(districtsTable);

  for (const district of districts) {
    console.log(`\nProcessing district: ${district.name} (${district.id})`);

    // Skip if tax config already exists (idempotency check)
    const existingTax = await db
      .select({ id: employerTaxConfigTable.id })
      .from(employerTaxConfigTable)
      .where(eq(employerTaxConfigTable.districtId, district.id))
      .limit(1)
      .then((r) => r[0]);

    if (!existingTax) {
      // Create default tax config (FICA rates from district employee groups)
      const groups = await db
        .select()
        .from(employeeGroupsTable)
        .where(eq(employeeGroupsTable.districtId, district.id));

      // Use the first non-exempt group for FICA reference, or defaults
      const ficaGroup = groups.find((g) => !g.ficaExempt) ?? groups[0];

      await db.insert(employerTaxConfigTable).values({
        districtId: district.id,
        ssRate: "0.062000",
        ssWageBase: "176100.00",
        medicareRate: "0.014500",
        futaRate: "0.006000",
        futaWageBase: "7000.00",
        sutaRate: "0.027000",
        sutaWageBase: "13000.00",
        workersCompRatePer100: ficaGroup?.workersCompRate ?? "0.000000",
        notes: "Migrated from employee group defaults",
      });
      console.log("  ✓ Created employer tax config");
    } else {
      console.log("  → Tax config already exists, skipping");
    }

    const groups = await db
      .select()
      .from(employeeGroupsTable)
      .where(eq(employeeGroupsTable.districtId, district.id));

    for (const group of groups) {
      console.log(`  Group: ${group.name}`);

      // ── Retirement plan ──────────────────────────────────────────────────
      const existingRetirement = await db
        .select({ id: retirementPlansTable.id })
        .from(retirementPlansTable)
        .where(
          and(
            eq(retirementPlansTable.districtId, district.id),
            eq(retirementPlansTable.planName, group.retirementSystem)
          )
        )
        .limit(1)
        .then((r) => r[0]);

      let retirementPlanId = existingRetirement?.id;

      if (!retirementPlanId) {
        const [plan] = await db
          .insert(retirementPlansTable)
          .values({
            districtId: district.id,
            planName: group.retirementSystem,
            planType: "defined_benefit",
            employerRate: group.retirementEmployerRate,
            grossUpRate: group.retirementGrossUpRate,
            employeeRate: group.retirementEmployeeRate,
            isFicaExempt: group.ficaExempt,
            isActive: true,
            notes: `Migrated from group: ${group.name}`,
          })
          .returning();
        retirementPlanId = plan.id;
        console.log(`    ✓ Created retirement plan: ${group.retirementSystem}`);
      }

      // Link group to retirement plan
      await db
        .insert(employeeGroupRetirementAssignmentsTable)
        .values({ employeeGroupId: group.id, retirementPlanId })
        .onConflictDoNothing();

      // ── Health plan ──────────────────────────────────────────────────────
      const healthSingle = parseFloat(group.healthInsuranceSingleAnnual);
      const healthFamily = parseFloat(group.healthInsuranceFamilyAnnual);
      if (healthSingle > 0 || healthFamily > 0) {
        const planName = `Health Plan (${group.name})`;
        const existing = await db
          .select({ id: benefitPlanTypesTable.id })
          .from(benefitPlanTypesTable)
          .where(
            and(
              eq(benefitPlanTypesTable.districtId, district.id),
              eq(benefitPlanTypesTable.planName, planName)
            )
          )
          .limit(1)
          .then((r) => r[0]);

        if (!existing) {
          const [plan] = await db
            .insert(benefitPlanTypesTable)
            .values({
              districtId: district.id,
              category: "health",
              planName,
              calculationMethod: "flat_dollar",
              isActive: true,
            })
            .returning();

          // Tiers: single → ee_only, family → family, interpolate for others
          const eeSpouse = healthSingle + (healthFamily - healthSingle) * 0.5;
          await db.insert(benefitPlanTiersTable).values([
            { benefitPlanTypeId: plan.id, tier: "ee_only", employerContributionAnnual: String(healthSingle) },
            { benefitPlanTypeId: plan.id, tier: "ee_spouse", employerContributionAnnual: eeSpouse.toFixed(2) },
            { benefitPlanTypeId: plan.id, tier: "ee_child", employerContributionAnnual: eeSpouse.toFixed(2) },
            { benefitPlanTypeId: plan.id, tier: "family", employerContributionAnnual: String(healthFamily) },
          ]);

          await db
            .insert(employeeGroupBenefitAssignmentsTable)
            .values({ employeeGroupId: group.id, benefitPlanTypeId: plan.id })
            .onConflictDoNothing();

          console.log(`    ✓ Created health plan: ${planName}`);
        }
      }

      // ── Dental plan ──────────────────────────────────────────────────────
      const dental = parseFloat(group.dentalAnnual);
      if (dental > 0) {
        const planName = `Dental Plan (${group.name})`;
        const existing = await db
          .select({ id: benefitPlanTypesTable.id })
          .from(benefitPlanTypesTable)
          .where(
            and(
              eq(benefitPlanTypesTable.districtId, district.id),
              eq(benefitPlanTypesTable.planName, planName)
            )
          )
          .limit(1)
          .then((r) => r[0]);

        if (!existing) {
          const [plan] = await db
            .insert(benefitPlanTypesTable)
            .values({
              districtId: district.id,
              category: "dental",
              planName,
              calculationMethod: "flat_dollar",
              isActive: true,
            })
            .returning();

          await db.insert(benefitPlanTiersTable).values(
            ["ee_only", "ee_spouse", "ee_child", "family"].map((tier) => ({
              benefitPlanTypeId: plan.id,
              tier,
              employerContributionAnnual: String(dental),
            }))
          );

          await db
            .insert(employeeGroupBenefitAssignmentsTable)
            .values({ employeeGroupId: group.id, benefitPlanTypeId: plan.id })
            .onConflictDoNothing();

          console.log(`    ✓ Created dental plan: ${planName}`);
        }
      }
    }
  }

  console.log("\nMigration complete.");
}

main().catch(console.error);
