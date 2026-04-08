import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

/**
 * One-time data patch: sync employee-level denormalized fields
 * (current_step, current_lane_id, current_annual_salary) from the
 * primary position for any employee whose values are out of sync.
 *
 * Root cause: "Add Employee" creates the row with $0/no step/no lane.
 * When a position is later added, the employee row was not updated.
 * This is now fixed in the positions API (POST + PUT), but historical
 * records need a one-time correction.
 *
 * Safe to re-run — it only updates employees where a mismatch exists.
 */

async function run() {
  console.log("Starting employee position sync patch...\n");

  const mismatches = await db.execute(sql`
    SELECT
      e.id AS employee_id,
      e.first_name,
      e.last_name,
      e.current_annual_salary AS emp_salary,
      e.current_step            AS emp_step,
      e.current_lane_id         AS emp_lane_id,
      p.current_annual_salary  AS pos_salary,
      p.current_step           AS pos_step,
      p.current_lane_id        AS pos_lane_id
    FROM employees e
    JOIN employee_positions p
      ON p.employee_id = e.id AND p.is_primary = true
    WHERE
      e.current_annual_salary::numeric != p.current_annual_salary::numeric
      OR (e.current_step IS DISTINCT FROM p.current_step)
      OR (e.current_lane_id IS DISTINCT FROM p.current_lane_id)
  `);

  const rows = mismatches.rows as Array<{
    employee_id: string;
    first_name: string;
    last_name: string;
    pos_salary: string;
    pos_step: number | null;
    pos_lane_id: string | null;
  }>;

  if (rows.length === 0) {
    console.log("No mismatches found — nothing to patch.");
    return;
  }

  console.log(`Found ${rows.length} employee(s) to patch:\n`);

  for (const row of rows) {
    console.log(
      `  Patching ${row.last_name}, ${row.first_name} (${row.employee_id})` +
        ` → step=${row.pos_step ?? "null"}, lane=${row.pos_lane_id ?? "null"}, salary=${row.pos_salary}`
    );

    await db
      .update(employeesTable)
      .set({
        currentStep: row.pos_step ?? null,
        currentLaneId: row.pos_lane_id ?? null,
        currentAnnualSalary: row.pos_salary ?? "0",
        updatedAt: new Date(),
      })
      .where(eq(employeesTable.id, row.employee_id));
  }

  console.log("\nPatch complete.");
}

run().catch((err) => {
  console.error("Patch failed:", err);
  process.exit(1);
});
