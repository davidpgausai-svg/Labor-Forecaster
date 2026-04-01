# CollBar — Detailed Answers to Build Questions

These answers reflect the architecture of a single-tenant, remix-from-template SaaS product serving school districts and other public-sector employers engaged in collective bargaining. Each customer gets their own forked instance, enabling custom code modifications per client when CBAs require non-standard logic.

---

## 1. Number of Bargaining Units & Contract Structure

**CollBar is industry-agnostic but launches with K-12 school districts as the primary market.** The data model should support any public-sector employer with unionized staff — school districts, community colleges, municipalities, county governments, public hospitals, and healthcare systems. The League/1199 hospital model is a future vertical, not a v1 priority.

**Architecture decision:** The bargaining unit entity is flexible and not hard-coded to "Licensed/ESP/CM." A bargaining unit is simply a named group of employees with its own compensation rules, benefit structure, and retirement system. A school district might have 3 units. A hospital might have 7. A municipal government might have 2. The system accommodates all of these because the unit configuration is entirely user-defined.

**Different contract cycles: Yes, support this.** In the real world, a district's teacher union might be on a 5-year CBA expiring in 2027 while the custodial union is on a 3-year CBA expiring in 2025. Each bargaining unit should have its own contract start date, end date, and number of contract years (1 through 7). The scenario engine should handle units on different cycles within the same district deployment.

**Implementation:** Add `contract_start_date`, `contract_end_date`, and `contract_years` fields to the `bargaining_units` table. The scenario builder then shows the appropriate number of year columns per unit. When displaying district-wide totals, the system aligns all units to a common fiscal year timeline, even if their contract terms differ.

**Why this matters:** When I sell this to a district, the CSBO will ask "can I model our teacher contract and our support staff contract at the same time even though they expire in different years?" The answer must be yes. That is the reality of their job — they manage multiple overlapping contracts simultaneously.

---

## 2. Salary Schedules — Manual Entry vs. Import

**Support BOTH formula-built and direct-import schedules. Direct import is the higher priority.**

Real-world salary schedules are messy. The Easton case study showed an 11-step × 8-lane matrix. District 21 doesn't use a traditional step-and-lane grid at all — their CBA applies percentage increases to individual salaries with a CPI formula. Some districts have frozen steps (Step 8 and Step 9 pay the same because of a prior negotiation). Some have irregular lane multipliers that don't follow a consistent index pattern. Some have "longevity steps" that only kick in after 20 years.

**Primary import method:** Paste or upload a CSV/Excel of the full salary matrix. The system reads it as-is — rows are steps, columns are lanes, cell values are dollar amounts. No formula required. The SBO pastes in the exact grid from their current CBA and the system uses those values directly.

**Secondary method:** Formula-based builder for districts that do use a clean mathematical structure. Define base salary, lane multipliers, and step increment percentages. The system auto-calculates cells. Any cell can then be manually overridden.

**Off-schedule placements:** Yes, this happens. A teacher might be hired at a negotiated salary that doesn't correspond to any cell in the grid (e.g., they negotiated $68,500 but the closest cell is $67,800 at MA Step 7). The employee record stores their actual salary independent of the schedule cell. The system should flag off-schedule placements with a visual indicator so the SBO is aware, but it should not force the salary to match a cell. When projecting forward, the off-schedule salary uses the same increase formula as everyone else — the base percentage or CPI formula is applied to their actual salary, not to a grid cell.

**Implementation:** The `schedule_cells` table stores the official grid. The `employees` table stores `current_annual_salary` independently. The projection engine uses the employee's actual salary as the starting point, not the grid cell value. An optional validation report shows employees whose salary doesn't match their assigned step/lane cell value.

---

## 3. The "Scenario" Mental Model

**This is the most important architectural decision in the entire application. Get this right and everything else follows.**

**A scenario is a complete, self-contained proposal for how compensation changes over the life of a contract.** It includes the increase formula for each year, for each bargaining unit, along with benefit assumptions. A scenario is what the CSBO brings to the bargaining table.

**Scenarios are per-unit within a single scenario container.** A single scenario called "Board Proposal A" can have Year 2 at +4.5% for Licensed Staff and +3.2% for ESP. This is extremely common — units negotiate separately and settle at different rates. The scenario is the container; the year configs are per-unit.

**Implementation change from the original prompt:** The `scenario_year_configs` table needs a `bargaining_unit_id` foreign key. Each row represents one year of one unit's compensation rules within a scenario. So a scenario with 3 units × 5 years = 15 `scenario_year_config` records.

```
scenario_year_configs
- id
- scenario_id (FK → scenarios)
- bargaining_unit_id (FK → bargaining_units)
- contract_year (integer)
- year_label (string)
- increase_type (enum)
- ... all the rate/formula fields ...
```

**"Apply" means locking in the official projection.** When the CSBO clicks "Apply Final Scenario," the system:

1. Marks that scenario as `status: "final"` (only one scenario can be final at a time; any previously final scenario becomes "archived")
2. Runs the full calculation engine across all employees × all years × all units
3. Generates and stores `employee_year_records` with every calculated field
4. Makes these projections available for export and reporting
5. The final scenario's projections become the "budget" numbers the district uses for financial planning

The final scenario is not just a label — it triggers a full computation pass and becomes the source of truth for exports and reports. However, it IS reversible. The CSBO can un-apply it and apply a different scenario. No data is permanently altered — the employee base records remain unchanged. Only the projection records are regenerated.

**Draft vs. Active vs. Final vs. Archived:**
- **Draft:** Scenario is being configured, not yet fully calculated
- **Active:** Scenario is complete and has been calculated, available for comparison
- **Final:** The selected/approved scenario — the one that went to the board or was ratified
- **Archived:** A previously active or final scenario that's been superseded

---

## 4. Retirement Incentive Modeling

**For v1, focus on the Illinois TRS/IMRF model.** This covers the launch market (Illinois school districts). Healthcare pension fund structures (flat employer contribution per hour to a pension fund) are a v2 feature when I expand to hospitals and municipalities.

**The retirement incentive calculator must model the FISCAL IMPACT of retirements, not just individual eligibility.** This is the feature that justifies the premium pricing tier.

Here's what the CSBO actually needs to know:

**Individual view:** For Employee X who is retirement-eligible, show all three options side by side:
- Option 1 (4-year): Their salary trajectory with 5.5% increases for 4 years, total cost to district over those 4 years, and the TRS 6% cap check
- Option 2 (2-year): Their salary trajectory with 5.5% for 2 years, plus the post-retirement bonuses ($275/yr D21 service + $1,000/yr TRS service + $2,500/yr × 4yr insurance)
- Option 3 (Longevity): The $275 × years bonus added to final year salary, with 6% cap check
- For each option: the TOTAL cost to the district including the incentive payments

**Wave analysis view:** If 12 people take the 4-year option starting in Year 1:
- Show the incremental salary cost of the 5.5% bumps across Years 1-4
- Show the salary savings starting in Year 5 when they retire and are replaced by new hires at Step 1 (configurable — what step/lane do replacements typically enter?)
- Show the NET fiscal impact: "The retirement wave costs $X in incentive payments but saves $Y over the contract period through replacement at lower salaries"
- Show the break-even year: "The district recovers the incentive cost by Year Z"

**Replacement hire assumptions should be configurable per bargaining unit:**
- Default entry step for new Licensed hires (e.g., Step 1 or Step 3 if they have prior experience)
- Default entry lane for new Licensed hires (e.g., BA or MA)
- Default hourly rate for new ESP/CM hires
- Probability distribution: "70% of replacements enter at BA Step 1, 20% at MA Step 1, 10% at MA Step 3" — for more sophisticated modeling

**Implementation:** Add a `retirement_modeling` section to the scenario builder. For each retirement-eligible employee, the CSBO can flag them as "expected to retire in Year X" and select their incentive option. The calculation engine then models their enhanced salary trajectory through retirement, removes them from the roster in their retirement year, and adds a replacement hire at the configured entry point. The reports show the delta.

---

## 5. Employee Data — What Do They Actually Have?

**CSBOs typically export employee data from their ERP/payroll system.** The most common systems in Illinois K-12 are:

- **Infinite Visions** (Tyler Technologies) — very common in Illinois
- **Skyward** — common in Midwest
- **PowerSchool** (formerly HRMS) — common nationally
- **Frontline (formerly Aesop/AESPA)** — for some HR functions
- **Custom spreadsheets** — many small districts maintain employee data in Excel

**Export formats are NOT consistent across systems.** Column headers vary wildly. One system exports "Last Name" while another exports "LNAME" while another exports "Employee Last Name." The column mapping step in the import wizard is essential and must be manual (user maps their columns to system fields). Do not try to auto-detect beyond suggesting best guesses.

**Common export fields available from most systems:**
- Employee ID/number
- First name, last name
- Hire date
- Job title / position
- Department / building
- Salary or hourly rate
- FTE (full-time equivalent)
- Bargaining unit or employee group
- Pay grade / lane / column
- Step / row
- Insurance election
- Retirement system (TRS or IMRF)

**Fields that are often missing and need manual entry:**
- Birth date (needed for retirement eligibility but sometimes not in payroll exports)
- Total years of service in other districts (TRS credit from prior employment)
- Lane placement for educational advancement tracking
- Retirement plan election (which incentive option they've chosen)

**Data sensitivity:** Employee compensation data is public record in Illinois school districts (it's disclosed in annual financial reports and is FOIA-able). Names + salaries are not confidential in the legal sense. However, treat it as sensitive for practical purposes — the SBO doesn't want this data leaking during active negotiations. For v1, basic auth protection is sufficient. Don't add export/print restrictions that would annoy the user — they need to export freely for board packets. Just ensure the deployment is password-protected.

**Import wizard priorities:**
1. CSV upload with drag-and-drop
2. Manual column mapping with suggested matches
3. Validation with clear error messages per row
4. Preview before final import
5. Year-specific import (select which contract year these employees apply to)
6. Incremental import (add employees without overwriting existing)
7. Excel (.xlsx) support as a secondary format

---

## 6. The Heatmap Feature

**The heatmap should auto-animate on page load with a 1.5-second transition between years, then pause on the final year.** The user can then manually click through years to inspect each one. Add a "Play" button that re-runs the animation. The animation is the demo moment — the SBO sees employees flowing through the matrix over the contract period, visually understanding where salary concentration shifts over time.

**Yes, the heatmap must be exportable.** Two formats:
- **PNG/SVG** for embedding in PowerPoint presentations (CSBOs build board presentation decks in PowerPoint, not in web apps)
- **PDF** as a standalone page for printing

Add an "Export Heatmap" button with format selector. The exported image should include the year label, legend, and summary statistics so it's self-contained.

**For hourly staff (ESP/CM):** Use a simpler visualization, not a full step-and-lane grid. Show a horizontal bar chart or grouped bar chart by category (Secretary, Teacher Assistant, etc.) showing:
- Number of employees per category
- Average hourly rate per category
- Total annual cost per category
- Color-coded by bargaining unit (purple for ESP, amber for CM)
- Year selector to compare across contract years

The hourly visualization doesn't need the matrix heatmap treatment because hourly staff don't have the same step-and-lane grid structure. Their compensation is simpler — it's rate × hours × increase. The visual should reflect that simplicity.

**Heatmap detail interaction:** When the user clicks a cell in the heatmap, show a popover or side panel listing the specific employees at that step/lane position with their names and salaries. This lets the SBO answer questions like "who are the 6 people at MA+30 Step 12?" instantly.

---

## 7. Comparison & Reporting

**The primary output for board/union presentations is a one-page PDF summary.** This is non-negotiable. Every school board meeting involves a packet of printed materials. The CSBO needs to hand the board a single page that shows:

- Title: "Compensation Proposal Comparison — [District Name]"
- Two or three columns, one per scenario
- Rows: Year 1 through Year 5, with total payroll, total employer cost, and year-over-year delta
- Bottom row: 5-year cumulative total for each scenario
- A single bar chart showing the cumulative cost comparison
- The dollar and percentage difference between scenarios highlighted

**Secondary output:** A multi-tab Excel workbook for the SBO's own analysis. This is the detailed backup. Tabs should include:
- Summary (mirrors the PDF)
- Per-unit detail (Licensed, ESP, CM each get their own tab)
- Per-employee detail (every employee, every year, every cost component)
- Salary schedule matrices for each year
- Assumptions (the full scenario configuration so the SBO can document what was modeled)

**For v1, both PDF and Excel exports are required.** "Export to Excel" alone is not sufficient. The PDF is what goes to the board. The Excel is what the SBO keeps for their files. Both are essential.

**The metric CSBOs care most about:** Total 5-year cost delta between proposals. That's the single number that determines whether a negotiation moves forward. "Board Proposal A costs $2.3M less than the Union Counter-Proposal over 5 years" is the sentence that wins a board vote.

**Secondary metrics they care about:**
- Year-over-year percentage increase (the board wants to know "how much are we increasing compensation by each year?")
- Average salary by unit (for benchmarking against neighboring districts)
- Cost per pupil (total compensation ÷ student enrollment — this is a common benchmark metric)
- Benefits as a percentage of total compensation (the board wants to know how much is going to benefits vs. salaries)

**Add a "cost per pupil" field to the district settings** (enter total student enrollment) so this metric can be calculated and displayed on reports.

---

## 8. Authentication & Multi-Tenancy

**Single-tenant-per-deployment is the permanent architecture for v1 through v3. This is a deliberate business decision, not a technical limitation.**

Here's why: Collective bargaining agreements are extraordinarily complex and vary wildly between districts. District 21 has CPI + 1.5% with a 3.75% cap. The next district might have a straight percentage. A third district might have a hybrid where teachers get CPI-linked increases but support staff get flat dollar increases based on a negotiated wage table. Some districts will have compensation rules that don't fit any standard model and require custom code.

**The remix-from-template model handles this perfectly:**
1. I maintain a master template in Replit with the full CollBar application
2. When a new district signs up, I fork/remix the template into a new Replit instance
3. I configure their specific bargaining units, salary schedules, and benefit rates
4. If their CBA has non-standard logic (and some will), I modify the calculation engine in their specific fork
5. Each district has their own database, their own deployment URL, and their own codebase
6. Updates to the core template can be selectively merged into customer forks

**This architecture supports custom coding per client** — which is a competitive advantage, not a limitation. When a CSBO says "our CBA has a longevity multiplier that kicks in at year 12 but only for staff hired before 2015," I don't say "sorry, not supported." I open their fork in Claude Code, add the custom logic in a few hours, and bill them a $1,500–$3,000 configuration fee. No other vendor in this market can do that.

**For v1 authentication:** Simple email/password auth with bcrypt is fine. One admin account per district. The SBO logs in, does their work, logs out. No role-based access control needed for v1. In the future, if a district wants their superintendent to have view-only access, that's a simple RBAC addition to their specific fork.

**Eventually (v4+):** I may build a multi-tenant SaaS layer on top for the long tail of small districts that don't need customization. But the premium clients — the ones paying $8,500–$12,500/year — will always be single-tenant with custom code capability.

---

## 9. CPI Data — Manual or Live Feed?

**Manual entry for v1.** The CSBO enters the CPI-U value per scenario year. This is the correct approach for several reasons:

1. **CPI values are backward-looking.** The CBA specifies "December CPI-U for All Urban Consumers released in January." The CSBO knows this value — it's published by BLS and widely reported. They don't need the app to fetch it.

2. **Scenario modeling requires hypothetical CPI values.** When modeling Year 4 of a contract that started in 2022, the CSBO is projecting what CPI might be in 2025. They enter 2.5% or 3.0% or 4.0% as assumptions. There's no live feed for future CPI values.

3. **The CPI slider in the scenario builder IS the feature.** The SBO drags the CPI slider and watches the total cost change in real time. That interactivity is more valuable than auto-fetching a static historical value.

**Regional CPI support:** Yes, add a text label field to the scenario year config for the CPI index name (e.g., "CPI-U All Urban Consumers," "CPI-U Chicago-Naperville-Elgin"). This is just a label for documentation purposes — the actual value is always manually entered. Different contracts reference different CPI indices, and the SBO needs to record which one they're using. But the calculation doesn't change — it's always the formula applied to whatever value they enter.

**Future enhancement (v2+):** Add a "Fetch Historical CPI" button that pulls actual published values from the BLS API for past years. This is a convenience feature for populating known years in a contract that's already in progress. But it's not essential for v1.

---

## 10. "Penny-Accurate" — What Does That Mean in Practice?

**This is the most important technical requirement in the entire application. Here are the exact rules:**

**Rounding rules:**
- Salary schedule cell values: round to nearest whole dollar (no cents on the schedule grid)
- Individual employee projected salary: round to nearest whole dollar
- Hourly rates: round to nearest cent (2 decimal places), using round-half-up
- Annual salary from hourly: hourly_rate × annual_hours, round to nearest cent, then round final annual to nearest whole dollar
- Employer cost components (TRS, IMRF, FICA, insurance): calculate to the cent, round each component to nearest cent, then sum
- Total employer cost: sum of all components (do NOT round the total separately — it's the sum of the rounded components)
- Scenario totals: sum all employee totals (no additional rounding)

**Order of operations for annual salary calculation:**

This is critical and must be implemented exactly:

```
For each employee, for each contract year:

1. START with prior year's salary (Year 0 = current salary from employee record)
2. APPLY step advancement: move to next step on the salary schedule
   - Look up the new cell value at (current_lane, new_step)
   - If using a schedule grid: new_base = schedule_cell_value
   - If not using a grid (individual salary model like D21): 
     new_base = prior_salary (step is just a tracker, not a lookup)
3. APPLY base increase to the new_base:
   - If fixed percentage: new_salary = new_base × (1 + rate)
   - If CPI formula: 
     effective_rate = max(floor, min(cap, cpi_value + adder))
     IF new_base >= high_earner_threshold:
       new_salary = new_base + flat_increase
     ELSE:
       new_salary = new_base × (1 + effective_rate / 100)
   - If flat dollar: new_salary = new_base + flat_amount
4. APPLY educational advancement (if applicable):
   new_salary = new_salary + advancement_amount
5. ROUND to nearest whole dollar
6. STORE as this year's salary
7. CALCULATE employer costs based on the rounded salary
```

**The order matters:** Step advancement happens BEFORE the base increase. The employee moves to their new step position, gets the cell value (or carries their salary forward), and THEN the percentage/CPI/flat increase is applied. This is how virtually all CBAs work — the step advancement and the base increase are separate actions, with step first.

**Mid-year hires and terminations:** Yes, support pro-rated salary for partial-year employment. Add an `effective_date` field to the employee record and a `termination_date` field. For employees who start mid-year or leave mid-year:

```
pro_rated_salary = annual_salary × (days_employed_in_year / total_work_days_in_year)
```

For school districts, `total_work_days_in_year` varies by bargaining unit:
- Licensed: typically 180 days
- ESP: varies by category (177–210 days per the D21 CBA)
- CM: 260 days (year-round)

Pro-rated employer costs follow the same ratio.

**For v1:** Support pro-rating on the employee import (the SBO can mark employees as partial-year). The projection engine should handle employees who enter or exit mid-contract by using the year-specific employee management feature (adding employees to Year 2, marking employees as terminated in Year 3).

**Integer arithmetic for currency:** Store all monetary values as integers representing cents in the database. Perform all calculations in cents. Convert to dollars only for display. This eliminates floating-point precision errors entirely. This is non-negotiable — floating point arithmetic WILL produce penny errors at scale, and a single penny error in a board presentation will cost me a client.

---

## 11. Tech Stack Confirmation

**The recommended stack is excellent. Confirmed with the following notes:**

- **Frontend: React + Vite (TypeScript)** — Yes. Keep it.
- **Backend: Express + PostgreSQL with Drizzle ORM** — Yes. Drizzle is fine. I don't have a strong preference for Prisma vs. Drizzle — whichever is already set up in the workspace. The ORM matters less than the schema design.
- **API layer: OpenAPI spec → auto-generated React Query hooks** — Yes, excellent. Type safety across the API boundary is important when dealing with financial calculations.
- **Charts/Heatmap: Recharts + custom heatmap component** — Yes. Recharts for bar charts, line charts, and the cost projection visualizations. The step-and-lane heatmap should be a custom component (not a Recharts chart) built with a CSS grid or HTML table with dynamic background colors. This gives full control over the cell interaction (click to see employees), the animation between years, and the export-to-image functionality.
- **Tables: TanStack Table** — Yes. The employee roster, scenario comparison, and year-over-year detail tables all need sorting, filtering, and pagination. TanStack Table handles all of this.
- **Auth: Replit Auth (simple, single-tenant)** — Yes. Simple email/password, one account per deployment.
- **File import: Papaparse (CSV) + SheetJS (Excel)** — Yes. Papaparse for CSV parsing, SheetJS for .xlsx reading. Both are well-tested libraries.
- **PDF generation:** Add **@react-pdf/renderer** or **jsPDF** for generating the board presentation PDFs. The PDF export is a critical deliverable, not an afterthought. PDFs should be clean, professional, and formatted for US Letter size printing.
- **Excel generation:** Add **ExcelJS** or **SheetJS** (write mode) for generating the multi-tab Excel exports.

**Additional libraries to consider:**
- **decimal.js** or **big.js** — for precise decimal arithmetic in the calculation engine. Even with integer-cent storage, the calculation pipeline needs a library that handles multiplication and division without floating-point drift. Use decimal.js for all salary calculations, then convert to integer cents for storage.
- **date-fns** — for date calculations (hire date, retirement eligibility, pro-rating)
- **html-to-image** — for exporting the heatmap as PNG/SVG

**Database note:** Use PostgreSQL's `NUMERIC` type for all monetary columns, not `FLOAT` or `DOUBLE`. If using Drizzle, map these to `decimal` in the schema. This ensures the database itself doesn't introduce precision errors.

---

## Summary of Key Architecture Decisions

| Decision | Answer |
|----------|--------|
| Industry scope | Any public-sector employer, but launch with K-12 |
| Multi-unit contract cycles | Yes, units can be on different contract timelines |
| Salary schedule input | Both formula-built and direct CSV/paste import |
| Off-schedule placements | Supported — employee salary stored independently of grid |
| Scenario per-unit rates | Yes, different rates per unit within one scenario |
| "Apply" meaning | Locks in final projection, generates all employee-year records, exportable |
| Retirement modeling | Illinois TRS/IMRF for v1, with wave analysis and replacement costing |
| Employee data source | Payroll system exports, manual column mapping required |
| Heatmap animation | Auto-animate on load, manual year navigation, exportable PNG/PDF |
| Primary report format | One-page PDF for board + multi-tab Excel for SBO |
| Architecture | Single-tenant, remix-from-template, custom code per client |
| CPI data | Manual entry with sliders, no live feed for v1 |
| Rounding | Integer cents in DB, round-half-up, step before base increase |
| Pro-rating | Supported for mid-year hires/terms |
| Currency precision | decimal.js for calculations, NUMERIC in Postgres, integer cents in storage |
