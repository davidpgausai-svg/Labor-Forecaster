# Output: Incremental Cost Projection Logic

## Purpose
This file defines the rules for projecting costs forward through the remaining years of a CBA and calculating the incremental (year-over-year) cost impact for both the employer and the employee. The incremental cost number is the single most important output in the entire model — it's what boards of education vote on and what union negotiators benchmark against.

## Core Concept: What Drives Cost Growth

There are exactly five drivers of year-over-year cost growth in a teacher CBA:

1. **Step advancement** — automatic, guaranteed, built into the schedule
2. **Schedule increase** — negotiated, applies to every cell in the grid
3. **Lane movement** — probabilistic, driven by teachers earning additional education
4. **Benefits trend** — insurance premium increases, typically 5-7% per year
5. **Headcount changes** — new hires, retirements, RIF, attrition

Each driver must be modeled separately so the user can see exactly where costs are coming from.

## Driver 1: Step Advancement

### Rules
- Every teacher advances exactly one step per year of completed service
- Step advancement is automatic — it is NOT contingent on performance or board approval
- A teacher at the maximum step for their lane does NOT advance further (they are "topped out")
- Step advancement happens at the START of the new contract year (typically July 1)

### Calculating Step Cost
For each employee:
```
Current salary = Schedule[current_step][current_lane]
Next year salary (step only) = Schedule[current_step + 1][current_lane]
Step increase = Next year salary - Current salary
```

If `current_step + 1` exceeds the maximum step for that lane:
```
Step increase = $0 (teacher is topped out)
```

### Aggregate Step Cost
```
Total step cost = SUM of all individual step increases
Step cost as % of payroll = Total step cost / Total current salary
```

Typical step cost for a mid-career workforce: 1.5-3.0% of total payroll.

A young workforce (many teachers at steps 1-8): Step cost will be higher because early steps often have larger dollar increases.

An aging workforce (many teachers at steps 15-23): Step cost will be lower because more teachers are topped out.

## Driver 2: Schedule Increase

### Types of Schedule Increases

**Fixed Dollar to Base**
"$2,598 added to BA Step 1" — the base is increased, and all cells are recalculated proportionally based on the schedule's index structure.

To model this:
```
New schedule = Old schedule + proportional increase based on base change
```

If the schedule uses a simple additive structure:
```
New cell value = Old cell value + $2,598 (if flat add to every cell)
```

If the schedule is index-based (each cell is a multiple of the base):
```
Index = Old cell value / Old base
New cell value = New base × Index
```

**Percentage Increase**
"3.0% increase to all cells" — every salary in the grid increases by the stated percentage.

```
New cell value = Old cell value × (1 + increase_rate)
```

**CPI-U Adjustment**
"Schedule adjusted by the prior year CPI-U" — the increase percentage is determined by the Consumer Price Index.

For projection purposes when the CPI-U is not yet known:
- Use 2.5% as conservative estimate
- Use 3.2% as moderate estimate (recent 2023-2024 actual)
- Use 4.0% as aggressive estimate
- Default to 3.0% if no guidance from user

**Combination**
Some CBAs apply a flat dollar increase to the base AND a percentage increase. Apply the dollar increase first, then the percentage.

### Schedule Increase Cost
```
Total schedule cost = SUM of (New salary - Old salary) for each employee at their NEW step
```

This is the incremental cost BEYOND what step advancement alone would produce.

## Driver 3: Lane Movement

### Probability Assumptions
Not all teachers stay in the same lane. Each year, some complete graduate coursework or earn advanced degrees and move to a higher-paying lane.

**Default assumption**: 5-8% of eligible teachers move one lane per year.

"Eligible" means they are NOT already in the highest lane of the schedule.

### How to Model
For projection purposes:
1. Identify teachers NOT in the highest lane
2. Randomly select 5-8% of them to advance one lane
3. Calculate the salary difference at their projected step in the new lane vs. old lane
4. Add this to the incremental cost

### Typical Lane Movement Cost
Lane movement typically adds 0.5-1.5% to total payroll cost per year.

For Year 4 projections (one year out), lane movement is a small factor. For multi-year projections, it compounds and becomes significant.

### When to Exclude Lane Movement
- If the user provides a specific roster with lane projections, use those instead
- If the user says "no lane movement" or "freeze lanes," set to 0%
- For single-year projections, you may simplify by noting "lane movement excluded" in Assumptions

## Driver 4: Benefits Trend

### Annual Premium Increases
Health insurance premiums increase every year. This is NOT negotiated — it's a market reality driven by healthcare cost inflation.

**Default trend factors:**
| Benefit Type | Annual Trend |
|---|---|
| Medical | 5.0-7.0% (default 5.0%) |
| Dental | 3.0-4.0% (default 3.5%) |
| Vision | 2.0-3.0% (default 2.5%) |
| Life Insurance | 0-2.0% (default 0%) |
| LTD | 2.0-4.0% (default 3.0%) |

### How Trend Applies to Employer vs. Employee

**If CBA specifies percentage sharing** (e.g., "Board pays 85%"):
```
Year 2 employer medical cost = Year 1 total premium × 1.05 × 0.85
Year 2 employee medical cost = Year 1 total premium × 1.05 × 0.15
```
Both employer and employee share the increase proportionally.

**If CBA specifies dollar cap** (e.g., "Board pays up to $15,000"):
```
Year 2 employer medical cost = MIN(Year 1 total premium × 1.05, $15,000) 
Year 2 employee medical cost = MAX(Year 1 total premium × 1.05 - $15,000, 0)
```
The employer is capped — the entire increase above the cap falls on the employee. This is a significant employee impact that should be highlighted.

### Benefits Trend Cost
```
Total benefits trend cost = Year 2 total benefits - Year 1 total benefits
```

This is typically $500-$2,000 per employee per year, or $50,000-$200,000 for a 100-person workforce.

## Driver 5: Headcount Changes

### Default Assumption
Hold headcount constant unless the user specifies otherwise.

### If User Specifies Changes
- **New hires**: Place at Step 1 in the appropriate lane. They are typically single/no dependents for benefits.
- **Retirements**: Remove from roster. These are usually topped-out, high-salary employees. Retiring a Step 23/MA+45 teacher and replacing with a Step 1/BA teacher can save $50,000+ in salary alone.
- **RIF**: Remove specified positions.
- **Attrition**: Assume 5-8% annual turnover if modeling naturally. Replace departed teachers at Step 1-3 in the same lane.

### Modeling Turnover Savings
```
Turnover savings = (Average departing salary - Average new hire salary) × Number of departures
```

Typical turnover savings: $3,000-$8,000 per replaced position if the departing teacher was above the median step.

## Projection Calculation: Putting It All Together

### For Each Remaining Contract Year

```
Projected Salary[employee] = 
    Schedule[new_step][current_or_new_lane] 
    × (1 + schedule_increase_rate)

Projected ER Cost[employee] = 
    Projected Salary
    + District-Paid Retirement (Projected Salary × EE pension rate)
    + Employer Pension (Projected Salary × ER pension rate)
    + Employer THIS/Insurance Fund (Projected Salary × THIS rate)
    + Medicare (Projected Salary × 1.45%)
    + SS (Projected Salary × 6.2%, if applicable)
    + SUTA (MIN(Projected Salary, wage_base) × SUTA rate)
    + Workers Comp (Projected Salary × WC rate)
    + Insurance ER Share (Current premiums × (1 + trend) ^ years)

Projected EE Net[employee] = 
    Projected Salary
    - EE Pension (Projected Salary × EE rate, or $0 if district-paid)
    - EE THIS (Projected Salary × THIS rate)
    - Medicare (Projected Salary × 1.45%)
    - SS (Projected Salary × 6.2%, if applicable)
    - Federal Tax (Projected Salary × effective rate)
    - State Tax (Projected Salary × state rate)
    - Insurance EE Share (Current EE premiums × (1 + trend) ^ years)

Incremental ER Cost = Projected ER Cost - Current ER Cost
Incremental EE Net = Projected EE Net - Current EE Net
```

## Multi-Year Projection Table

For CBAs with 2+ remaining years, produce a summary table:

```
                    Year 1      Year 2      Year 3      Year 4
                    (Current)   (Projected) (Projected) (Projected)
────────────────────────────────────────────────────────────────────
Total Salary        $7,680,537  $8,112,000  $8,560,000  $9,025,000
Step Cost                   —     $185,000    $192,000    $198,000
Schedule Increase           —     $245,000    $252,000    $260,000
Benefits Trend              —      $65,000     $68,000     $72,000
────────────────────────────────────────────────────────────────────
Total ER Cost      $10,457,580 $11,024,653 $11,615,000 $12,230,000
Incremental ER              —    $567,073    $590,347    $615,000
Cumulative ER               —    $567,073  $1,157,420  $1,772,420
────────────────────────────────────────────────────────────────────
Total EE Net        $5,674,545  $5,990,336  $6,315,000  $6,650,000
Incremental EE              —    $315,791    $324,664    $335,000
```

## Presentation Rules

### Always Show Both Sides
Every projection must show BOTH employer cost impact AND employee net impact. Do not present one without the other.

### Always Show Incremental AND Cumulative
- **Incremental**: The year-over-year change. "What does this cost us NEXT year?"
- **Cumulative**: The total additional cost since the base year. "What has this contract cost us OVER the full term?"

### Flag the Biggest Drivers
In the Executive Summary, explicitly call out which driver contributes the most to incremental cost. Typical ranking:
1. Schedule increase (40-50% of incremental cost)
2. Step advancement (25-35% of incremental cost)
3. Benefits trend (15-25% of incremental cost)
4. Lane movement (2-5% of incremental cost)

### Cost Multiplier
Always calculate and display the employer cost multiplier:
```
Cost Multiplier = Total Employer Cost / Total Base Salary
```
Typical range: 1.25x - 1.45x. This tells the board: "For every dollar of salary, we actually spend $1.35."

### Per-Employee Averages
Always show per-employee averages for:
- Average salary
- Average total employer cost
- Average employee net take-home
- Average incremental employer cost
- Average incremental employee net gain

These are more intuitive than aggregate numbers for board presentations.
