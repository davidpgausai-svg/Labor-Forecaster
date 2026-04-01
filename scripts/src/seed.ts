import { db, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  districtsTable,
  bargainingUnitsTable,
  salarySchedulesTable,
  lanesTable,
  stepsTable,
  scheduleCellsTable,
  hourlySchedulesTable,
  hourlyCategoriesTable,
  employeesTable,
  scenariosTable,
  scenarioYearConfigsTable,
} from "@workspace/db";
import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 28 });

const SEED_DISTRICT_NAME = "District 21";
const SALARY_LANE_NAMES = ["BA", "BA+15", "MA", "MA+15", "MA+30", "MA+45", "PhD"];
const SALARY_STEPS = 15;
const BASE_SALARY_BA_STEP1 = new Decimal("48000");
const LANE_MULTIPLIERS = ["1.0000", "1.0500", "1.1000", "1.1500", "1.2000", "1.2500", "1.3000"];
const STEP_INCREMENT = new Decimal("0.025");

async function seed() {
  console.log("🌱 Seeding CollBar database...");

  const existing = await db.select().from(districtsTable);
  if (existing.length > 0) {
    console.log("⚠️  District already exists — skipping seed. Delete existing data first to re-seed.");
    return;
  }

  const [district] = await db
    .insert(districtsTable)
    .values({
      name: SEED_DISTRICT_NAME,
      state: "IL",
      fiscalYearStart: "July 1",
      studentEnrollment: 3200,
    })
    .returning();
  console.log(`✅ District: ${district.name} (${district.id})`);

  const [licensedUnit] = await db
    .insert(bargainingUnitsTable)
    .values({
      districtId: district.id,
      name: "Licensed Staff",
      code: "LIC",
      compensationType: "salary",
      retirementSystem: "TRS",
      retirementEmployeeRate: "0.09",
      retirementEmployerRate: "0",
      retirementGrossUpRate: "0.008901",
      ficaRate: "0.0765",
      ficaExempt: true,
      healthInsuranceSingleAnnual: "9600",
      healthInsuranceFamilyAnnual: "21600",
      dentalAnnual: "480",
      lifeInsuranceAnnual: "0",
      disabilityInsuranceAnnual: "120",
      hsaContributionSingle: "600",
      hsaContributionFamily: "1200",
      workersCompRate: "0.0035",
      contractStartDate: "2025-08-01",
      contractEndDate: "2030-07-31",
      contractYears: 5,
      displayOrder: 0,
    })
    .returning();
  console.log(`✅ Bargaining unit: ${licensedUnit.name}`);

  const [espUnit] = await db
    .insert(bargainingUnitsTable)
    .values({
      districtId: district.id,
      name: "Educational Support Personnel",
      code: "ESP",
      compensationType: "hourly",
      retirementSystem: "IMRF",
      retirementEmployeeRate: "0.045",
      retirementEmployerRate: "0.145",
      retirementGrossUpRate: "0",
      ficaRate: "0.0765",
      ficaExempt: false,
      healthInsuranceSingleAnnual: "9600",
      healthInsuranceFamilyAnnual: "21600",
      dentalAnnual: "480",
      lifeInsuranceAnnual: "0",
      disabilityInsuranceAnnual: "120",
      hsaContributionSingle: "600",
      hsaContributionFamily: "1200",
      workersCompRate: "0.0060",
      contractStartDate: "2025-08-01",
      contractEndDate: "2030-07-31",
      contractYears: 5,
      displayOrder: 1,
    })
    .returning();
  console.log(`✅ Bargaining unit: ${espUnit.name}`);

  const [cmUnit] = await db
    .insert(bargainingUnitsTable)
    .values({
      districtId: district.id,
      name: "Custodial & Maintenance",
      code: "CM",
      compensationType: "hourly",
      retirementSystem: "IMRF",
      retirementEmployeeRate: "0.045",
      retirementEmployerRate: "0.145",
      retirementGrossUpRate: "0",
      ficaRate: "0.0765",
      ficaExempt: false,
      healthInsuranceSingleAnnual: "9600",
      healthInsuranceFamilyAnnual: "21600",
      dentalAnnual: "480",
      lifeInsuranceAnnual: "0",
      disabilityInsuranceAnnual: "120",
      hsaContributionSingle: "600",
      hsaContributionFamily: "1200",
      workersCompRate: "0.0085",
      contractStartDate: "2025-08-01",
      contractEndDate: "2030-07-31",
      contractYears: 5,
      displayOrder: 2,
    })
    .returning();
  console.log(`✅ Bargaining unit: ${cmUnit.name}`);

  const [licSchedule] = await db
    .insert(salarySchedulesTable)
    .values({
      bargainingUnitId: licensedUnit.id,
      name: "2025-2026 Salary Schedule",
      effectiveYear: 0,
      baseSalary: BASE_SALARY_BA_STEP1.toString(),
    })
    .returning();

  const laneIds: string[] = [];
  for (let l = 0; l < SALARY_LANE_NAMES.length; l++) {
    const [lane] = await db
      .insert(lanesTable)
      .values({
        salaryScheduleId: licSchedule.id,
        name: SALARY_LANE_NAMES[l],
        displayOrder: l,
        indexMultiplier: LANE_MULTIPLIERS[l],
      })
      .returning();
    laneIds.push(lane.id);
  }

  const stepIds: string[] = [];
  for (let s = 1; s <= SALARY_STEPS; s++) {
    const multiplier =
      s === 1 ? "1.0000" : new Decimal("1").plus(STEP_INCREMENT.times(s - 1)).toFixed(4);
    const [step] = await db
      .insert(stepsTable)
      .values({
        salaryScheduleId: licSchedule.id,
        stepNumber: s,
        incrementMultiplier: multiplier,
      })
      .returning();
    stepIds.push(step.id);
  }

  const cells: {
    salaryScheduleId: string;
    laneId: string;
    stepId: string;
    salaryAmount: string;
  }[] = [];

  for (let l = 0; l < SALARY_LANE_NAMES.length; l++) {
    for (let s = 0; s < SALARY_STEPS; s++) {
      const stepMultiplier = s === 0
        ? new Decimal("1")
        : new Decimal("1").plus(STEP_INCREMENT.times(s));
      const laneMultiplier = new Decimal(LANE_MULTIPLIERS[l]);
      const salary = BASE_SALARY_BA_STEP1.times(stepMultiplier)
        .times(laneMultiplier)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      cells.push({
        salaryScheduleId: licSchedule.id,
        laneId: laneIds[l],
        stepId: stepIds[s],
        salaryAmount: salary.toString(),
      });
    }
  }

  const chunkSize = 100;
  for (let i = 0; i < cells.length; i += chunkSize) {
    await db.insert(scheduleCellsTable).values(cells.slice(i, i + chunkSize));
  }
  console.log(`✅ Salary schedule: ${licSchedule.name} (${SALARY_LANE_NAMES.length} lanes × ${SALARY_STEPS} steps = ${cells.length} cells)`);

  const [espSchedule] = await db
    .insert(hourlySchedulesTable)
    .values({ bargainingUnitId: espUnit.id, effectiveYear: 0 })
    .returning();

  const espCategories = [
    { name: "Paraprofessional", baseHourlyRate: "18.50", annualHours: "1400" },
    { name: "Secretary / Clerk", baseHourlyRate: "19.25", annualHours: "1750" },
    { name: "Library Aide", baseHourlyRate: "17.75", annualHours: "1300" },
    { name: "Technology Aide", baseHourlyRate: "20.00", annualHours: "1750" },
    { name: "Lunch / Recess Aide", baseHourlyRate: "15.00", annualHours: "900" },
    { name: "Nurse / Health Aide", baseHourlyRate: "22.00", annualHours: "1750" },
  ];

  for (let i = 0; i < espCategories.length; i++) {
    await db.insert(hourlyCategoriesTable).values({
      hourlyScheduleId: espSchedule.id,
      name: espCategories[i].name,
      baseHourlyRate: espCategories[i].baseHourlyRate,
      annualHours: espCategories[i].annualHours,
      displayOrder: i,
    });
  }
  console.log(`✅ ESP hourly schedule (${espCategories.length} categories)`);

  const [cmSchedule] = await db
    .insert(hourlySchedulesTable)
    .values({ bargainingUnitId: cmUnit.id, effectiveYear: 0 })
    .returning();

  const cmCategories = [
    { name: "Custodian", baseHourlyRate: "21.00", annualHours: "2080" },
    { name: "Head Custodian", baseHourlyRate: "24.50", annualHours: "2080" },
    { name: "Maintenance Tech", baseHourlyRate: "27.00", annualHours: "2080" },
    { name: "Grounds", baseHourlyRate: "22.00", annualHours: "2080" },
  ];

  for (let i = 0; i < cmCategories.length; i++) {
    await db.insert(hourlyCategoriesTable).values({
      hourlyScheduleId: cmSchedule.id,
      name: cmCategories[i].name,
      baseHourlyRate: cmCategories[i].baseHourlyRate,
      annualHours: cmCategories[i].annualHours,
      displayOrder: i,
    });
  }
  console.log(`✅ CM hourly schedule (${cmCategories.length} categories)`);

  const LAST_NAMES = [
    "Anderson", "Baker", "Chen", "Davis", "Edwards", "Foster", "Garcia", "Harris",
    "Ingram", "Johnson", "Kim", "Lopez", "Martinez", "Nelson", "Olson", "Patel",
    "Quinn", "Rivera", "Smith", "Taylor", "Urwin", "Vasquez", "Walker", "Young", "Zhang",
  ];
  const FIRST_NAMES_F = [
    "Amanda", "Barbara", "Cynthia", "Diana", "Elizabeth", "Fiona", "Grace", "Hannah",
    "Irene", "Jennifer", "Karen", "Laura", "Maria", "Nancy", "Olivia", "Patricia",
  ];
  const FIRST_NAMES_M = [
    "Aaron", "Brian", "Carlos", "David", "Eric", "Frank", "George", "Henry",
    "Ivan", "James", "Kevin", "Liam", "Marcus", "Nathan", "Oscar", "Paul",
  ];

  const allFirstNames = [...FIRST_NAMES_F, ...FIRST_NAMES_M];

  let empIdx = 0;
  const licensedEmployees: typeof employeesTable.$inferInsert[] = [];

  const laneDistribution = [20, 15, 12, 8, 5, 3, 2];
  for (let l = 0; l < SALARY_LANE_NAMES.length; l++) {
    const count = laneDistribution[l];
    for (let e = 0; e < count; e++) {
      const step = Math.min(Math.ceil(Math.random() * 12) + 1, 15);
      const yearsInDistrict = step - 1 + Math.floor(Math.random() * 3);
      const stepMultiplier =
        step === 1
          ? new Decimal("1")
          : new Decimal("1").plus(STEP_INCREMENT.times(step - 1));
      const salary = BASE_SALARY_BA_STEP1.times(stepMultiplier)
        .times(new Decimal(LANE_MULTIPLIERS[l]))
        .toDecimalPlaces(2);

      const isHighEarner = salary.gte(125000);
      const retirementEligible = yearsInDistrict >= 10 && Math.random() > 0.7;

      const firstName = allFirstNames[empIdx % allFirstNames.length];
      const lastName = LAST_NAMES[empIdx % LAST_NAMES.length];
      const elections: Array<"single" | "family" | "waived"> = ["single", "family", "waived"];
      const election = elections[empIdx % elections.length];

      licensedEmployees.push({
        districtId: district.id,
        bargainingUnitId: licensedUnit.id,
        employeeNumber: `L${String(100 + empIdx).padStart(3, "0")}`,
        firstName,
        lastName,
        hireDate: `${2025 - yearsInDistrict}-08-01`,
        yearsInDistrict,
        yearsTotalService: yearsInDistrict + Math.floor(Math.random() * 5),
        compensationType: "salary",
        currentLaneId: laneIds[l],
        currentStep: step,
        currentAnnualSalary: salary.toString(),
        insuranceElection: election,
        retirementEligible,
        retirementPlan: retirementEligible ? "option1_4year" : "none",
        status: "active",
        contractYear: 0,
      });
      empIdx++;
    }
  }

  for (let i = 0; i < licensedEmployees.length; i += 50) {
    await db.insert(employeesTable).values(licensedEmployees.slice(i, i + 50));
  }
  console.log(`✅ Licensed employees: ${licensedEmployees.length}`);

  const espEmployees: typeof employeesTable.$inferInsert[] = [];
  const espCatList = await db
    .select()
    .from(hourlyCategoriesTable)
    .where(eq(hourlyCategoriesTable.hourlyScheduleId, espSchedule.id))
    .orderBy(hourlyCategoriesTable.displayOrder);

  for (let e = 0; e < 25; e++) {
    const cat = espCatList[e % espCatList.length];
    if (!cat) continue;
    const yearsInDistrict = Math.floor(Math.random() * 15) + 1;
    const hourlyRate = cat.baseHourlyRate;
    const annualSalary = new Decimal(hourlyRate).times(cat.annualHours).toDecimalPlaces(2);
    const firstName = allFirstNames[(empIdx + e) % allFirstNames.length];
    const lastName = LAST_NAMES[(empIdx + e) % LAST_NAMES.length];

    espEmployees.push({
      districtId: district.id,
      bargainingUnitId: espUnit.id,
      employeeNumber: `E${String(200 + e).padStart(3, "0")}`,
      firstName,
      lastName,
      hireDate: `${2025 - yearsInDistrict}-08-01`,
      yearsInDistrict,
      yearsTotalService: yearsInDistrict + Math.floor(Math.random() * 3),
      compensationType: "hourly",
      currentHourlyCategoryId: cat.id,
      currentHourlyRate: hourlyRate,
      annualHours: cat.annualHours,
      currentAnnualSalary: annualSalary.toString(),
      insuranceElection: e % 3 === 0 ? "family" : "single",
      retirementEligible: yearsInDistrict >= 10 && Math.random() > 0.7,
      retirementPlan: "none",
      status: "active",
      contractYear: 0,
    });
  }
  await db.insert(employeesTable).values(espEmployees);
  console.log(`✅ ESP employees: ${espEmployees.length}`);

  const cmCatRows = await db.select().from(hourlyCategoriesTable);
  const cmCatList = cmCatRows.filter((c) => c.hourlyScheduleId === cmSchedule.id);

  const cmEmployees: typeof employeesTable.$inferInsert[] = [];
  for (let e = 0; e < 15; e++) {
    const cat = cmCatList[e % cmCatList.length];
    if (!cat) continue;
    const yearsInDistrict = Math.floor(Math.random() * 20) + 1;
    const hourlyRate = cat.baseHourlyRate;
    const annualSalary = new Decimal(hourlyRate).times(cat.annualHours).toDecimalPlaces(2);
    const firstName = allFirstNames[(empIdx + 25 + e) % allFirstNames.length];
    const lastName = LAST_NAMES[(empIdx + 25 + e) % LAST_NAMES.length];

    cmEmployees.push({
      districtId: district.id,
      bargainingUnitId: cmUnit.id,
      employeeNumber: `C${String(300 + e).padStart(3, "0")}`,
      firstName,
      lastName,
      hireDate: `${2025 - yearsInDistrict}-08-01`,
      yearsInDistrict,
      yearsTotalService: yearsInDistrict + Math.floor(Math.random() * 5),
      compensationType: "hourly",
      currentHourlyCategoryId: cat.id,
      currentHourlyRate: hourlyRate,
      annualHours: cat.annualHours,
      currentAnnualSalary: annualSalary.toString(),
      insuranceElection: e % 3 === 0 ? "family" : "single",
      retirementEligible: yearsInDistrict >= 15 && Math.random() > 0.6,
      retirementPlan: "none",
      status: "active",
      contractYear: 0,
    });
  }
  await db.insert(employeesTable).values(cmEmployees);
  console.log(`✅ CM employees: ${cmEmployees.length}`);

  const scenarioDefs = [
    {
      name: "Board Proposal A",
      description:
        "Conservative: 3% fixed salary increase all years with high-earner $3,000 flat override",
      yearConfigs: [
        { contractYear: 0, yearLabel: "2025-2026", increaseType: "fixed_percentage" as const, fixedPercentage: "0", stepAdvancement: false },
        { contractYear: 1, yearLabel: "2026-2027", increaseType: "fixed_percentage" as const, fixedPercentage: "3.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
        { contractYear: 2, yearLabel: "2027-2028", increaseType: "fixed_percentage" as const, fixedPercentage: "3.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
        { contractYear: 3, yearLabel: "2028-2029", increaseType: "fixed_percentage" as const, fixedPercentage: "3.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
        { contractYear: 4, yearLabel: "2029-2030", increaseType: "fixed_percentage" as const, fixedPercentage: "3.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
      ],
    },
    {
      name: "Union Counter-Proposal",
      description:
        "CPI-linked with 0.5% adder, floored at 2%, capped at 5%. High earner $3,000 flat.",
      yearConfigs: [
        { contractYear: 0, yearLabel: "2025-2026", increaseType: "fixed_percentage" as const, fixedPercentage: "0", stepAdvancement: false },
        { contractYear: 1, yearLabel: "2026-2027", increaseType: "cpi_formula" as const, cpiValue: "3.2", cpiAdder: "0.5", cpiCap: "5.0", cpiFloor: "2.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
        { contractYear: 2, yearLabel: "2027-2028", increaseType: "cpi_formula" as const, cpiValue: "2.8", cpiAdder: "0.5", cpiCap: "5.0", cpiFloor: "2.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
        { contractYear: 3, yearLabel: "2028-2029", increaseType: "cpi_formula" as const, cpiValue: "2.5", cpiAdder: "0.5", cpiCap: "5.0", cpiFloor: "2.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
        { contractYear: 4, yearLabel: "2029-2030", increaseType: "cpi_formula" as const, cpiValue: "2.3", cpiAdder: "0.5", cpiCap: "5.0", cpiFloor: "2.0", stepAdvancement: true, highEarnerThreshold: "125000", highEarnerFlatIncrease: "3000" },
      ],
    },
    {
      name: "Conservative Baseline",
      description:
        "No base salary increase. Step movement only. Freeze base in all years.",
      yearConfigs: [
        { contractYear: 0, yearLabel: "2025-2026", increaseType: "step_only" as const, stepAdvancement: false },
        { contractYear: 1, yearLabel: "2026-2027", increaseType: "step_only" as const, stepAdvancement: true },
        { contractYear: 2, yearLabel: "2027-2028", increaseType: "step_only" as const, stepAdvancement: true },
        { contractYear: 3, yearLabel: "2028-2029", increaseType: "step_only" as const, stepAdvancement: true },
        { contractYear: 4, yearLabel: "2029-2030", increaseType: "step_only" as const, stepAdvancement: true },
      ],
    },
  ];

  const seededScenarioIds: string[] = [];

  for (const scenarioDef of scenarioDefs) {
    const [scenario] = await db
      .insert(scenariosTable)
      .values({
        districtId: district.id,
        name: scenarioDef.name,
        description: scenarioDef.description,
        status: "draft",
        isFinal: false,
      })
      .returning();

    const yearConfigInserts = [];
    for (const yc of scenarioDef.yearConfigs) {
      for (const unit of [licensedUnit, espUnit, cmUnit]) {
        yearConfigInserts.push({
          scenarioId: scenario.id,
          bargainingUnitId: unit.id,
          contractYear: yc.contractYear,
          yearLabel: yc.yearLabel,
          increaseType: yc.increaseType,
          fixedPercentage: "fixedPercentage" in yc ? yc.fixedPercentage : null,
          cpiValue: "cpiValue" in yc ? yc.cpiValue : null,
          cpiAdder: "cpiAdder" in yc ? yc.cpiAdder : null,
          cpiCap: "cpiCap" in yc ? yc.cpiCap : null,
          cpiFloor: "cpiFloor" in yc ? yc.cpiFloor : null,
          highEarnerThreshold: "highEarnerThreshold" in yc ? yc.highEarnerThreshold : null,
          highEarnerFlatIncrease: "highEarnerFlatIncrease" in yc ? yc.highEarnerFlatIncrease : null,
          stepAdvancement: yc.stepAdvancement,
          healthPremiumIncreaseRate: "5.0",
          healthEmployerCapRate: "8.0",
        });
      }
    }

    await db.insert(scenarioYearConfigsTable).values(yearConfigInserts);
    seededScenarioIds.push(scenario.id);
    console.log(`✅ Scenario: ${scenario.name}`);
  }

  console.log("\n⚡ Pre-computing scenario projections...");
  const API_BASE = `http://localhost:${process.env.PORT ?? 8080}/api`;

  let allCalculated = true;
  for (const scenarioId of seededScenarioIds) {
    try {
      const resp = await fetch(`${API_BASE}/scenarios/${scenarioId}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (resp.ok) {
        const result = await resp.json() as { scenarioName: string; employeeCount: number; totalFiveYearCost: string };
        console.log(`   ✅ Calculated: ${result.scenarioName} — ${result.employeeCount} employees, $${parseFloat(result.totalFiveYearCost).toLocaleString()} 5-yr cost`);
      } else {
        const err = await resp.text();
        console.warn(`   ⚠️  Calculation failed for ${scenarioId}: ${resp.status} ${err}`);
        allCalculated = false;
      }
    } catch (e) {
      console.warn(`   ⚠️  Could not reach API server for ${scenarioId}: ${e}`);
      allCalculated = false;
    }
  }

  if (!allCalculated) {
    console.log("\n   Note: Run POST /api/scenarios/:id/calculate for each scenario manually if server was not available.");
  }

  console.log("\n🎉 Seed complete! District 21 is ready.");
  console.log(`   District ID: ${district.id}`);
}

seed()
  .catch(console.error)
  .finally(() => pool.end());
