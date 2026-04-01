import { db, pool } from "@workspace/db";
import { runScenarioCalculation } from "@workspace/calc-engine";
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

// 7-lane salary schedule: realistic IL suburban district
// BA step 1 = $55,000 base. Each step adds $1,950. PhD lane = +$19,500 premium.
// PhD step 15 = ($55,000 + 14 × $1,950) + $19,500 = $55,000 + $27,300 + $19,500 = $101,800
// High-earners (above $125K) are 4 explicitly placed veteran teachers with career-accumulated salaries.

const SALARY_LANE_NAMES = ["BA", "BA+15", "MA", "MA+15", "MA+30", "MA+45", "PhD"];
const SALARY_STEPS = 15;
const STEP_DOLLARS = new Decimal("1950");  // per-step dollar increment
const LANE_PREMIUMS = [
  "0",      // BA
  "3900",   // BA+15
  "7800",   // MA
  "11700",  // MA+15
  "15600",  // MA+30
  "17550",  // MA+45
  "19500",  // PhD
];
const BASE_SALARY_BA_STEP1 = new Decimal("48000");

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
      studentEnrollment: 3300,
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

  // --- Salary Schedule ---
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
        indexMultiplier: "1.0000",
      })
      .returning();
    laneIds.push(lane.id);
  }

  const stepIds: string[] = [];
  for (let s = 1; s <= SALARY_STEPS; s++) {
    const [step] = await db
      .insert(stepsTable)
      .values({
        salaryScheduleId: licSchedule.id,
        stepNumber: s,
        incrementMultiplier: "1.0000",
      })
      .returning();
    stepIds.push(step.id);
  }

  // Build salary cells using absolute dollar amounts: base + (step-1)*stepDollars + lanePremium
  const cells: {
    salaryScheduleId: string;
    laneId: string;
    stepId: string;
    salaryAmount: string;
  }[] = [];

  for (let l = 0; l < SALARY_LANE_NAMES.length; l++) {
    const lanePremium = new Decimal(LANE_PREMIUMS[l]);
    for (let s = 0; s < SALARY_STEPS; s++) {
      const stepAdder = STEP_DOLLARS.times(s);
      const salary = BASE_SALARY_BA_STEP1.plus(stepAdder).plus(lanePremium);
      cells.push({
        salaryScheduleId: licSchedule.id,
        laneId: laneIds[l],
        stepId: stepIds[s],
        salaryAmount: salary.toDecimalPlaces(2).toString(),
      });
    }
  }

  const chunkSize = 100;
  for (let i = 0; i < cells.length; i += chunkSize) {
    await db.insert(scheduleCellsTable).values(cells.slice(i, i + chunkSize));
  }
  console.log(`✅ Salary schedule: ${licSchedule.name} (${SALARY_LANE_NAMES.length} lanes × ${SALARY_STEPS} steps = ${cells.length} cells)`);
  // Grid range: BA step 1 = $55,000, PhD step 15 = $101,800

  // --- ESP Schedule ---
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

  // --- CM Schedule ---
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

  // --- Licensed Employees: 65 total ---
  // Distributions (DETERMINISTIC, not random):
  //   Insurance: 60% family (39 employees), 25% single (16), 15% waived (10)
  //   Retirement-eligible: exactly 10 employees
  //   High earners (>$125K): 4 explicitly placed veteran teachers
  //
  // Placement: 4 high-earner veterans at PhD step 15 with above-schedule salaries.
  // The remaining 61 employees fill lanes BA through MA+45 with defined step placements.

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

  // Insurance assignments: 39 family, 16 single, 10 waived (total 65)
  const insurancePool: Array<"family" | "single" | "waived"> = [
    ...Array(39).fill("family"),
    ...Array(16).fill("single"),
    ...Array(10).fill("waived"),
  ];

  // Retirement-eligible: employee indices 0,1,2,3,4,5,6,7,8,9 (first 10 high-tenure employees)
  const RETIREMENT_ELIGIBLE_INDICES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  const licensedEmployees: typeof employeesTable.$inferInsert[] = [];
  let licEmpIdx = 0;

  // 4 above-schedule veteran teachers (high earners): PhD step 15, manually set salary
  const HIGH_EARNER_VETERANS = [
    { firstName: "Susan",   lastName: "Mitchell",  salary: "130450", yearsInDistrict: 28, yearsTotal: 31 },
    { firstName: "Robert",  lastName: "Thornton",  salary: "127800", yearsInDistrict: 25, yearsTotal: 29 },
    { firstName: "Patricia",lastName: "Alvarez",   salary: "135200", yearsInDistrict: 30, yearsTotal: 33 },
    { firstName: "Gerald",  lastName: "Whitmore",  salary: "126500", yearsInDistrict: 23, yearsTotal: 26 },
  ];

  const phdLaneIndex = SALARY_LANE_NAMES.indexOf("PhD");
  const step15Index = 14; // 0-based index for step 15

  for (const v of HIGH_EARNER_VETERANS) {
    const isRetirementEligible = RETIREMENT_ELIGIBLE_INDICES.has(licEmpIdx);
    const insurance = insurancePool[licEmpIdx];
    licensedEmployees.push({
      districtId: district.id,
      bargainingUnitId: licensedUnit.id,
      employeeNumber: `L${String(100 + licEmpIdx).padStart(3, "0")}`,
      firstName: v.firstName,
      lastName: v.lastName,
      hireDate: `${2025 - v.yearsInDistrict}-08-01`,
      yearsInDistrict: v.yearsInDistrict,
      yearsTotalService: v.yearsTotal,
      compensationType: "salary",
      currentLaneId: laneIds[phdLaneIndex],
      currentStep: 15,
      currentAnnualSalary: v.salary,
      insuranceElection: insurance,
      retirementEligible: isRetirementEligible,
      retirementPlan: isRetirementEligible ? "option1_4year" : "none",
      status: "active",
      contractYear: 0,
    });
    licEmpIdx++;
  }

  // Remaining 61 licensed employees distributed across lanes BA through MA+45
  // Lane distribution: BA=19, BA+15=14, MA=12, MA+15=8, MA+30=5, MA+45=3 (total 61)
  const laneDistribution = [19, 14, 12, 8, 5, 3];
  // Step distributions per lane: mix of early, mid, and experienced teachers
  // Deterministic step assignments cycling through a realistic pattern
  const STEP_PATTERN = [3, 7, 10, 5, 12, 2, 9, 14, 6, 11, 4, 8, 13, 1, 15];

  for (let l = 0; l < laneDistribution.length; l++) {
    const count = laneDistribution[l];
    for (let e = 0; e < count; e++) {
      const step = STEP_PATTERN[(licEmpIdx - 4) % STEP_PATTERN.length] ?? 8;
      const insurance = insurancePool[licEmpIdx];
      const isRetirementEligible = RETIREMENT_ELIGIBLE_INDICES.has(licEmpIdx);
      const yearsInDistrict = step - 1 + (e % 3);
      const yearsTotal = yearsInDistrict + (e % 5);

      // Compute grid salary for this lane + step
      const lanePremium = new Decimal(LANE_PREMIUMS[l]);
      const stepAdder = STEP_DOLLARS.times(step - 1);
      const salary = BASE_SALARY_BA_STEP1.plus(stepAdder).plus(lanePremium);

      const firstName = allFirstNames[licEmpIdx % allFirstNames.length];
      const lastName = LAST_NAMES[licEmpIdx % LAST_NAMES.length];

      licensedEmployees.push({
        districtId: district.id,
        bargainingUnitId: licensedUnit.id,
        employeeNumber: `L${String(100 + licEmpIdx).padStart(3, "0")}`,
        firstName,
        lastName,
        hireDate: `${2025 - yearsInDistrict}-08-01`,
        yearsInDistrict,
        yearsTotalService: yearsTotal,
        compensationType: "salary",
        currentLaneId: laneIds[l],
        currentStep: step,
        currentAnnualSalary: salary.toDecimalPlaces(2).toString(),
        insuranceElection: insurance,
        retirementEligible: isRetirementEligible,
        retirementPlan: isRetirementEligible ? "option1_4year" : "none",
        status: "active",
        contractYear: 0,
      });
      licEmpIdx++;
    }
  }

  for (let i = 0; i < licensedEmployees.length; i += 50) {
    await db.insert(employeesTable).values(licensedEmployees.slice(i, i + 50));
  }

  // Verify distributions
  const highEarners = licensedEmployees.filter((e) => parseFloat(e.currentAnnualSalary ?? "0") >= 125000);
  const retirementEligibleCount = licensedEmployees.filter((e) => e.retirementEligible).length;
  const familyCount = licensedEmployees.filter((e) => e.insuranceElection === "family").length;
  const singleCount = licensedEmployees.filter((e) => e.insuranceElection === "single").length;
  const waivedCount = licensedEmployees.filter((e) => e.insuranceElection === "waived").length;
  console.log(`✅ Licensed employees: ${licensedEmployees.length}`);
  console.log(`   High earners (≥$125K): ${highEarners.length} [spec: 3-5]`);
  console.log(`   Retirement-eligible: ${retirementEligibleCount} [spec: 8-12]`);
  console.log(`   Insurance — family: ${familyCount} (${Math.round(familyCount/licensedEmployees.length*100)}%), single: ${singleCount} (${Math.round(singleCount/licensedEmployees.length*100)}%), waived: ${waivedCount} (${Math.round(waivedCount/licensedEmployees.length*100)}%)`);

  // --- ESP Employees: 25 ---
  const espCatList = await db
    .select()
    .from(hourlyCategoriesTable)
    .where(eq(hourlyCategoriesTable.hourlyScheduleId, espSchedule.id))
    .orderBy(hourlyCategoriesTable.displayOrder);

  // ESP insurance: 60% family (15), 25% single (6), 15% waived (4)
  const espInsurancePool: Array<"family" | "single" | "waived"> = [
    ...Array(15).fill("family"),
    ...Array(6).fill("single"),
    ...Array(4).fill("waived"),
  ];

  const espEmployees: typeof employeesTable.$inferInsert[] = [];
  for (let e = 0; e < 25; e++) {
    const cat = espCatList[e % espCatList.length];
    if (!cat) continue;
    // Deterministic years: cycle through 2..18
    const yearsInDistrict = 2 + (e * 7 % 17);
    const hourlyRate = cat.baseHourlyRate;
    const annualSalary = new Decimal(hourlyRate).times(cat.annualHours).toDecimalPlaces(2);
    const firstName = allFirstNames[(licEmpIdx + e) % allFirstNames.length];
    const lastName = LAST_NAMES[(licEmpIdx + e) % LAST_NAMES.length];
    const insurance = espInsurancePool[e];

    espEmployees.push({
      districtId: district.id,
      bargainingUnitId: espUnit.id,
      employeeNumber: `E${String(200 + e).padStart(3, "0")}`,
      firstName,
      lastName,
      hireDate: `${2025 - yearsInDistrict}-08-01`,
      yearsInDistrict,
      yearsTotalService: yearsInDistrict + (e % 3),
      compensationType: "hourly",
      currentHourlyCategoryId: cat.id,
      currentHourlyRate: hourlyRate,
      annualHours: cat.annualHours,
      currentAnnualSalary: annualSalary.toString(),
      insuranceElection: insurance,
      retirementEligible: yearsInDistrict >= 12,
      retirementPlan: "none",
      status: "active",
      contractYear: 0,
    });
  }
  await db.insert(employeesTable).values(espEmployees);
  console.log(`✅ ESP employees: ${espEmployees.length}`);

  // --- CM Employees: 15 ---
  const cmCatRows = await db.select().from(hourlyCategoriesTable);
  const cmCatList = cmCatRows.filter((c) => c.hourlyScheduleId === cmSchedule.id);

  // CM insurance: 60% family (9), 25% single (4), 15% waived (2)
  const cmInsurancePool: Array<"family" | "single" | "waived"> = [
    ...Array(9).fill("family"),
    ...Array(4).fill("single"),
    ...Array(2).fill("waived"),
  ];

  const cmEmployees: typeof employeesTable.$inferInsert[] = [];
  for (let e = 0; e < 15; e++) {
    const cat = cmCatList[e % cmCatList.length];
    if (!cat) continue;
    const yearsInDistrict = 3 + (e * 11 % 20);
    const hourlyRate = cat.baseHourlyRate;
    const annualSalary = new Decimal(hourlyRate).times(cat.annualHours).toDecimalPlaces(2);
    const firstName = allFirstNames[(licEmpIdx + 25 + e) % allFirstNames.length];
    const lastName = LAST_NAMES[(licEmpIdx + 25 + e) % LAST_NAMES.length];
    const insurance = cmInsurancePool[e];

    cmEmployees.push({
      districtId: district.id,
      bargainingUnitId: cmUnit.id,
      employeeNumber: `C${String(300 + e).padStart(3, "0")}`,
      firstName,
      lastName,
      hireDate: `${2025 - yearsInDistrict}-08-01`,
      yearsInDistrict,
      yearsTotalService: yearsInDistrict + (e % 5),
      compensationType: "hourly",
      currentHourlyCategoryId: cat.id,
      currentHourlyRate: hourlyRate,
      annualHours: cat.annualHours,
      currentAnnualSalary: annualSalary.toString(),
      insuranceElection: insurance,
      retirementEligible: yearsInDistrict >= 15,
      retirementPlan: "none",
      status: "active",
      contractYear: 0,
    });
  }
  await db.insert(employeesTable).values(cmEmployees);
  console.log(`✅ CM employees: ${cmEmployees.length}`);

  // --- Scenarios ---
  const scenarioDefs = [
    {
      name: "Board Proposal A",
      description: "Conservative: 3% fixed salary increase all years with high-earner $3,000 flat override",
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
      description: "CPI-linked with 0.5% adder, floored at 2%, capped at 5%. High earner $3,000 flat.",
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
      description: "No base salary increase. Step movement only. Freeze base in all years.",
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

  for (const scenarioId of seededScenarioIds) {
    const result = await runScenarioCalculation(scenarioId);
    if (!result) throw new Error(`Calculation returned null for scenario ${scenarioId}`);
    console.log(`   ✅ Calculated: ${result.scenarioName} — ${result.employeeCount} employees, $${parseFloat(result.totalFiveYearCost).toLocaleString()} 5-yr cost`);
  }

  console.log("\n🎉 Seed complete! District 21 is ready.");
  console.log(`   District ID: ${district.id}`);
}

seed()
  .catch(console.error)
  .finally(() => pool.end());
