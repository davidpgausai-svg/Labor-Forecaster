# CollBar — Collective Bargaining Compensation Modeling Platform
## Complete Replit Agent Build Prompt

---

## PROJECT OVERVIEW

Build a full-stack web application called **CollBar** — a collective bargaining compensation modeling platform for school districts. This tool allows School Business Officials (SBOs) to upload employee data, configure salary schedules, model multiple compensation proposals, compare scenarios over a 5-year contract period, and apply a final scenario to generate accurate budget forecasts.

The primary users are Chief School Business Officials (CSBOs) at K-12 school districts who negotiate collective bargaining agreements with teacher unions and other employee unions. They need penny-accurate compensation projections to bring to the bargaining table.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, PostgreSQL (Neon), Tailwind CSS, Prisma ORM, deployed on Replit.

**Authentication:** Simple email/password auth with bcrypt. Single-tenant — one district per deployment.

---

## DATABASE SCHEMA

### Districts Table
```
districts
- id (uuid, primary key)
- name (string) — e.g., "Community Consolidated School District 21"
- state (string)
- fiscal_year_start (string) — e.g., "July 1"
- created_at (timestamp)
- updated_at (timestamp)
```

### Bargaining Units Table
Each district can have multiple bargaining units (e.g., Licensed Staff, ESP, Custodial/Maintenance).
```
bargaining_units
- id (uuid, primary key)
- district_id (uuid, FK → districts)
- name (string) — e.g., "Licensed Staff", "Educational Support Personnel", "Custodial Maintenance"
- code (string) — e.g., "licensed", "esp", "cm"
- compensation_type (enum: "salary" | "hourly")
- retirement_system (enum: "TRS" | "IMRF" | "other")
- retirement_employee_rate (decimal) — e.g., 0.09 for TRS 9%
- retirement_employer_rate (decimal)
- retirement_gross_up_rate (decimal) — e.g., 0.008901
- fica_rate (decimal) — default 0.0765 (Social Security 6.2% + Medicare 1.45%)
- fica_exempt (boolean) — some districts are TRS-exempt from Social Security
- health_insurance_single_annual (decimal) — employer cost per employee
- health_insurance_family_annual (decimal)
- dental_annual (decimal)
- life_insurance_annual (decimal)
- disability_insurance_annual (decimal)
- hsa_contribution_single (decimal)
- hsa_contribution_family (decimal)
- workers_comp_rate (decimal)
- created_at (timestamp)
- updated_at (timestamp)
```

### Salary Schedules Table (for salaried/licensed staff)
```
salary_schedules
- id (uuid, primary key)
- bargaining_unit_id (uuid, FK → bargaining_units)
- name (string) — e.g., "2022-2023 Licensed Salary Schedule"
- effective_year (integer) — contract year index (0-4)
- base_salary (decimal) — the BA Step 1 anchor salary
- created_at (timestamp)
```

### Lanes Table
```
lanes
- id (uuid, primary key)
- salary_schedule_id (uuid, FK → salary_schedules)
- name (string) — e.g., "BA", "BA+15", "MA", "MA+15", "MA+30", "MA+45", "DOC"
- display_order (integer)
- index_multiplier (decimal) — e.g., 1.0 for BA, 1.04 for BA+15, 1.09 for MA
```

### Steps Table
```
steps
- id (uuid, primary key)
- salary_schedule_id (uuid, FK → salary_schedules)
- step_number (integer) — 1 through max_steps
- increment_multiplier (decimal) — cumulative multiplier for this step
```

### Schedule Cells Table (the actual salary matrix values)
```
schedule_cells
- id (uuid, primary key)
- salary_schedule_id (uuid, FK → salary_schedules)
- lane_id (uuid, FK → lanes)
- step_id (uuid, FK → steps)
- salary_amount (decimal) — the dollar value at this cell
```

### Hourly Wage Schedules Table (for ESP and CM staff)
```
hourly_schedules
- id (uuid, primary key)
- bargaining_unit_id (uuid, FK → bargaining_units)
- effective_year (integer)
```

### Hourly Categories Table
```
hourly_categories
- id (uuid, primary key)
- hourly_schedule_id (uuid, FK → hourly_schedules)
- name (string) — e.g., "EC Secretary", "Teacher Assistant", "Head Custodian"
- base_hourly_rate (decimal)
- annual_hours (decimal) — e.g., 1522.5, 1239.0, 2080.0
- display_order (integer)
```

### Employees Table
```
employees
- id (uuid, primary key)
- district_id (uuid, FK → districts)
- bargaining_unit_id (uuid, FK → bargaining_units)
- employee_number (string) — district employee ID
- first_name (string)
- last_name (string)
- hire_date (date)
- birth_date (date)
- years_in_district (integer)
- years_total_service (integer) — for TRS/IMRF credit
- compensation_type (enum: "salary" | "hourly")
- current_lane_id (uuid, FK → lanes, nullable) — for salaried
- current_step (integer, nullable) — for salaried
- current_hourly_category_id (uuid, FK → hourly_categories, nullable) — for hourly
- current_hourly_rate (decimal, nullable)
- annual_hours (decimal, nullable)
- current_annual_salary (decimal)
- insurance_election (enum: "single" | "single_plus_spouse" | "single_plus_child" | "family" | "waived")
- retirement_eligible (boolean)
- retirement_plan (enum: "none" | "option1_4year" | "option2_2year" | "option3_longevity" | nullable)
- retirement_target_year (integer, nullable)
- status (enum: "active" | "new_hire" | "terminated" | "retired" | "on_leave")
- effective_year (integer) — which contract year this employee record is effective (0-4). This allows adding/removing employees per year.
- notes (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

### Employee Year Records Table (projected data per employee per year per scenario)
```
employee_year_records
- id (uuid, primary key)
- employee_id (uuid, FK → employees)
- scenario_id (uuid, FK → scenarios)
- contract_year (integer) — 0 through 4
- projected_step (integer)
- projected_lane_id (uuid, FK → lanes, nullable)
- projected_hourly_rate (decimal, nullable)
- projected_base_salary (decimal)
- projected_total_compensation (decimal) — salary + employer benefits
- retirement_contribution (decimal)
- fica_cost (decimal)
- health_insurance_cost (decimal)
- other_benefits_cost (decimal)
- total_employer_cost (decimal) — everything the district pays
```

### Scenarios Table
```
scenarios
- id (uuid, primary key)
- district_id (uuid, FK → districts)
- name (string) — e.g., "Board Proposal A", "Union Counter-Proposal", "CPI Baseline"
- description (text)
- is_final (boolean) — when true, this is the applied scenario
- status (enum: "draft" | "active" | "final" | "archived")
- created_at (timestamp)
- updated_at (timestamp)
```

### Scenario Year Configs Table
```
scenario_year_configs
- id (uuid, primary key)
- scenario_id (uuid, FK → scenarios)
- contract_year (integer) — 0 through 4
- year_label (string) — e.g., "2022-23", "2023-24"
- increase_type (enum: "fixed_percentage" | "cpi_formula" | "flat_dollar" | "step_only" | "custom")
- fixed_percentage (decimal, nullable) — e.g., 4.5
- cpi_value (decimal, nullable) — the CPI-U value
- cpi_adder (decimal, nullable) — additional percentage added to CPI (e.g., 1.5)
- cpi_cap (decimal, nullable) — maximum effective rate (e.g., 3.75)
- cpi_floor (decimal, nullable) — minimum effective rate (e.g., 2.0)
- high_earner_threshold (decimal, nullable) — e.g., 125000
- high_earner_flat_increase (decimal, nullable) — e.g., 3000
- effective_rate (decimal) — calculated/stored effective rate
- educational_advancement_ba15 (decimal) — e.g., 2500
- educational_advancement_ma (decimal) — e.g., 3500
- educational_advancement_ma15 (decimal) — e.g., 2500
- notes (text, nullable)
```

---

## APPLICATION PAGES AND FEATURES

### 1. Dashboard (/)
- District summary: total employees by bargaining unit, total current payroll
- Active scenarios with status badges
- 5-year total compensation projection chart (bar chart showing each year)
- Quick links to key actions: Upload Employees, Create Scenario, View Schedules
- Alert badges: retirement-eligible count, high-earner count, employees approaching top step

### 2. Employees (/employees)
**Employee List View:**
- Sortable/filterable table of all employees
- Filter by: bargaining unit, status (active/new hire/terminated), lane, step range, salary range, insurance election, retirement eligibility
- Columns: Name, Employee #, Unit, Lane/Category, Step, Current Salary, Insurance, Retirement Eligible, Status
- Bulk actions: Change status, change insurance election

**Employee Detail View (/employees/[id]):**
- Full employee profile with all fields
- 5-year projection table showing their salary progression under the active scenario
- Lane/step history
- Retirement incentive calculator: show Option 1 (4-year), Option 2 (2-year), Option 3 (Longevity) calculations with actual dollar amounts based on their years of service and TRS/IMRF credits

**Employee Import (/employees/import):**
- CSV/Excel upload interface
- Column mapping screen: user maps their CSV columns to system fields
- Required fields: first_name, last_name, bargaining_unit, current_salary
- Optional fields: employee_number, hire_date, birth_date, lane, step, hourly_rate, annual_hours, insurance_election, years_in_district, years_total_service
- Validation screen: show rows with errors (missing required fields, invalid values, salary mismatches vs schedule)
- Preview: show first 20 rows as they'll be imported
- Import button with progress bar
- Support YEAR-SPECIFIC imports: user selects which contract year (0-4) the import applies to. This is critical — districts need to add new hires in Year 2 or remove terminated employees in Year 3

**Employee Export (/employees/export):**
- Export current employee roster as CSV or Excel
- Export projected roster for a specific year under a specific scenario
- Export includes all calculated fields: projected salary, step, lane, employer costs

### 3. Salary Schedules (/schedules)
**Schedule List:**
- Show all salary schedules by bargaining unit
- Visual salary matrix grid for each schedule
- Show the step-and-lane grid with dollar amounts in each cell

**Schedule Builder (/schedules/new):**
- Define lanes (BA, BA+15, MA, etc.) with index multipliers
- Define steps (1 through N) with increment percentages
- Set base salary (BA Step 1)
- Auto-calculate all cells based on: cell_value = base_salary × lane_index × step_multiplier
- Manual override: click any cell to override the calculated value
- Save schedule

**Hourly Schedule Builder (/schedules/hourly/new):**
- Define categories (Secretary, Teacher Assistant, etc.)
- Set hourly rate and annual hours for each category
- Preview annual salary calculations

**Schedule Comparison:**
- Side-by-side comparison of two schedules
- Highlight cells that differ
- Show dollar and percentage difference per cell

### 4. Heatmap (/heatmap)
**THIS IS A KEY DIFFERENTIATING FEATURE.**

Display the salary schedule matrix as a visual heatmap showing WHERE employees are distributed across steps and lanes.

- Full step-and-lane grid
- Each cell shows: salary amount, NUMBER of employees at that position, color intensity based on employee count (darker = more employees)
- Color scale: 0 employees = gray/empty, 1 = light blue, 2-3 = medium blue, 4-5 = dark blue, 6+ = deep blue/purple
- Year selector: toggle between Year 0 through Year 4 to see how the distribution shifts as employees advance steps
- Show summary statistics: average step, average lane, median salary, employees at top step (can't advance further), employees at bottom step (newest hires)
- Show cost concentration: what percentage of total payroll is concentrated in the top 3 steps vs bottom 3 steps
- ANIMATE the heatmap transition between years so the SBO can visually see employees flowing through the matrix over the contract period

Do this for EACH bargaining unit. For hourly staff, show a simpler grid by category showing employee count and projected hourly rates per year.

### 5. Scenarios (/scenarios)
**Scenario List:**
- All scenarios with status (draft, active, final, archived)
- Quick comparison: total 5-year cost for each scenario in a comparison bar
- "Final" badge on the applied scenario

**Scenario Builder (/scenarios/new):**
- Name and description
- For each contract year (Year 1 through Year 5), configure:
  - **Increase Type selector:** Fixed Percentage, CPI Formula, Flat Dollar, Step Only (no base increase), Custom
  - **If Fixed Percentage:** Enter the percentage (e.g., 4.5%)
  - **If CPI Formula:** Enter CPI-U value, adder percentage, cap percentage, floor percentage. Show the calculated effective rate in real-time as user adjusts sliders. Display the formula: "CPI-U (X%) + Adder (Y%) = Z%, capped at A%, floored at B% → Effective: C%"
  - **If Flat Dollar:** Enter dollar amount (e.g., $3,000)
  - **High Earner Override:** Toggle on/off. If on, set threshold (default $125,000) and flat increase amount (default $3,000). Employees above threshold get flat dollar instead of percentage.
  - **Educational Advancement:** Set dollar bumps for each lane advancement (BA+15: $2,500, MA: $3,500, MA+15: $2,500)
  - **Step Advancement:** Toggle whether employees advance one step per year (default: yes)
  - **Lane Advancement Probability:** Set percentage chance per year of lane advancement for projection purposes (default: 10%)
- **Benefits Configuration per Year:**
  - Health insurance premium increase rate (e.g., 5% per year)
  - Health insurance employer contribution cap (e.g., 8% max increase per year per CBA)
  - HSA contribution amounts (single and family)
  - Retirement system rates (TRS 9%, IMRF 4.5%)
  - FICA rate (7.65% or modified if TRS-exempt)
  - Workers comp rate
  - Dental, life, disability rates
- **Retirement Modeling:**
  - Toggle retirement incentive modeling on/off
  - If on: for each retirement-eligible employee, model the 5.5% annual increase for 4-year or 2-year notification options
  - Show projected retirement exits per year and the salary savings from replacement hires
  - Replacement hire assumptions: what step/lane do new hires typically enter? (configurable, default: Step 1, BA or MA)

**Scenario Detail (/scenarios/[id]):**
- Full scenario configuration display
- Year-by-year summary table:
  - Columns: Year, Effective Rate, Licensed Payroll, ESP Payroll, CM Payroll, TRS Cost, IMRF Cost, FICA Cost, Health Insurance Cost, Total Benefits, Total Compensation, Δ vs Prior Year ($ and %), Δ vs Baseline Year ($ and %)
- Bargaining unit breakdown with colored bars
- Per-employee projection table (sortable, filterable)
- Export: PDF summary for board presentation, Excel with full detail

**Scenario Comparison (/scenarios/compare):**
- Select 2-3 scenarios to compare side by side
- Year-by-year cost comparison table
- 5-year cumulative cost comparison
- Difference column showing $ and % variance between scenarios
- Bar chart visualization
- Highlight which scenario is most/least expensive per year and cumulatively
- Show which employees are affected differently (e.g., high earners getting flat vs percentage)

### 6. Apply Scenario (/scenarios/[id]/apply)
**THIS IS THE CRITICAL WORKFLOW.**

When the SBO selects a final scenario and clicks "Apply":

1. Show a confirmation screen with the full 5-year financial summary
2. Show the total cost difference vs the current/baseline scenario
3. Require explicit confirmation: "Apply [Scenario Name] as the final agreement?"
4. On confirmation:
   - Mark the scenario as "final" (only one can be final at a time)
   - Generate employee_year_records for ALL employees across ALL 5 years
   - For each employee, for each year:
     - Calculate step advancement (current_step + year_number, capped at max step)
     - Apply the year's increase formula to calculate new salary
     - Handle high earner threshold logic
     - Calculate all employer costs: retirement, FICA, health insurance, dental, life, disability, workers comp, HSA
     - Store the complete projection
   - Generate a downloadable PDF report with:
     - Executive summary: total 5-year cost, year-by-year breakdown
     - Per-unit breakdown
     - Per-employee detail with all projected salaries
     - Comparison vs baseline/other scenarios
   - Generate an Excel export with:
     - Summary tab
     - Per-unit tabs
     - Per-employee detail tab with every calculated field
     - Salary schedule tabs showing the matrix for each year

### 7. Reports (/reports)
- **Board Presentation Report (PDF):** Executive summary with charts, suitable for presenting to a school board
- **Negotiation Summary (PDF):** Side-by-side scenario comparison for the bargaining table
- **Employee Detail Report (Excel):** Every employee, every year, every cost component
- **Budget Impact Report (PDF):** Year-over-year cost increases with explanations of drivers (step movement, base increase, benefit cost increases, new hires, retirements)
- **Heatmap Report (PDF):** Visual heatmap snapshots for each year

---

## CALCULATION ENGINE — DETAILED LOGIC

### Salary Calculation for Licensed Staff
```
For each employee, for each contract year:

1. Determine step: current_step + year_number (cap at max_step)
2. Determine lane: current_lane (or advanced lane if modeled)
3. Look up base cell value from salary schedule: base_salary × lane_index × step_multiplier
4. Apply yearly increase:
   - If increase_type == "fixed_percentage":
     new_salary = prior_year_salary × (1 + rate)
   - If increase_type == "cpi_formula":
     effective_rate = max(cpi_floor, min(cpi_cap, cpi_value + cpi_adder))
     IF salary >= high_earner_threshold:
       new_salary = prior_year_salary + high_earner_flat_increase
     ELSE:
       new_salary = prior_year_salary × (1 + effective_rate)
   - If increase_type == "flat_dollar":
     new_salary = prior_year_salary + flat_amount
5. Apply educational advancement if applicable:
   new_salary += advancement_amount (e.g., $2,500 for BA+15)
6. Round to nearest cent (2 decimal places) — PENNY ACCURACY IS CRITICAL
```

### Salary Calculation for Hourly Staff (ESP and CM)
```
For each employee, for each contract year:

1. Start with current hourly rate
2. Apply yearly increase to hourly rate:
   - Same formula as salaried (percentage, CPI, or flat) but applied to hourly rate
   - If annual equivalent exceeds high_earner_threshold, apply flat increase prorated to hourly
3. Apply seniority-based step increase if applicable (e.g., 1-2% per year of service)
4. Calculate annual salary: hourly_rate × annual_hours
5. Round hourly to nearest cent, annual to nearest cent
```

### Employer Cost Calculations (PER EMPLOYEE, PER YEAR)
```
For each employee, for each contract year:

retirement_cost:
  IF unit.retirement_system == "TRS":
    retirement_cost = salary × TRS_employer_rate
    // Note: In D21's CBA, employee TRS is employee responsibility,
    // but some districts pay employer portion
  IF unit.retirement_system == "IMRF":
    retirement_cost = salary × IMRF_employer_rate

fica_cost:
  IF unit.fica_exempt == true:
    fica_cost = salary × 0.0145  // Medicare only
  ELSE:
    IF salary <= social_security_wage_base (updates annually):
      fica_cost = salary × 0.0765
    ELSE:
      fica_cost = (wage_base × 0.062) + (salary × 0.0145)

health_insurance_cost:
  BASED ON insurance_election:
    "single": unit.health_insurance_single_annual × (1 + annual_premium_increase)^year
    "family": unit.health_insurance_family_annual × (1 + annual_premium_increase)^year
    "waived": 0
  APPLY employer cap if configured (e.g., 8% max increase per year)

other_benefits:
  dental = unit.dental_annual × (1 + increase_rate)^year
  life_insurance = unit.life_insurance_annual (usually tied to salary)
  disability = unit.disability_insurance_annual
  hsa = hsa_contribution based on election
  workers_comp = salary × unit.workers_comp_rate

total_employer_cost = salary + retirement_cost + fica_cost + health_insurance_cost + dental + life + disability + hsa + workers_comp
```

### Retirement Incentive Calculations
```
Option 1 — 4-Year Retirement Notification (Article 209.2):
  Eligibility: age >= 55, years_in_district >= 10, TRS service < 36 years (2.2 plan) or < 39 years (old plan)
  Benefit: 5.5% salary increase over prior year for each of 4 years before retirement
  Constraint: Annual increase cannot exceed 5.5% regardless of educational advancement
  Constraint: Total TRS creditable earnings cannot exceed prior year by more than 6%

Option 2 — 2-Year Retirement Notification (Article 209.3):
  Same eligibility as Option 1
  Benefit: 5.5% salary increase for 2 years before retirement
  PLUS: $275 × years_in_district (post-retirement bonus)
  PLUS: $1,000 × TRS_service_years (post-retirement bonus)
  PLUS: $2,500 × 4 years for non-district insurance

Option 3 — Longevity (Article 209.4):
  Eligibility: years_in_district >= 10
  Benefit: $275 × years_in_district (max 35 years) = up to $9,625
  Added to base salary in retirement year
  Combined with salary increase cannot exceed 6%

For ESP/CM — similar but using IMRF instead of TRS:
  IMRF 5+5 Early Retirement or
  5.5% × 4-year incentive (same as licensed) or
  $275 × years longevity
```

---

## UI/UX REQUIREMENTS

### Design System
- Clean, professional, dark mode interface (school business officials work long hours during bargaining)
- Color palette: Dark navy/charcoal background (#0a0e14, #111620), blue accents (#3b82f6) for licensed, purple (#8b5cf6) for ESP, amber (#f59e0b) for CM
- Font: Inter or DM Sans for UI, JetBrains Mono for numbers/financial data
- All financial numbers right-aligned, monospaced, with proper comma formatting
- Penny-accurate display: always show 2 decimal places for hourly rates, whole dollars for salaries
- Responsive but optimized for desktop (SBOs work on laptops/desktops)

### Key Interactions
- Year selector: persistent top-level control that affects all views
- Scenario selector: dropdown in header to switch between active scenarios
- All tables sortable by clicking column headers
- All tables filterable with search and dropdown filters
- Heatmap cells are clickable: clicking shows the list of employees at that step/lane position
- Scenario builder has real-time calculation preview: as user adjusts CPI sliders, show projected total cost updating live
- CSV import has drag-and-drop zone
- Charts use Recharts library

### Navigation
- Sidebar navigation:
  - Dashboard
  - Employees (with sub-items: Roster, Import, Export)
  - Salary Schedules (with sub-items: Licensed, Hourly, Compare)
  - Heatmap
  - Scenarios (with sub-items: All Scenarios, New Scenario, Compare)
  - Reports
  - Settings (District info, Bargaining Units, Benefit Rates)

---

## DATA IMPORT FORMAT

The CSV import should accept files with these column headers (flexible mapping):

```
employee_id, first_name, last_name, bargaining_unit, hire_date, birth_date, 
years_in_district, years_total_service, lane, step, hourly_category, 
hourly_rate, annual_hours, current_salary, insurance_election, 
retirement_eligible, retirement_plan, status, notes
```

The system should:
1. Auto-detect column headers and suggest mappings
2. Handle common variations (e.g., "First Name", "first_name", "FirstName", "fname")
3. Validate all data before import
4. Show error report for invalid rows
5. Allow user to fix errors inline before completing import
6. Support incremental imports: adding new employees without overwriting existing ones
7. Support year-specific imports: "Import these 5 new hires for Year 2 only"

---

## SAMPLE DATA

Pre-load the application with sample data based on the District 21 CBA:

**District:** Community Consolidated School District 21, Cook County, Illinois

**Bargaining Units:**
1. Licensed Staff (65 employees) — salary-based, TRS, step-and-lane schedule
2. Educational Support Personnel (25 employees) — hourly, IMRF, category-based
3. Custodial Maintenance (15 employees) — hourly, IMRF, category-based

**Licensed Lanes:** BA (1.0), BA+15 (1.04), MA (1.09), MA+15 (1.14), MA+30 (1.19), MA+45 (1.24), DOC (1.32)
**Licensed Steps:** 1-15, with 2.5% increment per step
**Licensed Base Salary:** $48,000 (BA, Step 1)

**ESP Categories:**
- EC Secretary: $22.50/hr, 1,522.5 hrs/yr
- Elementary Secretary: $21.00/hr, 1,435.0 hrs/yr
- MS Secretary: $23.00/hr, 1,522.5 hrs/yr
- LMC Assistant: $19.50/hr, 1,350.0 hrs/yr
- Health Assistant: $20.00/hr, 1,267.0 hrs/yr
- Teacher Assistant: $18.75/hr, 1,239.0 hrs/yr

**CM Categories:**
- Head Custodian: $26.50/hr, 2,080 hrs/yr
- Night Custodian: $23.00/hr, 2,080 hrs/yr
- Mid-Day Custodian: $24.00/hr, 2,080 hrs/yr
- Maintenance: $28.00/hr, 2,080 hrs/yr

**Contract Year Configurations (from CBA Article 208.2/306.1/405.1):**
- Year 1 (2022-23): Fixed 4.5% increase
- Year 2 (2023-24): Fixed 5.0% increase
- Year 3 (2024-25): CPI-U + 1.5%, cap 3.75%, floor 2.0%. Employees ≥$125K get flat $3,000
- Year 4 (2025-26): CPI-U + 1.5%, cap 3.75%, floor 2.0%. Employees ≥$125K get flat $3,000
- Year 5 (2026-27): CPI-U + 1.5%, cap 3.75%, floor 2.0%. Employees ≥$125K get flat $3,000

**Benefit Rates:**
- TRS: 9% employee rate (employee responsibility per CBA), 0.8901% gross-up
- IMRF: 4.5% employee rate (employee responsibility per CBA), 0.212% gross-up
- FICA: 7.65% (or Medicare-only 1.45% for TRS-covered)
- Health Insurance Employer Contribution: ~$8,400/yr single, ~$22,000/yr family
- Health Insurance Premium Increase Cap: 8% per year (per CBA Article 107.1)
- HSA: $600/yr single, $1,200/yr family (per CBA)
- Dental: Employee-paid (district provides plan, employee pays)
- Life Insurance: Employer-paid, equal to annual salary
- Disability: Employer-paid

**Pre-loaded Scenarios:**
1. "Board Proposal A" — Uses actual CBA rates above
2. "Union Counter-Proposal" — 5% fixed across all years, no high earner cap
3. "Conservative Baseline" — 2% fixed across all years

**Generate 105 sample employees** distributed realistically:
- Licensed: 65 staff, weighted toward MA and MA+15 lanes, steps distributed bell-curve around 6-10
- ESP: 25 staff across all categories
- CM: 15 staff across all categories
- Include 8-12 retirement-eligible employees (age ≥55, D21 service ≥10 years)
- Include 3-5 employees above $125K threshold
- Include a mix of insurance elections (60% family, 25% single, 15% waived)

---

## CRITICAL REQUIREMENTS

1. **PENNY ACCURACY.** Every calculation must be accurate to the cent. When an SBO presents these numbers to a school board or union, a single penny discrepancy destroys credibility. Use precise decimal arithmetic, not floating point. Store all monetary values as integers (cents) or use Decimal type.

2. **YEAR-SPECIFIC EMPLOYEE MANAGEMENT.** The single most important feature beyond basic projections. A 5-year contract means employees come and go. A teacher hired in Year 2 at Step 1 has a completely different cost trajectory than a teacher hired in Year 0 at Step 5. The system MUST allow adding and removing employees by specific contract year and recalculating all projections accordingly.

3. **CPI FORMULA WITH CAPS AND FLOORS.** The most common collective bargaining compensation formula in Illinois is: Effective Rate = max(Floor, min(Cap, CPI-U + Adder)). This must be configurable per scenario per year and the calculation must be transparent — show the full formula breakdown so the SBO can explain it to the board.

4. **HIGH EARNER THRESHOLD LOGIC.** Per District 21's CBA, employees earning ≥$125,000 get a flat $3,000 instead of the percentage increase. This is common across Illinois districts. The threshold and flat amount must be configurable.

5. **MULTI-BARGAINING UNIT SUPPORT.** A single district may have 3-5 bargaining units, each with completely different compensation structures, benefit calculations, and retirement systems. The application must handle all of them simultaneously and show combined district-wide totals.

6. **SCENARIO COMPARISON IS THE SALE.** The ability to create Proposal A, Proposal B, and the Union Counter-Proposal, then compare them side-by-side with exact 5-year cost projections is what makes this tool worth $4,500/year. Every screen should support scenario switching.

7. **HEATMAP VISUALIZATION.** The step-and-lane heatmap showing employee distribution is the "wow" feature in demos. It must animate between years and show the financial concentration clearly.

8. **EXPORT QUALITY.** PDF exports must be presentation-ready for a school board meeting. Excel exports must include all detail for the SBO's own analysis. These are not afterthoughts — they are primary deliverables.

9. **DATA SECURITY.** Employee compensation data is sensitive. Basic auth is fine for the prototype, but note that production deployment should use HTTPS, secure session management, and encrypted database connections. Each district instance is single-tenant.

10. **PERFORMANCE.** A district with 500 employees across 3 bargaining units and 5 years of projections means calculating ~7,500 employee-year records per scenario. The calculation engine must run in under 3 seconds.

---

## FILE STRUCTURE

```
/app
  /layout.tsx
  /page.tsx (Dashboard)
  /employees
    /page.tsx (Employee List)
    /[id]/page.tsx (Employee Detail)
    /import/page.tsx (CSV Import)
    /export/page.tsx (Export)
  /schedules
    /page.tsx (Schedule List)
    /new/page.tsx (Schedule Builder)
    /hourly/new/page.tsx (Hourly Schedule Builder)
  /heatmap
    /page.tsx (Heatmap View)
  /scenarios
    /page.tsx (Scenario List)
    /new/page.tsx (Scenario Builder)
    /[id]/page.tsx (Scenario Detail)
    /[id]/apply/page.tsx (Apply Scenario)
    /compare/page.tsx (Scenario Comparison)
  /reports
    /page.tsx (Report Generator)
  /settings
    /page.tsx (District and Unit Configuration)
  /api
    /employees/route.ts
    /employees/import/route.ts
    /schedules/route.ts
    /scenarios/route.ts
    /scenarios/[id]/calculate/route.ts
    /scenarios/[id]/apply/route.ts
    /reports/route.ts
    /heatmap/route.ts
/components
  /layout
    /Sidebar.tsx
    /Header.tsx
  /employees
    /EmployeeTable.tsx
    /EmployeeForm.tsx
    /ImportWizard.tsx
  /schedules
    /SalaryMatrix.tsx
    /HourlySchedule.tsx
    /ScheduleBuilder.tsx
  /scenarios
    /ScenarioBuilder.tsx
    /YearConfig.tsx
    /CPICalculator.tsx
    /ScenarioComparison.tsx
  /heatmap
    /StepLaneHeatmap.tsx
    /HourlyHeatmap.tsx
  /reports
    /PDFGenerator.tsx
  /shared
    /MetricCard.tsx
    /DataTable.tsx
    /BarChart.tsx
    /YearSelector.tsx
    /ScenarioSelector.tsx
    /FormulaDisplay.tsx
/lib
  /calculations
    /salary-engine.ts
    /hourly-engine.ts
    /benefits-engine.ts
    /retirement-engine.ts
    /scenario-engine.ts
  /utils
    /currency.ts (penny-accurate formatting and arithmetic)
    /csv-parser.ts
    /pdf-generator.ts
    /excel-generator.ts
  /db
    /prisma.ts
    /seed.ts (sample data generator)
/prisma
  /schema.prisma
  /seed.ts
```

---

## DEPLOYMENT NOTES

- Deploy on Replit with Neon PostgreSQL
- Environment variables: DATABASE_URL, SESSION_SECRET
- Run Prisma migrations on deploy
- Seed database with sample District 21 data on first run
- Application should be fully functional immediately after deployment with sample data loaded
- Target deployment: one instance per district customer, separate databases

---

## SUMMARY

CollBar is a collective bargaining compensation modeling platform that turns an 87-page CBA into an interactive, scenario-driven financial model. The SBO uploads their employee roster, configures their salary schedules and bargaining unit rules, creates multiple proposals, compares them side by side, and applies the final agreement — generating penny-accurate 5-year projections for every employee across every cost category.

The key differentiator is the combination of: multi-bargaining-unit support, CPI formula modeling with caps and floors, year-specific employee management (adding/removing employees mid-contract), the step-and-lane heatmap visualization, and presentation-ready exports for school board meetings and union negotiations.

Build this as a polished, production-quality prototype that demonstrates the full workflow from data import through scenario comparison to final application. The sample data should make it immediately impressive on first load.
