# Merge Patches for Existing Skill Files

## Instructions
This file contains five new sections to be merged into three existing files. Each patch includes the target file, the insertion point, and the full content to add.

---

# ═══════════════════════════════════════════════════════════
# PATCH 1: Retroactive Pay Calculations
# TARGET FILE: OUTPUT-INCREMENTAL-COST.md
# INSERT AFTER: Section "Driver 5: Headcount Changes" (after the turnover savings paragraph)
# ═══════════════════════════════════════════════════════════

## Driver 6: Retroactive Pay

### What Is Retroactive Pay?
When a CBA expires and a successor agreement is not ratified until months (or years) later, the negotiated salary increases are often applied retroactively to the expiration date of the prior contract. This creates a one-time lump-sum payment to every teacher covering the difference between what they were paid and what they should have been paid under the new terms.

Retroactive pay is NOT a raise — it is back-pay for a raise that was already agreed to but not yet implemented. However, it hits the district's budget as a single large expenditure in the ratification year.

### When to Model Retroactive Pay
Model retroactive pay when:
- The CBA has expired and negotiations are ongoing
- The user mentions "retro pay," "retroactive," or "back pay"
- The proposed effective date of salary increases is BEFORE the expected ratification date
- The CBA contains language like "increases effective retroactive to July 1"

### Calculation

#### Per-Employee Retro Pay
```
Retro Pay = (New Annual Salary - Old Annual Salary) × (Months Elapsed / 12)
```

Where:
- **New Annual Salary** = salary under the proposed new schedule (including step advancement)
- **Old Annual Salary** = salary the teacher was actually paid during the retroactive period
- **Months Elapsed** = number of months between the retroactive effective date and the expected payment date

#### Example
Teacher at Step 10/MA earning $72,000 under the old schedule.
New schedule (with 3% increase + step advancement to Step 11): $76,500.
Contract expired July 1, 2024. Ratification expected January 2025 (6 months retro).

```
Retro Pay = ($76,500 - $72,000) × (6 / 12) = $4,500 × 0.5 = $2,250
```

#### Aggregate Retro Pay
```
Total Retro Pay = SUM of individual Retro Pay amounts for all employees
```

For a 100-teacher district with an average $3,500 salary increase and 6 months retro:
```
Total Retro Pay = 100 × $3,500 × 0.5 = $175,000
```

### Tax and Retirement Impact of Retro Pay
Retroactive pay IS subject to:
- **Retirement contributions** (both employee and employer) — this is the biggest surprise. If the district pays the employee's 9% TRS, they owe 9% of the retro pay ON TOP of the retro pay itself.
- **Medicare** (1.45% each side)
- **Social Security** (6.2% each side, if applicable)
- **Federal and state income tax** — withheld at the supplemental rate (22% federal) or aggregated with regular pay
- **SUTA** — only if retro pay pushes the employee's YTD wages past the wage base for the first time (unlikely for most teachers)

Retroactive pay is NOT typically subject to:
- Workers' compensation adjustments (premiums are set annually)
- Benefits changes (insurance premiums don't retroactively adjust)

#### Total Retro Cost to Employer
```
Employer Retro Cost = Total Retro Pay
    + (Total Retro Pay × Employer Pension Rate)
    + (Total Retro Pay × Employee Pension Rate, if district-paid)
    + (Total Retro Pay × Employer Medicare Rate)
    + (Total Retro Pay × Employer SS Rate, if applicable)
    + (Total Retro Pay × THIS/Insurance Fund Rate, if applicable)
```

For Illinois with district-paid 9% TRS:
```
Employer Retro Cost = $175,000             (retro pay)
    + $175,000 × 0.0058                   (employer TRS)
    + $175,000 × 0.09                     (district-paid employee TRS)
    + $175,000 × 0.0145                   (Medicare)
    + $175,000 × 0.0067                   (THIS)
    ──────────────────────────────────────
    = $175,000 + $1,015 + $15,750 + $2,538 + $1,173
    = $195,476 total employer retro cost
```

The $175,000 in retro pay actually costs the district $195,476 — an 11.7% premium.

### Excel Presentation
Retroactive pay should be displayed as a SEPARATE line item, not folded into regular salary cost:

```
In Executive Summary:
    Retroactive Pay (6 months)           $175,000
    Retro — Employer Retirement/Tax Cost  $20,476
    TOTAL RETROACTIVE COST               $195,476

In Incremental Cost tab:
    Add columns: "Retro Pay" and "Retro ER Cost" 
    These are ONE-TIME costs — they appear in the ratification year only
    Mark with a note: "One-time retroactive payment — does not recur"
```

### Multi-Year Impact
Retro pay is a Year 1 cash flow event only. In the multi-year summary:
```
                    Year 1          Year 2      Year 3
Retro Pay           $195,476        $0          $0
Ongoing Increase    $567,073        $590,347    $615,000
TOTAL               $762,549        $590,347    $615,000
```

The Year 1 spike from retro pay often alarms boards. Always note: "Year 1 total includes one-time retroactive payment of $195,476. Ongoing annual cost is $567,073."

---

# ═══════════════════════════════════════════════════════════
# PATCH 2: One-Time Bonus Modeling
# TARGET FILE: OUTPUT-INCREMENTAL-COST.md
# INSERT AFTER: Patch 1 (Retroactive Pay) or after Driver 5 if Patch 1 is not applied
# ═══════════════════════════════════════════════════════════

## Driver 7: One-Time / Off-Schedule Bonuses

### What Are Off-Schedule Bonuses?
A one-time bonus (also called a "ratification bonus," "signing bonus," or "off-schedule payment") is a lump-sum payment to employees that does NOT add to the base salary schedule. Unlike a schedule increase, a bonus does not compound — it costs money once and then disappears.

### Why They Matter for Modeling
Bonuses are increasingly common in CBA negotiations because:
- They satisfy the union's demand for immediate cash
- They don't permanently increase the district's salary base
- They don't compound through retirement contributions the way schedule increases do
- They allow a "headline number" for the union while controlling long-term cost for the board

### Common Bonus Structures

**Flat Per-Employee Bonus**
"Each bargaining unit member shall receive a one-time payment of $2,000."
```
Total Bonus Cost = Headcount × $2,000
```

**Tiered Bonus by FTE**
"Full-time employees receive $2,000; part-time employees receive a prorated amount."
```
Total Bonus Cost = SUM of (FTE × $2,000) for each employee
```

**Tiered Bonus by Service**
"Employees with 10+ years receive $2,500; all others receive $1,500."
```
Total Bonus Cost = (Count of 10+ year employees × $2,500) + (Count of <10 year employees × $1,500)
```

**Percentage of Salary Bonus**
"Each employee shall receive a one-time payment equal to 2% of their base salary."
```
Total Bonus Cost = Total Payroll × 2%
```

### Tax and Retirement Treatment of Bonuses
One-time bonuses ARE subject to:
- **Medicare** (1.45% each side) — ALWAYS
- **Retirement contributions** — in MOST states, bonuses paid to teachers in active service are "creditable earnings" subject to pension contributions. Verify by state:
  - Illinois TRS: YES — bonuses are creditable unless explicitly excluded
  - Ohio STRS: YES — generally creditable
  - California CalSTRS: Depends on whether classified as "compensation" — usually YES
  - New York NYSTRS: YES
  - **Default assumption**: Bonuses ARE subject to retirement contributions
- **Social Security** (6.2% each side, if applicable)
- **Federal income tax** — withheld at supplemental rate (22%) or aggregated
- **State income tax**

Bonuses are generally NOT subject to:
- Workers' compensation (typically excluded from WC premium calculations)
- SUTA (usually above wage base already)

### Total Employer Cost of a Bonus
```
Employer Bonus Cost = Bonus Amount
    + (Bonus × Employer Pension Rate)
    + (Bonus × Employee Pension Rate, if district-paid)
    + (Bonus × Medicare Rate)
    + (Bonus × SS Rate, if applicable)
    + (Bonus × THIS/Insurance Fund Rate, if applicable)
```

Example — $2,000 bonus per teacher in Illinois (district pays 9% TRS):
```
$2,000 × 100 teachers = $200,000 in bonuses
+ $200,000 × 0.0058 (ER TRS)          = $1,160
+ $200,000 × 0.09   (EE TRS, dist-paid) = $18,000
+ $200,000 × 0.0145 (Medicare)         = $2,900
+ $200,000 × 0.0067 (THIS)             = $1,340
──────────────────────────────────────────────
Total employer cost of $200K in bonuses = $223,400
```

The $200,000 bonus package actually costs $223,400 — an 11.7% premium (same as retro pay premium in pension-covered states).

### Bonus vs. Schedule Increase: Cost Comparison
This is a critical analytical tool for negotiators. Show the multi-year total cost of a bonus vs. an equivalent schedule increase:

```
OPTION A: $2,000 one-time bonus
    Year 1: $223,400 (bonus + taxes/retirement)
    Year 2: $0
    Year 3: $0
    3-Year Total: $223,400

OPTION B: 2.6% schedule increase (≈$2,000 to average salary)
    Year 1: $280,000 (increase + taxes/retirement)
    Year 2: $288,000 (compounded — increase is in the base)
    Year 3: $296,000 (further compounded)
    3-Year Total: $864,000

SAVINGS FROM BONUS vs. INCREASE: $640,600 over 3 years
```

This comparison is the single most powerful analytical output for board-side negotiators.

### Excel Presentation
```
In Scenario Comparison:
    One-time bonus as a separate row
    Clearly labeled "Non-recurring — Year 1 only"
    
In Multi-Year Summary:
    Bonus appears in Year 1 only
    Year 2+ show $0 for bonus line
    
In Employee Impact:
    Show bonus as gross income
    Show bonus after deductions
    "Your $2,000 bonus nets $1,420 after deductions"
```

### Union-Side Perspective on Bonuses
Union negotiators should understand:
- A bonus does NOT increase pension benefit calculations in most states (it's one-time, not recurring salary)
- A bonus does NOT increase the base for future raises (if Year 2 is "3% increase," the 3% is on the old base, not base + bonus)
- A bonus is worth less than an equivalent schedule increase over the life of the contract
- However, a bonus puts more IMMEDIATE cash in teachers' pockets in Year 1

---

# ═══════════════════════════════════════════════════════════
# PATCH 3: Cascading Cost Effects
# TARGET FILE: OUTPUT-INCREMENTAL-COST.md
# INSERT AFTER: "Presentation Rules" section, before the end of the file
# ═══════════════════════════════════════════════════════════

## Cascading Cost Effects (Interaction Analysis)

### The Problem
When a board approves a 3% salary increase, the actual cost to the district is NOT 3% of total payroll. It's higher — because every percentage-based cost component (retirement, Medicare, SS, workers' comp) also increases by 3%. The cost cascades.

Most negotiators and board members do not intuitively understand this. The interaction analysis makes it explicit.

### The Cascade Multiplier
For any salary increase, the true employer cost is:

```
True ER Cost of Raise = Salary Increase × (1 + Cascade Rate)

Where Cascade Rate = Sum of all percentage-based employer costs:
    + Employer Pension Rate
    + Employee Pension Rate (if district-paid)
    + Employer Medicare (1.45%)
    + Employer SS (6.2%, if applicable)
    + THIS/Insurance Fund Rate (if applicable)
    + Workers' Comp Rate
```

#### Example: Illinois (District pays 9% TRS)
```
Cascade Rate = 0.0058 (ER TRS)
             + 0.09   (EE TRS, district-paid)
             + 0.0145 (Medicare)
             + 0.0067 (THIS)
             + 0.005  (Workers Comp)
             = 0.1220

True cost of a $1 raise = $1.122
True cost of a 3% salary increase = 3% × 1.122 = 3.37% of payroll
```

#### Example: Ohio (District pays 14% STRS)
```
Cascade Rate = 0.14   (ER STRS)
             + 0.14   (EE STRS, if district-paid)
             + 0.0145 (Medicare)
             + 0.005  (Workers Comp)
             = 0.2995  (if district pays EE share)
             or 0.1595 (if employee pays own share)

True cost of a 3% increase = 3% × 1.30 = 3.90% (if district pays EE) 
                           = 3% × 1.16 = 3.48% (if employee pays own)
```

#### Example: New York (SS + NYSTRS)
```
Cascade Rate = 0.10   (ER NYSTRS, approximate)
             + 0.062  (ER SS)
             + 0.0145 (Medicare)
             + 0.005  (Workers Comp)
             = 0.1915

True cost of a 3% increase = 3% × 1.19 = 3.57% of payroll
```

### Excel Presentation

#### Cost Cascade Table (add to Executive Summary or Assumptions tab)
```
COST CASCADE ANALYSIS
"What does each 1% salary increase ACTUALLY cost?"

Base salary increase (1% of payroll):               $76,805
+ Employer Retirement (×0.0058):                      $445
+ District-Paid EE Retirement (×0.09):               $6,912
+ Medicare (×0.0145):                                $1,114
+ THIS (×0.0067):                                      $515
+ Workers Comp (×0.005):                               $384
────────────────────────────────────────────────────────────
TRUE COST OF 1% SALARY INCREASE:                    $86,175
CASCADE MULTIPLIER:                                   1.122x
```

This table should be generated once and placed in the Assumptions tab and/or Executive Summary. It is a fixed calculation based on the state's rates — it doesn't change between scenarios.

#### "Headline vs. Real" Summary Row
Add to the Executive Summary:

```
Negotiated salary increase:     3.0%  (the "headline" number)
True employer cost increase:    3.37% (after cascading costs)
Difference:                     0.37% ($28,400 for 100 teachers)
```

### Why This Matters for Both Sides

**Board-side**: "When we agree to 3%, it actually costs us 3.37%. Over 3 years with compounding, a 3%/3%/3% schedule costs 12.7% more than Year 1 payroll — not 9%."

**Union-side**: "When the board says they 'can only afford 2%,' the actual salary cost is only a 2.24% budget increase. The cascade costs are money the district has to pay regardless — they're required by state law (pension, Medicare). The salary increase itself is only 2%."

---

# ═══════════════════════════════════════════════════════════
# PATCH 4: Cost Per Hour Worked
# TARGET FILE: OUTPUT-EXCEL-SPEC.md
# INSERT AFTER: Tab 1: Executive Summary → Key Metrics section
# ═══════════════════════════════════════════════════════════

### Cost Per Hour Worked

#### Formula
```
Cost Per Hour Worked = Total Amount / (Headcount × Contract Days × Hours Per Day)
```

#### Hours Per Day Assumption
Default: **7.5 hours per contract day**

This represents the teacher's required workday (typically 7:30 AM - 3:30 PM with a 30-minute unpaid lunch = 7.5 paid hours). Adjust if the CBA specifies a different workday length.

Some districts define the workday differently:
- "Teachers shall be on duty from 7:45 AM to 3:15 PM" = 7.5 hours
- "The teacher workday shall not exceed 7 hours and 40 minutes" = 7.67 hours
- "Teachers are required for 8 instructional periods of 42 minutes plus a 30-minute duty-free lunch" = calculate from specific schedule

#### Where to Display
Add a "Cost Per Hour" column or row in these locations:

**Executive Summary — Key Metrics section:**
```
Average Employer Cost Per Hour Worked     $XX.XX
Average Employee Net Take-Home Per Hour   $XX.XX
Average Gross Salary Per Hour             $XX.XX
```

**Scenario Comparison — Key Metrics section:**
```
Cost Per Hour Worked (ER)    | $62.40 | $67.10 | $64.50 | $65.80
```

**Employer Cost tab (optional column):**
Add as the final column: `=R{row}/(G{row}*hours_per_day)` where R is total ER cost and G is contract days.

#### Assumptions Tab Entry
```
Hours per contract day    | 7.5 | CBA Article [X] or default
Annual hours worked       | =Contract Days × Hours Per Day | Calculated
```

#### Why This Metric Matters
- Enables comparison with private-sector labor costs
- Enables comparison across districts with different calendar lengths (a 180-day district and a 192-day district have different hourly costs even if annual salary is the same)
- Helps board members contextualize teacher cost vs. other employees (custodians, administrators, paraprofessionals)
- Helps union negotiators compare to other professional occupations

---

# ═══════════════════════════════════════════════════════════
# PATCH 5: Work Rules with Cost Implications
# TARGET FILE: DOMAIN-CBA-INTERPRETATION.md
# INSERT AFTER: "Red Flags and Special Provisions" section, before end of file
# ═══════════════════════════════════════════════════════════

## Work Rules with Cost Implications

### Purpose
Beyond salary and benefits, CBAs contain work rules that have indirect but real cost implications. These rules can trigger additional hiring, limit scheduling flexibility, or create future financial obligations. The cost model should flag these provisions and estimate their impact where possible.

### Class Size Provisions

**What to Look For:**
- "Class size shall not exceed [N] students"
- "The district shall make reasonable efforts to maintain class sizes below [N]"
- "If class size exceeds [N], the affected teacher shall receive a stipend of $X per student per semester"

**Cost Implication:**
- Hard caps require hiring additional teachers if enrollment grows
- Stipend triggers create variable costs tied to enrollment
- Flexible ("reasonable efforts") language has no direct cost but may trigger grievances

**How to Flag:**
Note in the Assumptions tab:
```
Class Size Cap: [N] students (CBA Article [X])
Impact: If enrollment increases and pushes classes above [N], 
        additional FTE required at Step 1/[Lane] = $[salary + benefits]
        Current average class size: [if known] → headroom of [N] students
```

Do NOT model a specific cost unless the user provides enrollment projections. Instead, provide the per-FTE cost so the user can calculate if needed.

### Preparation Period Requirements

**What to Look For:**
- "Each teacher shall have a minimum of [N] preparation periods per week"
- "Preparation periods shall be at least [N] consecutive minutes"
- "If a teacher's preparation period is used for coverage, the teacher shall be compensated at $X per period"

**Cost Implication:**
- Mandatory prep periods reduce the number of classes a teacher can cover, potentially requiring more staff
- Coverage compensation creates variable costs during substitute shortages
- Prep period length affects scheduling flexibility

**How to Flag:**
```
Prep Period: [N] periods per week of [M] minutes each (CBA Article [X])
Coverage Rate: $[X] per period if prep is used for coverage
Impact: If sub shortages require prep period coverage, cost = 
        [teachers covering] × $[rate] × [occurrences/year]
```

### Duty-Free Lunch

**What to Look For:**
- "Teachers shall have a duty-free lunch period of at least [N] minutes"
- "No teacher shall be assigned supervisory duties during their lunch period"

**Cost Implication:**
- Duty-free lunch means the district must hire separate lunch supervisors (paraprofessionals or aides)
- Typical aide cost: $15-$22/hour × lunch period hours × school days
- If the CBA does not guarantee duty-free lunch, teachers can be assigned lunch duty at no additional cost

**How to Flag:**
```
Duty-Free Lunch: [N] minutes guaranteed (CBA Article [X])
Impact: District must provide lunch supervision staff
        Estimated cost: [aides] × [hourly rate] × [hours/day] × [school days]
        Not modeled in detail — note as a scheduling constraint
```

### Professional Development Days

**What to Look For:**
- "The district shall provide [N] professional development days per year"
- "PD days are in addition to student contact days"
- "Teachers attending approved PD shall be reimbursed for registration, travel, and lodging"

**Cost Implication:**
- PD days built into the calendar are already captured in contract days and salary
- PD days OUTSIDE the contract calendar require per diem pay
- PD expense reimbursement (registration, travel) is an additional cost

**How to Flag:**
```
PD Days in Calendar: [N] (already in contract day count)
PD Days Outside Calendar: [N] at per diem rate of $[daily rate]
PD Reimbursement Budget: $[amount] per teacher per year (if specified)
Impact: Out-of-calendar PD cost = [teachers] × [days] × [daily rate]
```

### Planning Time / Collaboration Time

**What to Look For:**
- "Teachers shall have [N] hours per week of collaborative planning time"
- "Early release days for professional collaboration on the first Wednesday of each month"

**Cost Implication:**
- Early release days reduce instructional time but don't change teacher salary
- If the district must provide alternative student supervision during early release, that's an additional cost
- Structured planning time during the school day may affect class scheduling and staffing ratios

### Seniority and Transfer Rights

**What to Look For:**
- "Involuntary transfers shall be based on seniority"
- "Teachers with [N]+ years of service shall have priority in building assignment"

**Cost Implication:**
- Not directly financial, but seniority-based transfers can result in high-salary teachers concentrated in popular buildings, creating per-building budget imbalances
- May limit the district's ability to place cost-effective staff where needed

**How to Flag:**
Note as a non-quantified provision: "Seniority-based transfer provisions may affect building-level budget allocations."

### Summary: Work Rules Cost Impact Table
Add to the Assumptions tab when relevant:

```
WORK RULES WITH COST IMPLICATIONS
Provision                    | CBA Reference | Direct Cost | Notes
Class Size Cap (28 students) | Art. 12.3     | Variable    | Triggers hiring if exceeded
Prep Period Coverage Rate    | Art. 8.5      | $45/period  | Est. $12,000-$18,000/year district-wide
Duty-Free Lunch              | Art. 8.2      | Supervision | Not modeled — scheduling constraint
PD Outside Calendar          | Art. 15.1     | $[X]/year   | [N] teachers × [N] days × daily rate
Early Release Days           | Art. 7.4      | Supervision | [N] days/year — alt supervision needed
```
