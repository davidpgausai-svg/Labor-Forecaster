# Domain: Leave Costs and Substitute Expenditure Modeling

## Purpose
This file defines how to calculate the true cost of contractual leave provisions in a K-12 CBA. Leave costs are the most commonly omitted line item in school district labor cost models — yet they represent $1,000-$2,500 per employee per year in direct substitute expenditure alone, and potentially tens of thousands per employee in accumulated sick leave liability at retirement.

There are two distinct cost categories:
1. **Annual substitute cost** — the district's out-of-pocket cost to cover teacher absences
2. **Accumulated sick leave liability** — the district's long-term financial obligation for unused sick days that can be cashed out at retirement or separation

Both must be modeled to give a complete picture of total cost of employment.

## Annual Leave Provisions in CBAs

### Types of Leave to Extract from the CBA

| Leave Type | Typical CBA Provision | Requires Sub? | Typical Usage Rate |
|---|---|---|---|
| Sick Leave | 10-15 days/year, cumulative | Yes | 65-85% of allocation |
| Personal Leave | 2-4 days/year | Yes | 80-95% of allocation |
| Bereavement | 3-5 days per occurrence | Yes | ~0.5 days/employee/year avg |
| Professional Development | 2-5 days/year (district-directed) | Sometimes | 100% (district-scheduled) |
| Jury Duty | As needed, full pay | Yes | ~0.2 days/employee/year avg |
| Military Leave | Per federal/state law | Yes | Negligible for most districts |
| Association/Union Leave | 1-5 days/year (some paid by union) | Yes | Varies — often union-reimbursed |
| Family Medical Leave (FMLA) | Up to 12 weeks unpaid (federal) | Yes (if sub needed) | Model separately if data available |
| Sabbatical | Semester/year at partial pay | No (position filled) | Rare — 0-2 per year district-wide |

### Where to Find Leave Provisions in the CBA
- Article on "Leaves of Absence" / "Leave Provisions" / "Absences"
- Separate articles for each leave type (Sick Leave, Personal Leave, etc.)
- Sometimes in "Working Conditions" or "Terms of Employment"
- Accumulation/carryover rules are often in the Sick Leave article
- Cash-out provisions may be in "Retirement" or "Separation" articles

### Default Leave Assumptions When CBA is Silent
If the CBA does not specify leave allocations, use these defaults:
- Sick leave: 12 days/year
- Personal leave: 3 days/year
- Bereavement: 3 days/occurrence (estimate 0.5 days/employee/year)
- Professional development: 3 days/year (district-paid, no sub if building-wide)
- Total days requiring a substitute: ~12 days/employee/year

## Substitute Teacher Costs

### Daily Substitute Rates by Region (2024-25)

| Region | Daily Sub Rate (Non-Certified) | Daily Sub Rate (Certified) | Long-Term Sub Rate |
|---|---|---|---|
| Rural / Low-Cost | $90-$120 | $110-$140 | $150-$200 |
| Suburban / Mid-Cost | $120-$160 | $140-$180 | $180-$250 |
| Urban / High-Cost | $150-$200 | $180-$250 | $220-$300 |
| National Average | $130 | $160 | $200 |

### Default Substitute Rate
Use $150/day unless:
- The user specifies a rate
- The CBA specifies a substitute pay rate
- Regional data suggests a different rate

### Annual Substitute Cost Calculation

#### Per-Employee Formula
```
Annual Sub Cost[employee] = 
    (Sick Days Used + Personal Days Used + Bereavement Days + Other Sub-Required Days)
    × Daily Substitute Rate
```

#### Estimating Days Used vs. Days Allocated
Teachers do NOT use 100% of their allocated leave. Use these usage rates:

| Leave Type | Days Allocated | Usage Rate | Days Used (Default) |
|---|---|---|---|
| Sick Leave | 12 | 70% | 8.4 |
| Personal Leave | 3 | 85% | 2.6 |
| Bereavement | per occurrence | — | 0.5 (avg) |
| Other | varies | — | 0.5 (avg) |
| **Total** | — | — | **12.0 days/year** |

#### Aggregate Formula
```
Total Annual Sub Cost = Headcount × Average Days Used × Daily Sub Rate
```

Example for 100 teachers:
```
100 teachers × 12 days × $150/day = $180,000/year
```

### Sub Cost Per Teacher vs. Actual Teacher Daily Rate
An important insight for board presentations: the substitute costs LESS than the teacher being replaced, but the district pays BOTH — the teacher's salary continues while the sub is also paid.

```
True Absence Cost = Teacher Daily Salary (already paid) + Substitute Daily Rate
Net Additional Cost = Substitute Daily Rate only (teacher salary is sunk cost)
```

For the cost model, only the substitute rate is the INCREMENTAL cost of leave. The teacher's salary is already captured in the salary schedule.

### How Leave Costs Change Year-Over-Year
- Substitute rates typically increase 2-4% annually (track local market)
- Usage rates tend to be stable unless CBA changes incentivize/disincentivize usage
- Headcount changes directly affect total sub cost
- Default trend for sub rates: 3.0% annual increase

### Leave Cost Interaction with CBA Proposals
When comparing scenarios, leave costs can change if:
- A proposal adds/removes personal days
- A proposal adds professional development days requiring subs
- A proposal changes calendar days (more contract days = more potential sick days)
- A proposal introduces attendance incentives (cash bonus for unused sick days)

## Accumulated Sick Leave Liability

### What Is It?
Most CBAs allow teachers to accumulate unused sick days year over year, often with no cap or a very high cap (200-300+ days). When a teacher retires or separates, many CBAs provide a cash-out of some portion of accumulated sick days.

This creates a long-term financial liability for the district that grows every year a teacher doesn't use their sick days.

### Common Cash-Out Provisions

**Pattern 1: Fixed Rate Per Day**
"Upon retirement, employees shall receive $75 per day for each unused accumulated sick day, up to a maximum of 200 days."
```
Cash-Out = MIN(Accumulated Days, 200) × $75
Maximum liability per teacher = 200 × $75 = $15,000
```

**Pattern 2: Percentage of Daily Rate**
"Upon retirement with 15+ years of service, employees shall receive 50% of their current daily rate for each accumulated sick day, up to 180 days."
```
Daily Rate = Annual Salary / Contract Days
Cash-Out = MIN(Accumulated Days, 180) × Daily Rate × 50%
```
For a teacher earning $85,000 on 185 days:
```
Daily Rate = $85,000 / 185 = $459.46
Cash-Out = 180 × $459.46 × 0.50 = $41,351
```

**Pattern 3: Contribution to Retiree Health Insurance**
"Unused sick days shall be converted to months of employer-paid retiree health insurance at a rate of 15 days = 1 month of coverage."
```
Months of Coverage = Accumulated Days / 15
Cash-Out Value = Months × Monthly Retiree Premium
```

**Pattern 4: Service Credit**
"Unused sick days shall be credited toward retirement service time at a rate set by [TRS/STRS]."
- This has no direct cash cost to the district but does affect the pension system
- Note in Assumptions but do NOT include as a district cost

**Pattern 5: No Cash-Out**
Many CBAs do NOT provide any cash-out for unused sick leave. In this case, accumulated sick leave liability = $0. Still note the accumulation rate for reference.

### Modeling Accumulated Sick Leave

#### Per-Employee Accumulation
```
Days Accumulated This Year = Days Allocated - Days Used
Total Accumulated = Prior Balance + Days Accumulated This Year
Capped Accumulated = MIN(Total Accumulated, CBA Cap)
```

#### Estimating Current Accumulated Balance
If the user provides a roster with accumulated sick leave balances, use those. If not, estimate based on years of service (step as a proxy):

| Step (Proxy for Years) | Estimated Accumulated Days |
|---|---|
| 1-3 | 8-20 days |
| 4-7 | 25-50 days |
| 8-12 | 50-90 days |
| 13-18 | 80-140 days |
| 19-25 | 120-200 days |
| 25+ | 150-250+ days |

Default formula when balances are unknown:
```
Estimated Accumulated Days = MIN(Years of Service × (Annual Allocation × (1 - Usage Rate)), CBA Cap)
```

Example for a Step 15 teacher with 12 days/year allocation and 70% usage:
```
15 years × (12 × 0.30) = 15 × 3.6 = 54 days accumulated
```

Note: This underestimates because it doesn't account for younger/healthier years having lower usage. A better estimate:
```
Years 1-5: accumulate 4.5 days/year (low usage)
Years 6-15: accumulate 3.0 days/year (moderate usage)
Years 16+: accumulate 2.0 days/year (higher usage)
```

#### Total District Liability
```
Total Sick Leave Liability = SUM over all employees of:
    MIN(Accumulated Days, CBA Cap) × Cash-Out Rate per Day
```

This is a BALANCE SHEET liability, not an annual expense. But the annual CHANGE in liability should be reported:

```
Annual Liability Growth = New accumulation across all employees × Cash-Out Rate
                        - Cash-outs paid to retirees/separations this year
```

### Retirement-Year Cash-Out Projection
For multi-year projections, estimate retirements and their cash-out costs:

```
Expected Retirements per Year = Number of teachers at Step 20+ or age 55+ (rough proxy)
Average Cash-Out per Retiree = Average Accumulated Days × Cash-Out Rate
Annual Cash-Out Expense = Expected Retirements × Average Cash-Out per Retiree
```

This can be significant. If 5 teachers retire per year with an average cash-out of $20,000, that's $100,000 in one-time separation costs.

## Excel Output: Leave Cost Tab

### When to Include
Include a Leave Cost section in the Employer Cost tab (additional columns) or as a standalone tab if the CBA has complex leave provisions or cash-out rules.

### Standalone Tab Layout
```
Row 1: Title — "LEAVE COST ANALYSIS — [Year]"
Row 2: Subtitle — "Annual substitute expenditure and accumulated sick leave liability"
Row 3: Blank
Row 4: Section Header — "ANNUAL SUBSTITUTE COST"
Row 5: Headers — Emp ID | Name | Step | Sick Days | Personal Days | Other Days | Total Days | Sub Rate | Annual Sub Cost
Row 6+: One row per employee
Totals Row: SUM formulas

[3 rows blank]

Section Header — "ACCUMULATED SICK LEAVE LIABILITY"
Headers — Emp ID | Name | Step | Years of Service | Accumulated Days | Cap | Eligible Days | Cash-Out Rate | Liability
One row per employee
Totals Row: SUM formulas — this is the TOTAL DISTRICT LIABILITY

[3 rows blank]

Section Header — "SUMMARY"
Row: Total Annual Substitute Cost          $XXX,XXX
Row: Per-Employee Average Sub Cost         $X,XXX
Row: Total Accumulated Sick Leave Liability $X,XXX,XXX
Row: Average Liability Per Employee         $XX,XXX
Row: Estimated Annual Retirements           X
Row: Estimated Annual Cash-Out Expense      $XXX,XXX
Row: Annual Liability Growth (net)          $XXX,XXX
```

### Formatting
- Sub cost columns: Standard currency format
- Days columns: One decimal (e.g., 8.4 days)
- Liability amounts: Red text if above a per-employee threshold (e.g., >$25,000)
- Summary section: Bold labels, yellow highlight on totals

### Integration with Executive Summary
Add two rows to the Executive Summary's Employer Cost Breakdown:
```
Substitute Expenditure (Annual)        $180,000    $185,400    $5,400    3.0%
Sick Leave Cash-Out (Est. Annual)      $100,000    $105,000    $5,000    5.0%
```

### Integration with Scenario Comparison
If one proposal changes leave allocations (e.g., adds 2 personal days), the sub cost delta should appear in the Scenario Comparison:
```
Additional Personal Days: 2 × headcount × sub rate = 2 × 100 × $150 = $30,000/year
```

## Union-Side Perspective

### Leave Value to Employees
From the union perspective, leave days have economic value to the employee:
- Each sick day is worth the teacher's daily rate in "income protection"
- Each personal day is a paid day off (worth daily rate in leisure value)
- Accumulated sick leave with cash-out is deferred compensation

### Union-Side Reporting
When generating for a union audience, add a section:
```
"VALUE OF LEAVE BENEFITS PER TEACHER"
Sick Leave (12 days × daily rate):          $5,514 (income protection value)
Personal Leave (3 days × daily rate):       $1,378 (paid time off value)
Accumulated Sick Leave Cash-Out (projected): $XX,XXX (deferred compensation)
Total Leave Benefit Value:                   $XX,XXX per teacher
```

This helps union negotiators articulate the total value of the compensation package when responding to "we're offering a 3% raise" — the leave benefits have real dollar value that should be counted.

## Assumptions Tab Entries

Add these to the Assumptions tab when leave costs are modeled:

| Assumption | Value | Source / Notes |
|---|---|---|
| Sick days allocated per year | 12 | CBA Article [X] |
| Personal days allocated per year | 3 | CBA Article [X] |
| Sick day usage rate | 70% | Default estimate |
| Personal day usage rate | 85% | Default estimate |
| Average days requiring sub per teacher | 12.0 | Calculated |
| Daily substitute rate | $150 | District rate / default |
| Sub rate annual trend | 3.0% | Default estimate |
| Sick leave accumulation cap | 200 days | CBA Article [X] |
| Sick leave cash-out rate | $75/day | CBA Article [X] |
| Cash-out eligibility | Retirement with 15+ years | CBA Article [X] |
| Estimated annual retirements | 5 | Based on roster age/step |
