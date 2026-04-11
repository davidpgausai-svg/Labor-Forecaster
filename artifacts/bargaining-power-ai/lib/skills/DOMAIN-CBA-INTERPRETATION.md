# Domain: CBA Interpretation Rules

## Purpose
This file teaches you how to read and extract structured data from a K-12 collective bargaining agreement (CBA). CBAs are dense legal documents with inconsistent formatting. Your job is to find the compensation-relevant provisions and extract them into structured data the cost model can consume.

## Salary Schedule Extraction

### Identifying the Salary Schedule
The salary schedule is almost always in an appendix (Appendix A, Exhibit A, Schedule A, or similar). Search for these terms:
- "Salary Schedule" / "Compensation Schedule" / "Pay Schedule"
- "Steps and Lanes" / "Step and Lane"
- "Appendix A" / "Schedule A" / "Exhibit A"
- Column headers containing "BA", "MA", "BS", "MS", "PhD", "Doctorate"

### Schedule Structure
A salary schedule is a 2D grid:
- **Rows = Steps** (years of experience/service). Step 1 is a first-year teacher. Steps typically range from 1-20 or 1-30. Some schedules use Step 0 for interns.
- **Columns = Lanes** (education level). Common lane labels:

| Lane Label | Meaning |
|---|---|
| BA / BS | Bachelor's degree only |
| BA+15 / BS+15 | Bachelor's + 15 graduate credit hours |
| BA+30 / BS+30 | Bachelor's + 30 graduate credit hours |
| MA / MS | Master's degree |
| MA+15 / MS+15 | Master's + 15 additional credits |
| MA+30 / MS+30 | Master's + 30 additional credits |
| MA+45 / MS+45 | Master's + 45 additional credits |
| MA+60 / MS+60 | Master's + 60 additional credits |
| EdS / CAS | Educational Specialist / Certificate of Advanced Study |
| PhD / EdD / Doctorate | Doctoral degree |

### Lane Variations You Will Encounter
- Some districts use "Group" numbers instead of degree labels (e.g., LAUSD uses Group 20 = BA, Group 23 = MA)
- Some districts use credit-hour counts (e.g., Lane I = 0-30 credits, Lane II = 31-60 credits)
- Some districts combine degree + credits (e.g., "BA/60" means a BA with 60 graduate hours, equivalent to an MA in some systems)
- Some schedules have "off-schedule" rates for teachers who have maxed out steps — look for language like "longevity" or "career increment"

### Schedule Caps and Limits
- Not all lanes have the same number of steps. BA lanes often cap at step 10-15 while MA+ lanes go to step 20-25+
- When a cell in the grid is blank or marked with a dash, that step/lane combination does not exist
- Some schedules have "frozen" steps where no additional increase occurs

### Extracting Dollar Amounts
- Always extract the ANNUAL salary, not monthly or daily
- If the schedule shows daily rates, multiply by contract days to get annual
- If multiple schedules exist for different contract years, extract ALL of them
- Watch for footnotes that modify the schedule (e.g., "$2,598 added to base" or "3% increase over prior year")

## Contract Term Extraction

### What to Find
- **Duration**: "This agreement shall be effective from [date] through [date]"
- **Number of years**: Typically 1-5 years. Most common is 3-4 years.
- **Contract year**: The fiscal year for schools usually runs July 1 - June 30
- **Reopener clauses**: Some multi-year contracts allow salary reopening in specific years

### How to Identify Current Contract Year
Look for:
- "For the [year] school year" in salary schedule headers
- Effective dates in article headers
- Ratification dates in signatures
- Publication dates on the document

## Calendar Days Extraction

### Standard Contract Day Types
| Day Count | Typical Assignment |
|---|---|
| 180-185 | Standard classroom teacher |
| 187-190 | Teacher with additional planning/PD days |
| 192-200 | Counselors, department heads, specialists |
| 205-210 | Year-round or extended-year positions |
| 220-230 | Administrative support, 11-month positions |
| 248-260 | 12-month / full-year positions |

### Where to Find Calendar Days
- Article on "Work Year" / "School Calendar" / "Teacher Work Days"
- The CBA may define multiple calendars (e.g., "A Basis" = 187 days, "B Basis" = 192 days, "C Basis" = 205 days)
- If not specified, default to 185 days for standard teachers

## Salary Increase Methodology

### Types of Increases
1. **Flat dollar to base**: "$2,598 added to BA Step 1" — this shifts the entire schedule up
2. **Percentage increase**: "3.5% increase to all cells" — every salary in the grid goes up by this percentage
3. **CPI-U adjustment**: "Schedule adjusted by CPI-U as published by [agency]" — tied to inflation index
4. **Step advancement**: Not a "raise" per se — automatic movement to the next row. This happens even when the schedule itself is frozen.
5. **Combination**: Some CBAs use a base increase PLUS step advancement PLUS CPI-U

### Critical Distinction: Schedule Increase vs. Step Increase
- **Schedule increase** = the grid itself changes (every cell gets bigger). This is what the union negotiates.
- **Step increase** = the teacher moves down one row on the same grid. This is automatic per the CBA.
- **Total increase** = schedule increase + step increase. This is what actually hits the teacher's paycheck and the district's budget.

Always model BOTH. Boards of education often underestimate total cost because they only focus on the schedule increase percentage.

## Benefits Provisions

### Health Insurance
Look for these provisions in the "Insurance" or "Benefits" article:
- **Plan types offered**: PPO, HMO, HDHP/HSA, POS
- **Tier structure**: Single, Employee+Spouse, Employee+Child(ren), Family
- **Premium sharing**: What percentage does the district pay vs. the employee?
  - Common patterns: District pays 85-95% of single, 75-90% of family
  - Some districts cap at a dollar amount (e.g., "District contribution shall not exceed $18,000 per employee per year")
  - Some districts pay 100% of single and a percentage of dependent coverage
- **HSA contributions**: If HDHP is offered, does the district contribute to the HSA? How much?

### Dental and Vision
- Often a separate provision from medical
- District commonly pays 90-100% of single, 50-90% of family
- Some districts bundle dental/vision into the medical premium sharing formula

### Life Insurance
- Typically district-paid, $25,000-$50,000 coverage
- Some CBAs allow employees to purchase additional coverage at group rates

### Disability
- Short-term disability (STD): Often covered by sick leave bank, not a separate policy
- Long-term disability (LTD): District-paid, typically 60% of salary after 90-180 day elimination period

### Retirement / Pension
See `DOMAIN-RETIREMENT-SYSTEMS.md` for details, but in the CBA look for:
- "The Board shall pay the employee's [X]% TRS/STRS contribution"
- "The employee's retirement contribution shall be [sheltered/picked up/paid by] the Board"
- References to specific pension systems (TRS, STRS, PERS, CalSTRS, CalPERS, etc.)

## Stipend Schedules

### What to Extract
Stipends are additional compensation for extra-duty assignments. They are typically structured as either:
- A flat dollar amount (e.g., "Head Football Coach: $8,500")
- A percentage of a base (e.g., "Grade 1 = 14% of BA Step 1")
- A separate step/year grid (similar to the salary schedule but for stipend amounts)

### Common Stipend Categories
- Athletic coaching (head coach, assistant, freshman, JV)
- Activity sponsors (yearbook, newspaper, drama, academic teams)
- Department heads / team leaders
- Curriculum coordinators
- Mentoring / new teacher induction
- Extended contracts (summer school, before/after school programs)
- National Board Certification bonus

### Modeling Stipends
For the cost model, stipends are ADDITIONAL to base salary. They are subject to:
- TRS/STRS contributions (both employee and employer)
- Medicare tax
- They are NOT typically counted for health insurance calculations
- They ARE typically counted for retirement benefit calculations

## Red Flags and Special Provisions

### Watch For
- **Salary freezes**: "No step advancement in year 2" — means step cost is zero that year
- **Off-schedule bonuses**: One-time payments that don't add to base salary
- **Retroactive pay**: "Increases effective retroactive to July 1" — impacts cash flow timing
- **Sunset clauses**: Provisions that expire within the contract term
- **Me-too clauses**: "If any other bargaining unit receives a larger increase, this unit shall receive the same"
- **Reduction in force (RIF) language**: Impacts headcount projections
- **Class size provisions**: May trigger additional hiring requirements
- **Preparation time requirements**: May limit scheduling flexibility
