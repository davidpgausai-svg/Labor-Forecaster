# Domain: CBA Interpretation Rules

## Purpose
This file teaches you how to read and extract structured data from a collective bargaining agreement (CBA). CBAs are dense legal documents with inconsistent formatting. Your job is to find the compensation-relevant provisions and extract them into structured data the cost model can consume.

This file covers two CBA types:
1. **K-12 school district CBAs** — step/lane salary schedules, school calendar days, teacher-specific provisions
2. **Healthcare and private-sector union CBAs** — experience-tier rate tables, multi-employer fund contributions, Taft-Hartley benefit structures

Identify the sector before extracting. The wage structure and benefit architecture differ fundamentally between the two.

---

## PART 1: K-12 SCHOOL DISTRICT CBAs

### Salary Schedule Extraction

#### Identifying the Salary Schedule
The salary schedule is almost always in an appendix (Appendix A, Exhibit A, Schedule A, or similar). Search for these terms:
- "Salary Schedule" / "Compensation Schedule" / "Pay Schedule"
- "Steps and Lanes" / "Step and Lane"
- "Appendix A" / "Schedule A" / "Exhibit A"
- Column headers containing "BA", "MA", "BS", "MS", "PhD", "Doctorate"

#### Schedule Structure
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

#### Lane Variations You Will Encounter
- Some districts use "Group" numbers instead of degree labels (e.g., LAUSD uses Group 20 = BA, Group 23 = MA)
- Some districts use credit-hour counts (e.g., Lane I = 0-30 credits, Lane II = 31-60 credits)
- Some districts combine degree + credits (e.g., "BA/60" means a BA with 60 graduate hours, equivalent to an MA in some systems)
- Some schedules have "off-schedule" rates for teachers who have maxed out steps — look for language like "longevity" or "career increment"

#### Schedule Caps and Limits
- Not all lanes have the same number of steps. BA lanes often cap at step 10-15 while MA+ lanes go to step 20-25+
- When a cell in the grid is blank or marked with a dash, that step/lane combination does not exist
- Some schedules have "frozen" steps where no additional increase occurs

#### Extracting Dollar Amounts
- Always extract the ANNUAL salary, not monthly or daily
- If the schedule shows daily rates, multiply by contract days to get annual
- If multiple schedules exist for different contract years, extract ALL of them
- Watch for footnotes that modify the schedule (e.g., "$2,598 added to base" or "3% increase over prior year")

### Contract Term Extraction

#### What to Find
- **Duration**: "This agreement shall be effective from [date] through [date]"
- **Number of years**: Typically 1-5 years. Most common is 3-4 years.
- **Contract year**: The fiscal year for schools usually runs July 1 - June 30
- **Reopener clauses**: Some multi-year contracts allow salary reopening in specific years

#### How to Identify Current Contract Year
Look for:
- "For the [year] school year" in salary schedule headers
- Effective dates in article headers
- Ratification dates in signatures
- Publication dates on the document

### Calendar Days Extraction

#### Standard Contract Day Types
| Day Count | Typical Assignment |
|---|---|
| 180-185 | Standard classroom teacher |
| 187-190 | Teacher with additional planning/PD days |
| 192-200 | Counselors, department heads, specialists |
| 205-210 | Year-round or extended-year positions |
| 220-230 | Administrative support, 11-month positions |
| 248-260 | 12-month / full-year positions |

#### Where to Find Calendar Days
- Article on "Work Year" / "School Calendar" / "Teacher Work Days"
- The CBA may define multiple calendars (e.g., "A Basis" = 187 days, "B Basis" = 192 days, "C Basis" = 205 days)
- If not specified, default to 185 days for standard teachers

### Salary Increase Methodology (K-12)

#### Types of Increases
1. **Flat dollar to base**: "$2,598 added to BA Step 1" — this shifts the entire schedule up
2. **Percentage increase**: "3.5% increase to all cells" — every salary in the grid goes up by this percentage
3. **CPI-U adjustment**: "Schedule adjusted by CPI-U as published by [agency]" — tied to inflation index
4. **Step advancement**: Not a "raise" per se — automatic movement to the next row. This happens even when the schedule itself is frozen.
5. **Combination**: Some CBAs use a base increase PLUS step advancement PLUS CPI-U

#### Critical Distinction: Schedule Increase vs. Step Increase
- **Schedule increase** = the grid itself changes (every cell gets bigger). This is what the union negotiates.
- **Step increase** = the teacher moves down one row on the same grid. This is automatic per the CBA.
- **Total increase** = schedule increase + step increase. This is what actually hits the teacher's paycheck and the district's budget.

Always model BOTH. Boards of education often underestimate total cost because they only focus on the schedule increase percentage.

### Benefits Provisions (K-12)

#### Health Insurance
Look for these provisions in the "Insurance" or "Benefits" article:
- **Plan types offered**: PPO, HMO, HDHP/HSA, POS
- **Tier structure**: Single, Employee+Spouse, Employee+Child(ren), Family
- **Premium sharing**: What percentage does the district pay vs. the employee?
  - Common patterns: District pays 85-95% of single, 75-90% of family
  - Some districts cap at a dollar amount (e.g., "District contribution shall not exceed $18,000 per employee per year")
  - Some districts pay 100% of single and a percentage of dependent coverage
- **HSA contributions**: If HDHP is offered, does the district contribute to the HSA? How much?

#### Dental and Vision
- Often a separate provision from medical
- District commonly pays 90-100% of single, 50-90% of family
- Some districts bundle dental/vision into the medical premium sharing formula

#### Life Insurance
- Typically district-paid, $25,000-$50,000 coverage
- Some CBAs allow employees to purchase additional coverage at group rates

#### Disability
- Short-term disability (STD): Often covered by sick leave bank, not a separate policy
- Long-term disability (LTD): District-paid, typically 60% of salary after 90-180 day elimination period

#### Retirement / Pension
See `DOMAIN-RETIREMENT-SYSTEMS.md` for details, but in the CBA look for:
- "The Board shall pay the employee's [X]% TRS/STRS contribution"
- "The employee's retirement contribution shall be [sheltered/picked up/paid by] the Board"
- References to specific pension systems (TRS, STRS, PERS, CalSTRS, CalPERS, etc.)

### Stipend Schedules (K-12)

#### What to Extract
Stipends are additional compensation for extra-duty assignments. They are typically structured as either:
- A flat dollar amount (e.g., "Head Football Coach: $8,500")
- A percentage of a base (e.g., "Grade 1 = 14% of BA Step 1")
- A separate step/year grid (similar to the salary schedule but for stipend amounts)

#### Common Stipend Categories
- Athletic coaching (head coach, assistant, freshman, JV)
- Activity sponsors (yearbook, newspaper, drama, academic teams)
- Department heads / team leaders
- Curriculum coordinators
- Mentoring / new teacher induction
- Extended contracts (summer school, before/after school programs)
- National Board Certification bonus

#### Modeling Stipends
For the cost model, stipends are ADDITIONAL to base salary. They are subject to:
- TRS/STRS contributions (both employee and employer)
- Medicare tax
- They are NOT typically counted for health insurance calculations
- They ARE typically counted for retirement benefit calculations

---

## PART 2: HEALTHCARE AND PRIVATE-SECTOR UNION CBAs

### Wage Structure: Experience Tiers vs. Steps

Healthcare and private-sector CBAs use **experience tiers** rather than discrete numbered steps. This is a critical structural difference from K-12.

#### How Experience Tiers Work
Instead of "Step 1, Step 2, Step 3...", the wage schedule shows bands like:
- "0-2 Years" / "2-5 Years" / "5-10 Years" / "10-15 Years" / "15+ Years"

Each band has a minimum weekly or hourly rate. Employees advance automatically when they cross the experience threshold.

**Key modeling implications:**
- There is no "topped out" equivalent in the K-12 sense — the highest tier (e.g., "15+ Years") applies to all employees beyond that threshold indefinitely
- Experience advancement cost is embedded in the tier distribution, not modeled as a separate "step cost"
- When projecting forward, advance each employee to the next tier when their tenure crosses the threshold

#### Rate Table Structure for Healthcare CBAs
The rate table is typically found in the body of the CBA (often Article X: Wages and Minimums) or attached as a schedule. It is usually formatted as:

```
CLASSIFICATION    EXP. TIER    HIRING RATE    MINIMUM RATE
[Title]           0-2 Years    $XXX.XX/wk     $XXX.XX/wk
[Title]           2-5 Years    $XXX.XX/wk     $XXX.XX/wk
```

Extract BOTH the hiring rate and the minimum rate for each cell. The minimum rate applies after the hiring period.

#### Weekly vs. Annual Rates
Healthcare CBAs almost always express wages as **weekly rates**. Convert to annual:
```
Annual Salary = Weekly Rate × 52
```
Do NOT use 50 or 51 weeks — 52 is the standard for weekly-paid union workers in this sector.

#### Hiring Rate Differential
Many healthcare CBAs include a below-minimum hiring rate for new employees during their first year:
- "Employees hired on and after [date] shall receive, during the first year of employment, a base weekly rate which is [X]% less than the minimum weekly rate."
- This typically steps up to the full minimum after 12 months and/or after the probationary period
- Model new hires at the hiring rate, not the minimum rate, for Year 1 cost accuracy

### Wage Increases in Healthcare CBAs
Multi-year healthcare CBAs typically specify across-the-board percentage increases effective on each contract anniversary date. The increase applies to BOTH the minimum rates AND the step minimum rates (experience tier minimums).

Extract the increase for each contract year:
- "Effective October 1, 2021: 2% increase to all rates"
- "Effective October 1, 2022: 3% increase to all rates"

These are applied to the entire rate table, not just the base. Verify whether the CBA says "all cells" or "base only" — in healthcare CBAs it almost always means all cells.

### Longevity Increases
Some healthcare CBAs add separate longevity payments for specific job classes at service milestones:
- "Nursing Attendants with 10+ years of service shall receive an additional $10/week"
- "20+ years: additional $10/week (total $20/week above base)"

Model longevity separately from the experience tier structure. Apply to the appropriate job classifications based on years of service in the roster.

### Fund Contribution Extraction

This is the most important extraction step for healthcare CBAs and the one most commonly missed. A healthcare CBA often contains 4-6 separate articles, each requiring a distinct employer contribution. **Read every article**, not just the benefits article.

#### Required Fund Articles to Find

| Fund | Look For | Typical Rate |
|---|---|---|
| Health/Benefit Fund | "National Benefit Fund," "NBF," "health and welfare fund," "Required Contribution Rate (RCR)" | PMPY flat rate or % of wages |
| Pension Fund | "Pension Fund," "PF," retirement contributions | % of gross payroll |
| Training Fund | "Training and Upgrading Fund," "TUF," workforce development | % of gross payroll |
| Job Security Fund | "JSF," "Employment Security Fund," layoff protection | % of gross payroll |
| Child Care Fund | "CCF," child care contributions | % of gross payroll |
| Labor-Management Fund | "LMI," "LMIF," joint committee fund | Usually diverted from other funds |

#### Critical: "Diversion" Language
Watch for articles that redirect contributions between funds. Language like "contributions to the JSF shall be diverted to the TUF as provided in Exhibit [X]" means the JSF contribution flows to a different fund — the employer's total obligation is unchanged but affects fund-level accounting.

#### JSF Balance Cap
A common provision: JSF contributions stop when the fund balance reaches a cap (e.g., $5 million) and resume when it falls below a floor. In multi-year projections, note this contingency. Model at full rate as a conservative default.

#### Contribution Base
For percentage-of-payroll funds, always verify what's included in the base:
- "Exclusive of amounts earned by Employees during the first two (2) months following the beginning of their employment" — new hire wages are excluded for the first 60 days
- Some funds exclude overtime; others include it. If unclear, include overtime in the base (conservative assumption)

### Benefits Article Extraction (Healthcare/Taft-Hartley)

Unlike K-12 where the CBA specifies plan tiers and premium sharing, a Taft-Hartley benefits article specifies the employer's contribution obligation to the fund. Extract:

1. **Contribution type**: PMPY flat rate ("WC I") vs. percentage of wages ("WC II/III") vs. both
2. **Rate schedule**: Rates for each contract year (usually presented as a table)
3. **Which employees are covered**: Some CBAs have different rates for different wage classes or employment types
4. **Employee premium obligation**: In properly funded Taft-Hartley arrangements, this should be $0
5. **What the fund covers**: Medical, dental, disability, death benefits, PFL — document what's included so the model can properly show $0 employee deductions

**Key phrase that confirms zero employee premium:** "The NBF will... provide comprehensive health benefits in a cost-effective manner, and when fully operational, at no costs to covered Employees and their eligible dependents."

**Disability provision:** Look for language like "The NBF will provide disability benefits... In view of the assumption of this obligation by the NBF, the Employer agrees not to make any deductions from the covered Employees' wages on account of disability benefits." This means the employer does NOT deduct state disability insurance from wages — the fund covers it.

### Hours and Work Year (Healthcare)
Healthcare workers are typically full-time at 35, 37.5, or 40 hours/week depending on the institution. The CBA's Hours article will specify:
- "The regular work week for all full-time Employees shall consist of the number of hours per week regularly worked as of [date]"
- Standard pay period is weekly
- Overtime rules: typically time-and-a-half after 40 hours/week (FLSA minimum) with some CBAs requiring daily OT after 8 hours

For cost modeling purposes, model base compensation only (weekly rate × 52). Note that shift differentials, overtime, on-call pay, and preceptor pay are excluded from the base model.

### Specialty Pay Provisions (Healthcare)
Healthcare CBAs often include additional pay provisions beyond base salary. These are NOT included in minimum rate tables. Extract separately:

- **Shift differentials**: Evening/night premiums, typically $1-$5/hour above base
- **Weekend differentials**: Saturday/Sunday premium pay
- **On-call pay**: "Three-quarter (3/4) pay for off-premises on-call hours"
- **Preceptor pay**: "Additional $2.00/hour for hours actually spent precepting" — paid when a clinical employee trains others in new modalities
- **Contrast dye differential**: $2.00/hour for imaging techs who perform contrast injections
- **Professional development days**: 2 paid days/year for licensed/certified staff requiring continuing education

For budget modeling: note these in Assumptions as "excluded from base cost model" and flag that total compensation is higher than the modeled base.

---

## PART 3: UNIVERSAL EXTRACTION RULES (All CBAs)

### Contract Term
- **Duration**: "This agreement shall be in full force and effect for the period commencing [date] and ending [date]"
- **Healthcare fiscal year**: Often October 1 – September 30 (vs. July 1 – June 30 for schools)
- **Reopener clauses**: Provisions allowing mid-term renegotiation of specific articles

### Wage Increases — Universal Checklist
- [ ] Year 1 effective date and percentage/dollar amount
- [ ] Year 2 effective date and percentage/dollar amount
- [ ] Year 3+ (if multi-year)
- [ ] Does the increase apply to ALL rates or base only?
- [ ] Are there any one-time lump sum payments (non-recurring, non-pensionable)?
- [ ] CPI-U or other index-linked components?
- [ ] Any ratification bonus?

### Lump Sum / One-Time Payments
These appear in both K-12 and healthcare CBAs as pandemic bonuses, ratification bonuses, or cost-of-living adjustments:
- "Each full-time Employee shall receive a lump sum recognition payment of $3,000"
- Key extraction: Is this added to base? (Almost always NO — "shall not be considered as pay for any purpose")
- Lump sums do NOT increase future-year cost (no compounding effect)
- They are NOT subject to pension fund contributions (verify — some CBAs specify this explicitly)
- They ARE subject to regular payroll taxes (SS, Medicare, federal/state income tax)
- For the cost model: show as a one-time cost item, clearly labeled, not included in base salary projections

### Red Flags and Special Provisions (All CBAs)

#### Watch For in K-12
- **Salary freezes**: "No step advancement in year 2" — means step cost is zero that year
- **Off-schedule bonuses**: One-time payments that don't add to base salary
- **Retroactive pay**: "Increases effective retroactive to July 1" — impacts cash flow timing
- **Sunset clauses**: Provisions that expire within the contract term
- **Me-too clauses**: "If any other bargaining unit receives a larger increase, this unit shall receive the same"
- **Reduction in force (RIF) language**: Impacts headcount projections
- **Class size provisions**: May trigger additional hiring requirements

#### Watch For in Healthcare/Private Sector
- **Recognition pay trigger**: Some CBAs allow the union to demand bargaining over hazard pay during declared public health emergencies — creates contingent cost exposure
- **Rate adjustment rights**: Union may trigger local bargaining for professional/technical titles if recruitment and retention problems are demonstrated — potential mid-contract cost escalation
- **JSF balance trigger**: JSF contributions may stop if fund balance hits a cap — reduces annual employer cost in high-balance years
- **Pension diversion**: Pension contributions may be temporarily redirected to the benefit fund — no net cost change but affects fund accounting
- **New job classification notice**: Employer must give 30 days notice before creating new classifications; union has right to bargain over the rate
- **Contribution base exclusions**: First-month or two-month wages of new hires often excluded from fund contribution calculations — reduces cost slightly in high-turnover environments
