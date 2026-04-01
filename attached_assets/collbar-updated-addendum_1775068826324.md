# CollBar — Updated Addendum: Flexible Employee Groups & Compensation Schedules
## Replaces the original columbia-addendum.md — Feed this to Replit Agent

This addendum modifies the CollBar architecture to support the real-world complexity of a school district like Columbia Public Schools, which has ~20 distinct employee groups, each with 1 to N compensation schedules of varying types (salary, hourly, per-diem, stipend). The core change is replacing the rigid "bargaining unit → one schedule" model with a flexible "employee group → many compensation schedules" model configurable in Settings.

---

## THE CORE ARCHITECTURE CHANGE

### Current Model (Too Rigid)
```
bargaining_unit → 1 salary_schedule (or 1 hourly_schedule)
```

### New Model (Flexible)
```
employee_group → N compensation_schedules
  where each schedule can be: salary_grid, hourly, per_diem, stipend_table, flat_rate
```

A single employee group (e.g., "Teachers") may have:
- A salary grid schedule (the main step-and-lane matrix)
- A per-diem rate schedule (for extra day assignments)
- A stipend schedule (coaching, department chair, etc.)

A different employee group (e.g., "Custodial") may have:
- An hourly rate schedule
- An overtime rate definition

Another group (e.g., "Principals — Elementary") may have:
- A flat salary range schedule (no step/lane, just min/mid/max by position)

The system must handle ALL of these through the same flexible architecture.

---

## REAL-WORLD EXAMPLE: COLUMBIA PUBLIC SCHOOLS

Columbia has the following employee groups, each with their own compensation structures:

```
EMPLOYEE GROUPS & SCHEDULES
│
├── Teachers (187-day contract)
│   ├── Annual Salary Schedule (index-based, 3 lanes × 30 steps, base $44,200)
│   ├── Daily Rate Schedule (for extra day assignments post-07/01/2010)
│   └── Stipend Schedule (coaching, mentoring, department chair, clubs)
│
├── Principals — Elementary
│   └── Salary Schedule (position-based, may have steps or ranges)
│
├── Principals — Middle School
│   └── Salary Schedule
│
├── Principals — High School
│   └── Salary Schedule
│
├── Principals — Specific Schools (Lange, etc.)
│   └── Salary Schedule
│
├── Coordinators
│   └── Salary Schedule (2026 Coord Schedule)
│
├── Custodial Staff
│   └── Hourly Schedule (2026 Custodial)
│
├── Health Services Coordinators
│   └── Salary Schedule (2026 HSC)
│
├── Hourly Staff (incl. Food/Child Services)
│   └── Hourly Schedule (2026 Hourly incl FCS)
│
├── Mentors & Coaches
│   └── Stipend/Compensation Schedule
│
├── Classroom Leaders & Instructional Aides/LPNs
│   └── Salary/Hourly Schedule (2026 CL and IA-LPN)
│
├── Nurses
│   └── Salary Schedule (2026 Nurses)
│
├── Nutrition Services
│   └── Hourly Schedule (2026 Nutr Svcs)
│
├── Occupational/Physical Therapists
│   └── Salary Schedule (2026 OTPT)
│
├── Outreach Social Workers / Counselors
│   └── Salary Schedule (2026 Outreach SWorker)
│
├── Paraprofessionals
│   └── Hourly/Salary Schedule (2026 Para)
│
├── Parent Educators (PAT Program)
│   └── Salary Schedule (2026 PAT)
│
├── Psychologists
│   └── Salary Schedule (2026 Psych)
│
├── Special Services / SPED Process Coordinators
│   └── Salary Schedule (2026 SPED Process Coord)
│
├── Support Staff
│   └── Various schedules (from payfile export)
│
└── Technology Services
    └── Hourly Schedule (2026 Tech Svcs Hrly)
```

That's approximately 20 employee groups with 25+ distinct compensation schedules across the district. The system must handle this without requiring code changes — purely through Settings configuration.

---

## DATABASE SCHEMA CHANGES

### Replace `bargaining_units` with `employee_groups`

The existing `bargaining_units` table becomes `employee_groups` with expanded flexibility:

```sql
employee_groups
- id (uuid, primary key)
- district_id (uuid, FK → districts)
- name (string) — e.g., "Teachers", "Principals - Elementary", "Custodial Staff"
- code (string) — short identifier, e.g., "teachers", "prin_elem", "custodial"
- display_order (integer) — for UI ordering
- contract_days (integer, nullable) — e.g., 187 for teachers, 220 for principals, 260 for custodial
- bargaining_unit_name (string, nullable) — the union/association name if applicable
- is_unionized (boolean, default true)
- contract_start_date (date, nullable)
- contract_end_date (date, nullable)
- contract_years (integer, default 5)
- retirement_system (enum: "TRS" | "IMRF" | "PSRS" | "other")
- retirement_employee_rate (decimal)
- retirement_employer_rate (decimal)
- retirement_gross_up_rate (decimal)
- fica_rate (decimal, default 0.0765)
- fica_exempt (boolean) — TRS members may be SS-exempt
- health_insurance_single_annual (decimal)
- health_insurance_family_annual (decimal)
- health_insurance_employer_cap_rate (decimal, nullable) — e.g., 0.08 for 8% cap
- dental_annual (decimal)
- life_insurance_annual (decimal)
- disability_insurance_annual (decimal)
- hsa_contribution_single (decimal)
- hsa_contribution_family (decimal)
- workers_comp_rate (decimal)
- notes (text, nullable)
- active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
```

### New: `compensation_schedules` Table

This is the bridge table that connects employee groups to their schedule definitions:

```sql
compensation_schedules
- id (uuid, primary key)
- employee_group_id (uuid, FK → employee_groups)
- name (string) — e.g., "2025-26 Teacher Salary Schedule", "Extra Day Rate", "Coaching Stipends"
- schedule_type (enum: see below)
- is_primary (boolean) — is this the main compensation schedule for the group?
- display_order (integer)
- description (text, nullable)
- effective_date (date, nullable)
- effective_date_rule (string, nullable) — e.g., "For assignments made after 07/01/2010"
- active (boolean, default true)
- created_at (timestamp)
- updated_at (timestamp)
```

### Schedule Type Enum

```
compensation_schedule_type:
  "index_based_grid"    — Base anchor × index multipliers (Columbia teacher model)
  "individual_salary"   — Each employee has their own salary, increases applied individually (D21 model)
  "direct_import_grid"  — Pasted/uploaded matrix with no formula
  "hourly"              — Hourly rate × annual hours
  "per_diem"            — Daily rate, derived from annual or independently set
  "flat_rate"           — Single rate per position (e.g., principals with salary ranges)
  "stipend_table"       — Table of named stipends with amounts
  "range_based"         — Min/mid/max salary range per position level
```

### Index-Based Grid Configuration

When `schedule_type = "index_based_grid"`, configure via:

```sql
index_grid_config
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- base_anchor_salary (decimal) — e.g., $44,200
- max_steps (integer) — e.g., 30
- created_at (timestamp)
```

The existing `lanes`, `steps`, and `schedule_cells` tables link to the `compensation_schedule_id` instead of `salary_schedule_id`. Add:

```sql
schedule_indices
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- lane_id (uuid, FK → lanes)
- step_number (integer)
- index_value (decimal, 4 decimal places)
- is_capped (boolean)
```

### Per-Diem Configuration

When `schedule_type = "per_diem"`:

```sql
per_diem_config
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- source_schedule_id (uuid, FK → compensation_schedules, nullable) — if derived from a salary grid
- contract_days (integer) — the divisor (e.g., 187)
- derivation_method (enum: "from_salary_schedule" | "independent")
```

```sql
per_diem_caps
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- lane_id (uuid, FK → lanes)
- cap_step (integer)
- cap_rate_cents (bigint) — stored as cents for precision
```

### Stipend Table Configuration

When `schedule_type = "stipend_table"`:

```sql
stipend_definitions
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- name (string) — e.g., "Head Football Coach", "Department Chair"
- category (string) — e.g., "Athletics", "Academic", "Leadership"
- amount_type (enum: "fixed_dollar" | "percentage_of_base" | "hourly" | "per_event" | "daily_rate")
- amount_cents (bigint) — the dollar amount in cents, or percentage × 10000 for percentages
- percentage_value (decimal, nullable) — if amount_type is percentage_of_base
- max_amount_cents (bigint, nullable)
- increase_with_base (boolean, default false) — does this scale when base salary changes?
- trs_creditable (boolean, default false)
- imrf_creditable (boolean, default false)
- display_order (integer)
- active (boolean, default true)
```

```sql
employee_stipends
- id (uuid, primary key)
- employee_id (uuid, FK → employees)
- stipend_definition_id (uuid, FK → stipend_definitions)
- effective_year (integer) — contract year 0-4
- override_amount_cents (bigint, nullable) — if different from standard
- notes (text, nullable)
```

### Hourly Schedule Configuration

When `schedule_type = "hourly"`:

```sql
hourly_config
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
```

The existing `hourly_categories` table links to `compensation_schedule_id`:

```sql
hourly_categories
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- name (string)
- base_hourly_rate_cents (bigint)
- annual_hours (decimal)
- overtime_eligible (boolean, default true)
- overtime_multiplier (decimal, default 1.5)
- display_order (integer)
```

### Range-Based Configuration

When `schedule_type = "range_based"` (for principals, coordinators, etc.):

```sql
salary_ranges
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- position_title (string) — e.g., "Elementary Principal", "Middle School Principal"
- min_salary_cents (bigint)
- mid_salary_cents (bigint)
- max_salary_cents (bigint)
- display_order (integer)
```

### Flat Rate Configuration

When `schedule_type = "flat_rate"`:

```sql
flat_rates
- id (uuid, primary key)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- position_title (string)
- annual_amount_cents (bigint)
- display_order (integer)
```

---

## EMPLOYEE TABLE CHANGES

The `employees` table needs to reference an `employee_group_id` instead of (or in addition to) `bargaining_unit_id`:

```sql
employees (updated fields)
- employee_group_id (uuid, FK → employee_groups) — replaces bargaining_unit_id
- primary_schedule_id (uuid, FK → compensation_schedules) — which schedule determines their base pay
- current_lane_id (uuid, FK → lanes, nullable) — for grid-based schedules
- current_step (integer, nullable) — for grid-based schedules
- current_hourly_category_id (uuid, FK → hourly_categories, nullable)
- current_hourly_rate_cents (bigint, nullable)
- current_annual_salary_cents (bigint)
- current_daily_rate_cents (bigint, nullable) — for per-diem
- salary_range_id (uuid, FK → salary_ranges, nullable) — for range-based
```

Each employee is assigned to exactly one employee group and has one primary compensation schedule that determines their base pay. They may also be linked to additional schedules (per-diem, stipends) through the `employee_stipends` table and automatic per-diem derivation.

---

## SETTINGS UI: EMPLOYEE GROUPS & SCHEDULES

### Settings Page Layout

```
SETTINGS
├── District Information
│   └── Name, State, Fiscal Year, Enrollment (for cost-per-pupil)
│
├── Employee Groups                          ← NEW SECTION
│   ├── [+ Add Employee Group]
│   │
│   ├── Teachers (187 days, TRS, Unionized)
│   │   ├── Compensation Schedules
│   │   │   ├── ★ Annual Salary Schedule (index-based grid) [Primary]
│   │   │   ├── Extra Day Rate (per-diem, derived from salary)
│   │   │   └── [+ Add Schedule]
│   │   ├── Benefits Configuration
│   │   │   └── TRS 9%, Medicare 1.45%, Health, Dental, etc.
│   │   └── Contract Terms
│   │       └── Start: 08/2025, End: 07/2030, 5 years
│   │
│   ├── Principals — Elementary (220 days, TRS)
│   │   ├── Compensation Schedules
│   │   │   ├── ★ Salary Schedule (range-based) [Primary]
│   │   │   └── [+ Add Schedule]
│   │   └── Benefits Configuration
│   │
│   ├── Custodial Staff (260 days, IMRF)
│   │   ├── Compensation Schedules
│   │   │   ├── ★ Hourly Schedule [Primary]
│   │   │   └── [+ Add Schedule]
│   │   └── Benefits Configuration
│   │
│   ├── Paraprofessionals (180 days, IMRF)
│   │   ├── Compensation Schedules
│   │   │   ├── ★ Hourly Schedule [Primary]
│   │   │   └── [+ Add Schedule]
│   │   └── Benefits Configuration
│   │
│   ├── Nutrition Services (variable days, IMRF)
│   │   └── ...
│   │
│   └── [+ Add Employee Group]
│
├── Supplemental Pay
│   ├── Longevity Tiers
│   ├── Insurance Opt-Out Rates
│   └── Bonus Programs
│
└── System
    └── Authentication, Backup, etc.
```

### Add Employee Group Flow

When the user clicks [+ Add Employee Group]:

```
STEP 1: Group Basics
┌────────────────────────────────────────────────────┐
│ Group Name: [_________________________]            │
│ Short Code: [________]                             │
│ Contract Days: [187]                               │
│ Unionized: [Yes ▼]                                 │
│ Bargaining Unit Name: [________________________]   │
│ Contract Period: [08/2025] to [07/2030]            │
└────────────────────────────────────────────────────┘

STEP 2: Retirement & Tax Configuration
┌────────────────────────────────────────────────────┐
│ Retirement System: [TRS ▼]                         │
│ Employee Rate: [9.0]%                              │
│ Employer Rate: [___]%                              │
│ Gross-Up Rate: [0.8901]%                           │
│                                                    │
│ FICA Configuration:                                │
│   ○ Full FICA (7.65% — SS + Medicare)              │
│   ○ Medicare Only (1.45% — TRS exempt from SS)     │
│   ○ Fully Exempt                                   │
└────────────────────────────────────────────────────┘

STEP 3: Benefits Configuration
┌────────────────────────────────────────────────────┐
│ Health Insurance (Annual Employer Cost):           │
│   Single: [$8,400]  Family: [$22,000]              │
│   Premium Increase Cap: [8]% per year              │
│                                                    │
│ HSA Contribution:                                  │
│   Single: [$600]  Family: [$1,200]                 │
│                                                    │
│ Dental: [$____] (employer-paid / employee-paid)    │
│ Life Insurance: [Employer-paid, = annual salary]   │
│ Disability: [$____]                                │
│ Workers Comp Rate: [____]%                         │
└────────────────────────────────────────────────────┘

STEP 4: Add Compensation Schedules
┌────────────────────────────────────────────────────┐
│ This group needs at least one compensation         │
│ schedule. Select a type to get started:            │
│                                                    │
│ [+ Index-Based Salary Grid]                        │
│   Base anchor × index. Best for teacher schedules. │
│                                                    │
│ [+ Direct Import Grid]                             │
│   Upload or paste a salary matrix as-is.           │
│                                                    │
│ [+ Individual Salary + Formula]                    │
│   Per-employee salary with CPI/% increases.        │
│                                                    │
│ [+ Hourly Rate Schedule]                           │
│   Categories with hourly rates and annual hours.   │
│                                                    │
│ [+ Per-Diem Rate Schedule]                         │
│   Daily rates, derived from salary or independent. │
│                                                    │
│ [+ Salary Range Schedule]                          │
│   Min/mid/max ranges by position. For principals.  │
│                                                    │
│ [+ Flat Rate Schedule]                             │
│   Single annual amount per position.               │
│                                                    │
│ [+ Stipend Table]                                  │
│   Named stipends for extra duties.                 │
└────────────────────────────────────────────────────┘
```

### Schedule Configuration UIs

Each schedule type gets its own configuration panel:

**Index-Based Grid:**
- Enter base anchor salary
- Define lanes (name + index multiplier per step)
- Define number of steps
- Enter index values (paste from spreadsheet or enter manually)
- Mark capped steps per lane
- Preview the generated salary grid
- Optionally link a per-diem schedule that auto-derives from this grid

**Hourly:**
- Add categories (name, hourly rate, annual hours)
- Set overtime eligibility and multiplier per category
- Preview annual salary equivalents

**Per-Diem:**
- Select derivation method: "Derive from salary schedule" or "Independent rates"
- If derived: select source salary schedule, enter contract days divisor
- Set per-diem caps per lane
- Preview rate table

**Range-Based:**
- Add position titles with min/mid/max salary
- Used for administrators, principals, coordinators

**Stipend Table:**
- Add named stipends with amounts, categories, and flags (TRS-creditable, scales with base, etc.)
- Assign to specific employees or make available to all in the group

**Flat Rate:**
- Add position titles with a single annual dollar amount
- Simple — used for fixed-compensation roles

---

## SCENARIO ENGINE CHANGES

### Per-Group, Per-Schedule Scenario Configs

The scenario year configs now need to specify which employee group AND which compensation schedule they apply to:

```sql
scenario_year_configs (updated)
- id (uuid, primary key)
- scenario_id (uuid, FK → scenarios)
- employee_group_id (uuid, FK → employee_groups)
- compensation_schedule_id (uuid, FK → compensation_schedules)
- contract_year (integer)
- year_label (string)

-- For index-based schedules:
- base_adjustment_type (enum: "percentage" | "dollar" | "set_directly", nullable)
- base_adjustment_value (decimal, nullable)
- new_base_anchor_cents (bigint, nullable)

-- For individual salary / hourly / flat / range schedules:
- increase_type (enum: "fixed_percentage" | "cpi_formula" | "flat_dollar" | "step_only" | "custom")
- fixed_percentage (decimal, nullable)
- cpi_value (decimal, nullable)
- cpi_adder (decimal, nullable)
- cpi_cap (decimal, nullable)
- cpi_floor (decimal, nullable)
- high_earner_threshold_cents (bigint, nullable)
- high_earner_flat_increase_cents (bigint, nullable)
- effective_rate (decimal)

-- For stipend schedules:
- stipend_increase_type (enum: "no_change" | "match_base" | "fixed_percentage" | "custom", nullable)
- stipend_increase_rate (decimal, nullable)

-- Shared:
- step_advancement (boolean, default true)
- lane_advancement_probability (decimal, default 0.10)
- educational_advancement_ba15_cents (bigint, nullable)
- educational_advancement_ma_cents (bigint, nullable)
- educational_advancement_ma15_cents (bigint, nullable)
- notes (text, nullable)
```

### Calculation Engine Routing

The scenario engine iterates through each employee group, then each compensation schedule within that group, and applies the appropriate calculation:

```typescript
async function calculateScenario(scenarioId: string) {
  const scenario = await getScenario(scenarioId);
  const groups = await getEmployeeGroups(scenario.districtId);
  
  for (const group of groups) {
    const schedules = await getCompensationSchedules(group.id);
    const employees = await getEmployees(group.id);
    const yearConfigs = await getYearConfigs(scenarioId, group.id);
    
    for (const employee of employees) {
      // Find the primary schedule for base pay calculation
      const primarySchedule = schedules.find(s => s.isPrimary);
      
      for (let year = 0; year < group.contractYears; year++) {
        const config = yearConfigs.find(
          c => c.contractYear === year && 
               c.compensationScheduleId === primarySchedule.id
        );
        
        // Calculate base pay from primary schedule
        let basePay = calculateBasePay(employee, primarySchedule, config, year);
        
        // Calculate supplemental pay from additional schedules
        let supplementalPay = 0;
        for (const schedule of schedules.filter(s => !s.isPrimary)) {
          const schedConfig = yearConfigs.find(
            c => c.contractYear === year && 
                 c.compensationScheduleId === schedule.id
          );
          supplementalPay += calculateSupplemental(
            employee, schedule, schedConfig, year, basePay
          );
        }
        
        // Calculate employer costs
        const employerCosts = calculateEmployerCosts(
          employee, group, basePay, supplementalPay, year
        );
        
        // Store projection
        await storeProjection(employee, scenarioId, year, {
          basePay,
          supplementalPay,
          ...employerCosts
        });
      }
    }
  }
}

function calculateBasePay(employee, schedule, config, year) {
  switch (schedule.scheduleType) {
    case "index_based_grid":
      return calculateIndexBased(employee, schedule, config, year);
    case "individual_salary":
      return calculateIndividualSalary(employee, config, year);
    case "hourly":
      return calculateHourly(employee, schedule, config, year);
    case "per_diem":
      return calculatePerDiem(employee, schedule, config, year);
    case "range_based":
      return calculateRangeBased(employee, schedule, config, year);
    case "flat_rate":
      return calculateFlatRate(employee, schedule, config, year);
    default:
      throw new Error(`Unknown schedule type: ${schedule.scheduleType}`);
  }
}
```

### Index-Based Calculation (Compounding Base)

```typescript
function calculateIndexBased(employee, schedule, config, year) {
  const gridConfig = await getIndexGridConfig(schedule.id);
  
  // COMPOUNDING: Each year's base builds on prior year's base
  let currentBase = gridConfig.baseAnchorSalary;
  for (let y = 0; y <= year; y++) {
    const yearConfig = getYearConfig(y);
    if (y > 0 && yearConfig) {
      switch (yearConfig.baseAdjustmentType) {
        case "percentage":
          currentBase = currentBase * (1 + yearConfig.baseAdjustmentValue / 100);
          break;
        case "dollar":
          currentBase = currentBase + yearConfig.baseAdjustmentValue;
          break;
        case "set_directly":
          currentBase = yearConfig.baseAdjustmentValue;
          break;
      }
    }
  }
  
  // Step advancement
  const newStep = Math.min(employee.currentStep + year, gridConfig.maxSteps);
  
  // Look up index value at (step, lane)
  const index = getIndexValue(schedule.id, employee.currentLaneId, newStep);
  
  // Calculate salary
  const salary = Math.round(currentBase * index.indexValue);
  
  return salary; // in whole dollars
}
```

---

## SCENARIO BUILDER UI FOR MULTIPLE GROUPS

The scenario builder needs to handle N employee groups, each potentially with different increase types:

```
SCENARIO BUILDER: "Board Proposal — FY2027"
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ YEAR 1 (2025-26)                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▸ Teachers (Index-Based Grid)              [Configure ▸]│ │
│ │   Base: $44,200 → $45,084 (+2.0%)                      │ │
│ │   Impact: +$XXX,XXX                                     │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▸ Principals — Elementary (Range)          [Configure ▸]│ │
│ │   Increase: +2.5%                                       │ │
│ │   Impact: +$XX,XXX                                      │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▸ Principals — Middle (Range)              [Configure ▸]│ │
│ │   Increase: +2.5%                                       │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▸ Custodial Staff (Hourly)                 [Configure ▸]│ │
│ │   Hourly Rate Increase: +$0.75/hr                       │ │
│ │   Impact: +$XX,XXX                                      │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▸ Paraprofessionals (Hourly)               [Configure ▸]│ │
│ │   Hourly Rate Increase: +3.0%                           │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ▸ Nutrition Services (Hourly)              [Configure ▸]│ │
│ │   Hourly Rate Increase: +2.0%                           │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ... (all 20 groups listed)                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌── YEAR 1 SUMMARY ──────────────────────────────────┐     │
│ │ Total Payroll Impact: +$X,XXX,XXX                  │     │
│ │ Total Employer Cost Impact: +$X,XXX,XXX            │     │
│ │ By Group: Teachers +$XXX | Principals +$XX | ...   │     │
│ └────────────────────────────────────────────────────┘     │
│                                                             │
│ YEAR 2 (2026-27)                                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ▸ Teachers: Base $45,084 → $46,211 (+2.5%)             │ │
│ │ ▸ Principals — Elementary: +2.5%                        │ │
│ │ ▸ Custodial: +$0.75/hr                                  │ │
│ │ ... (inherit from Year 1 or configure independently)    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Copy Year 1 settings to all years]                         │
│ [Calculate Projections]                                     │
└─────────────────────────────────────────────────────────────┘
```

**Key UI behaviors:**
- Each employee group is collapsible — click to expand and see full configuration
- "Copy Year 1 settings to all years" button for quick setup when rates are uniform across the contract
- Each year shows the COMPOUNDED base for index-based groups (Year 2 base = Year 1 new base, not original)
- Real-time total impact summary per year as user adjusts rates
- Groups can be configured with different increase types (Teachers get index-based percentage, Custodial gets flat hourly bump, Principals get fixed percentage)

---

## HEATMAP CHANGES

The heatmap page needs a group selector since different groups have different schedule structures:

```
HEATMAP
┌──────────────────────────────────────────────┐
│ Employee Group: [Teachers ▼]                 │
│ Schedule: [Annual Salary Schedule ▼]         │
│ Scenario: [Board Proposal A ▼]              │
│                                              │
│ [Year 0] [Year 1] [Year 2] [Year 3] [Year 4]│
│                                              │
│ (step-and-lane heatmap grid here)            │
└──────────────────────────────────────────────┘
```

For groups with hourly schedules, show a category-based distribution chart instead of a step-and-lane grid. For groups with range-based schedules, show a position-level summary with employee count and average salary per position.

---

## REPORTS CHANGES

Reports aggregate across ALL employee groups:

**District Summary Report:**
- Total compensation by employee group (one row per group, columns for each year)
- Grand total across all groups
- Percentage breakdown pie chart (Teachers X%, Principals X%, Custodial X%, etc.)

**Group Detail Report:**
- One section per employee group
- Appropriate detail format based on schedule type (grid for teachers, category table for hourly, range summary for principals)

**Scenario Comparison:**
- Compare total district cost across scenarios
- Show per-group breakdown within each scenario
- Highlight groups where the difference is largest

---

## MIGRATION PATH FROM CURRENT SCHEMA

Since v1 already has `bargaining_units` with 3 units (Licensed, ESP, CM), the migration is:

1. Rename `bargaining_units` to `employee_groups` (or create `employee_groups` and migrate data)
2. Create `compensation_schedules` table
3. For each existing bargaining unit, create a compensation_schedule record linked to its existing salary_schedule or hourly_schedule
4. Update foreign keys throughout (employees, scenarios, etc.)
5. Add the new schedule type tables (index_grid_config, per_diem_config, stipend_definitions, salary_ranges, flat_rates)

**The existing District 21 seed data should continue to work** — it just gets wrapped in the new flexible architecture. Licensed Staff becomes an employee_group with an "individual_salary" compensation_schedule. ESP becomes an employee_group with an "hourly" compensation_schedule. CM same.

---

## IMPLEMENTATION PRIORITY

1. **Schema migration** — Add employee_groups and compensation_schedules tables, update foreign keys
2. **Settings UI** — Employee group CRUD with schedule type selection
3. **Index-based grid engine** — The Columbia model calculation with compounding base
4. **Scenario builder update** — Per-group configuration UI
5. **Per-diem engine** — Derived and independent rate calculations
6. **Stipend engine** — Table management and integration with projections
7. **Range-based and flat-rate engines** — Simpler calculations for admin roles
8. **Heatmap update** — Group selector and schedule-type-appropriate visualizations
9. **Report update** — Multi-group aggregation

Build items 1-4 first. That covers the core architecture change and the Columbia model. Items 5-9 layer on incrementally.
