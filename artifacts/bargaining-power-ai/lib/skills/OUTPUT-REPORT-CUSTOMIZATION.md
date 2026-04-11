# Output: Report Customization by Audience

## Purpose
This file defines how to tailor the Excel workbook output for different audiences. The same underlying cost model produces different report configurations depending on who will read it, what decisions they are making, and which numbers matter most to them. A board member in a public meeting needs a one-page summary. A union negotiator needs per-member take-home detail. A finance director needs every formula visible.

## Audience Detection

### How to Determine the Audience
Look for cues in the user's language and context:

| Cue | Audience | Confidence |
|---|---|---|
| "board presentation," "board meeting," "public hearing" | Board/Trustees | High |
| "our members," "take-home pay," "cost of living," "our proposal" | Union | High |
| "budget," "levy," "fund balance," "audit," "GASB" | Finance/Business Office | High |
| "at the table," "bargaining session," "mediation," "fact-finding" | Negotiation (either side) | High |
| "compare proposals," "what does this cost" | Negotiation (board-side default) | Medium |
| "what do teachers actually get" | Union or neutral analysis | Medium |
| No clear cue | Default to Finance/Business Office | — |

### When in Doubt, Ask
If the audience is ambiguous, ask: "Who will be reading this — board members, union leadership, finance staff, or negotiators at the table?" The answer determines tab selection, formatting density, and which metrics are featured.

## Report Configuration: Board/Trustees

### Context
Board members are elected officials or appointed trustees. They are typically NOT financial professionals. They need high-level numbers, clear comparisons, and confidence that the analysis is thorough — but they will not read 7 tabs of detail. They see this in a public board meeting with 3-5 minutes of presentation time.

### Tab Selection
| Tab | Include? | Notes |
|---|---|---|
| Executive Summary | **YES — PRIMARY** | This is the only tab most board members will read |
| Assumptions | Yes (reference) | Include but don't present — it's backup documentation |
| Salary Schedule | Optional | Only if the schedule itself is being discussed |
| Employee Roster | **NO** | Contains individual salary data — inappropriate for public meetings in many states |
| Employer Cost Detail | No | Too granular |
| Employee Cost Detail | No | Too granular |
| Incremental Cost Analysis | Yes (summary only) | Multi-year summary table, NOT per-employee detail |
| Scenario Comparison | **YES — CRITICAL** | The main decision tool for board vote |
| Leave Cost Analysis | No | Fold into Executive Summary as a single line |
| Workforce Simulation | Summary only | One summary block showing turnover impact |

### Formatting Modifications
- **Font size**: Increase title to 18pt, headers to 12pt, data to 11pt
- **Column widths**: Wider to accommodate larger fonts
- **Charts**: Include a bar chart comparing scenarios (Total ER Cost side by side)
- **Highlight**: Yellow highlight on the total incremental cost row and the per-teacher average
- **Print layout**: Set print area to fit on 1-2 landscape pages
- **No individual names**: Remove or hide the roster tab entirely

### Key Metrics to Feature (Board)
1. **Total incremental cost** — "This contract costs the district an additional $567,000 next year"
2. **Cost per student** — If enrollment is provided: Total ER Cost / Enrollment
3. **Cost multiplier** — "For every dollar of salary, total cost is $1.36"
4. **Scenario comparison totals** — "Proposal A costs $2.1M over 3 years; Proposal B costs $1.6M"
5. **Tax levy impact** — If the user provides levy/assessed value data: incremental cost as % of levy

### What Board Members Should NOT See
- Individual teacher salaries (public record in most states, but presenting them in a meeting is politically charged)
- Per-employee benefit costs
- Social Security numbers (obvious, but worth stating)
- Assumptions about individual teacher turnover or retirement

## Report Configuration: Union/Employee Association

### Context
Union negotiators represent teachers and need to demonstrate what a proposal is worth to the average member. They care about take-home pay, real wage growth (vs. inflation), benefit value, and fairness across the salary schedule (do early-career teachers benefit as much as veterans?).

### Tab Selection
| Tab | Include? | Notes |
|---|---|---|
| Executive Summary | Yes | But restructure for employee perspective (see below) |
| Assumptions | Yes | Union negotiators will scrutinize every assumption |
| Salary Schedule | **YES — CRITICAL** | Show current and proposed side by side |
| Employee Roster | Yes (if union has access) | Union usually has member data |
| Employer Cost Detail | Yes (reference) | Useful for understanding district capacity |
| Employee Cost Detail | **YES — PRIMARY** | The core deliverable for union |
| Incremental Cost Analysis | Yes | Both employer and employee sections |
| Scenario Comparison | **YES — CRITICAL** | Emphasize employee impact section |
| Leave Cost Analysis | Yes | Show leave benefit value per teacher |
| Workforce Simulation | Yes | Emphasize retention/experience impact |

### Executive Summary Restructuring for Union
When generating for union audience, flip the Executive Summary layout:

```
SECTION 1: EMPLOYEE IMPACT (comes first)
- Average Salary Increase ($ and %)
- Average Net Take-Home Increase
- Real Wage Growth (Salary Increase % minus CPI-U %)
- Take-Home as % of Gross (effective deduction rate)
- Benefit Value per Teacher (insurance + leave + retirement)
- Total Compensation Value = Salary + ER-Paid Benefits + Leave Value

SECTION 2: EMPLOYER COST (comes second)
- Same line items as standard, but positioned as context
- Frame: "The district CAN afford this because..."

SECTION 3: KEY METRICS (union perspective)
- Purchasing power change (salary increase vs. CPI-U)
- Years to reach median household income (at what step?)
- Starting salary competitiveness (vs. neighboring districts, if data available)
- Benefit load as % of total compensation (shows how much ER pays beyond salary)
```

### Union-Specific Metrics
1. **Real wage growth** — `Salary Increase % - CPI-U %`. If negative, the teacher is losing purchasing power.
2. **Total compensation value** — `Salary + ER-Paid Retirement + ER-Paid Insurance + Leave Value`. This is the true economic value of the position.
3. **Deduction burden** — `Total EE Deductions / Gross Salary × 100`. Shows what percentage of gross pay the teacher never sees.
4. **Step distribution analysis** — Show salary increase by step range. Do Steps 1-5 get the same percentage increase as Steps 20-25? If the CBA uses a flat-dollar increase, lower steps get a higher percentage — beneficial for early-career teachers.
5. **Comparison to cost of living** — If CPI-U data is available, show whether the proposed raises keep pace with inflation over the contract term.

### Equity Analysis (Union Priority)
Add a section showing how the proposal affects different groups:

```
SALARY INCREASE BY STEP RANGE
                    Current Avg     Proposed Avg    Increase $  Increase %
Steps 1-5           $48,200         $50,100         $1,900      3.9%
Steps 6-10          $58,700         $60,800         $2,100      3.6%
Steps 11-15         $68,300         $70,700         $2,400      3.5%
Steps 16-20         $78,900         $81,700         $2,800      3.5%
Steps 21+           $92,400         $95,600         $3,200      3.5%

NET TAKE-HOME INCREASE BY STEP RANGE
Steps 1-5           +$1,380/year    +$115/month
Steps 6-10          +$1,510/year    +$126/month
Steps 11-15         +$1,720/year    +$143/month
Steps 16-20         +$1,980/year    +$165/month
Steps 21+           +$2,240/year    +$187/month
```

This table answers the union member's question: "What does this contract mean for ME?"

### Monthly Take-Home Emphasis
Union reports should ALWAYS show monthly amounts alongside annual amounts. Teachers think in monthly paychecks, not annual salary. Every salary and take-home number should have a monthly equivalent.

## Report Configuration: Finance/Business Office

### Context
The school business official (SBO), comptroller, or finance director needs the full model with every formula auditable. They will plug these numbers into the district's annual budget, five-year financial projection, and potentially a tax levy calculation. Accuracy and traceability matter more than presentation.

### Tab Selection
| Tab | Include? | Notes |
|---|---|---|
| Executive Summary | Yes | Standard layout |
| Assumptions | **YES — CRITICAL** | Every rate, every source, every default must be documented |
| Salary Schedule | Yes | Full grid with all years |
| Employee Roster | **YES — CRITICAL** | Full detail with formulas visible |
| Employer Cost Detail | **YES — CRITICAL** | Per-employee with all formulas |
| Employee Cost Detail | Yes | Full detail |
| Incremental Cost Analysis | **YES — CRITICAL** | Per-employee AND summary |
| Scenario Comparison | Yes (if applicable) | Full detail with all assumptions |
| Leave Cost Analysis | Yes | Full detail with liability calculation |
| Workforce Simulation | Yes | Full simulation with sensitivity |

### Finance-Specific Additions

**Budget Integration Block** (add to Executive Summary):
```
BUDGET IMPACT SUMMARY
                                    Current Year    Projected Year
Education Fund (fund 10) Impact     $8,234,000      $8,801,000
    Salary & Wages                  $7,680,537      $8,112,000
    Employee Benefits               $2,542,000      $2,689,000
    Purchased Services (subs)       $180,000        $185,400
Operations & Maintenance Impact     $0              $0
Tort Fund Impact (WC)               $48,000         $50,400

Total All-Funds Impact              $8,462,000      $9,036,400
```

**Cash Flow Timing** (add as a note or separate section):
```
- Salary payments: Distributed over 12 months (monthly payroll)
- Insurance premiums: Monthly to carrier
- TRS/STRS contributions: Monthly or quarterly to pension system
- SUTA: Quarterly
- Workers comp: Annual premium with quarterly audits
- Sick leave cash-out: One-time at retirement date
- Retroactive pay: Lump sum at settlement date
```

### Formula Audit Trail
For finance reports, add a hidden "Calculation Check" tab that:
- Recalculates every total independently using a different method
- Flags any cell where the difference exceeds $1
- Shows: `=IF(ABS(Check_Total - Original_Total) > 1, "ERROR", "OK")`

This is professional-grade work product that the finance director can hand to an auditor.

### Formatting for Finance
- Show formulas in a comment or note on each header cell (e.g., "Medicare = Salary × 1.45%")
- Do NOT merge cells — merged cells break sorting and filtering
- Include column filters on all data rows
- Freeze panes: top header row + left ID/Name columns

## Report Configuration: Negotiation (At the Table)

### Context
This report is used DURING bargaining sessions. It needs to be updated in real-time as proposals change. The negotiator needs to quickly model a new number ("What if we offer 2.75% instead of 3.0%?") and see the impact.

### Tab Selection
| Tab | Include? | Notes |
|---|---|---|
| Executive Summary | Yes | Quick reference |
| Assumptions | **YES — CRITICAL** | This is where the negotiator changes inputs |
| Salary Schedule | Yes | Side-by-side current vs. proposed |
| Employee Roster | No (usually) | Not relevant at the table |
| Employer Cost Detail | Summary only | Total line, not per-employee |
| Employee Cost Detail | Summary only | Average teacher, not per-employee |
| Incremental Cost Analysis | **YES — CRITICAL** | The "what does this cost" answer |
| Scenario Comparison | **YES — PRIMARY** | The core decision tool |
| Leave Cost Analysis | Summary only | |
| Workforce Simulation | No | Too complex for real-time negotiation |

### Negotiation-Specific Features

**Quick-Change Input Cells**:
On the Assumptions tab, create a clearly marked "NEGOTIATION INPUTS" section at the top with large, highlighted cells:

```
Row 1: ═══════════════════════════════════════════
Row 2: NEGOTIATION INPUTS — CHANGE THESE VALUES
Row 3: ═══════════════════════════════════════════
Row 4: Year 1 Salary Increase:  [ 3.00% ]   ← large cell, yellow background, blue text
Row 5: Year 2 Salary Increase:  [ 2.50% ]
Row 6: Year 3 Salary Increase:  [ 2.50% ]
Row 7: One-Time Bonus:          [ $1,500 ]
Row 8: Health Ins ER Share:     [ 85%    ]
Row 9: Calendar Day Change:     [ +0     ]
Row 10: ═══════════════════════════════════════════
```

All other cells in the workbook should reference these input cells. When the negotiator types a new percentage, every tab updates automatically via Excel formulas.

**Instant Impact Line**:
On the Scenario Comparison tab, add a prominently formatted single row:

```
BOTTOM LINE: This proposal costs the district $567,073 more than status quo 
             and puts $315,791 more in teachers' pockets (net across all teachers).
             That's $3,158 more per teacher per year, or $263 per month.
```

This row should be in 14pt bold text, yellow background, and reference formula cells that update dynamically.

### Board-Side vs. Union-Side Negotiation Variants

**Board-side negotiation report**:
- Lead with employer cost
- Show "cost of each 0.5% increment" as a reference table:
```
Each 0.5% salary increase costs:
    Year 1 only:     $38,403
    Annually (with steps): $42,200
    Over 3-year term: $128,500
```
- Show cost ceiling: "At what salary increase % does the total contract exceed $X budget?" 

**Union-side negotiation report**:
- Lead with employee take-home
- Show "value of each 0.5% increment per teacher" as a reference table:
```
Each 0.5% salary increase is worth:
    $384/year gross per average teacher
    $278/year net (after deductions)
    $23/month take-home
```
- Show inflation context: "At current CPI-U of 3.2%, anything below 3.2% is a real wage cut"

## Output Format Configurations

### Format A: Annual Dollars (Default)
All cost figures shown as annual dollar amounts. This is the standard format.

### Format B: Cost Per Hour Worked
Convert all figures to hourly rates for comparability with private sector or other districts.

```
Cost Per Hour = Annual Amount / (Contract Days × Hours Per Day)
```

Default hours per day: **7.5** (includes instructional time + preparation period, excludes unpaid lunch)

Add these as columns or a separate section:
```
                        Annual          Hourly
Average Salary          $76,805         $55.43
Average ER Cost         $104,576        $75.45
Average EE Net          $56,745         $40.94
```

This is particularly useful for:
- Board members comparing teacher cost to other district employees
- Union negotiators comparing to private-sector professional wages
- Finance directors comparing across districts with different calendars

### Format C: Cost Per Employee
Already included in the default output as per-employee averages. No additional configuration needed.

### Format D: Cost Per Student
If enrollment data is provided, divide all aggregate figures by enrollment:

```
Total ER Cost Per Student = Total ER Cost / Enrollment
Incremental Cost Per Student = Incremental ER Cost / Enrollment
```

Useful for board members and taxpayers who think in terms of per-pupil spending.

## Print Layout Rules

### All Audiences
- Set page orientation: Landscape for all tabs with more than 6 columns
- Set print area: Exclude unused columns
- Set header: Tab name + District name + Date
- Set footer: "Confidential — Prepared for [Audience]" + Page number
- Scale to fit width: 1 page wide (let height flow to multiple pages)

### Board Reports
- Maximum 3 printed pages total
- Executive Summary: 1 page
- Scenario Comparison: 1-2 pages

### Finance Reports
- No page limit
- Include all tabs
- Add table of contents as first sheet

### Negotiation Reports
- Maximum 5 printed pages
- Scenario Comparison: 2 pages
- Assumptions (input section only): 1 page
- Incremental Cost Summary: 1-2 pages

## Assumptions Tab Entry

| Assumption | Value | Source / Notes |
|---|---|---|
| Report audience | [Board/Union/Finance/Negotiation] | User-specified or detected |
| Hours per contract day | 7.5 | Default — verify with district |
| Enrollment (if provided) | [N] students | User-provided — for per-student metrics |
| CPI-U estimate | 3.0% | Default — for real wage calculations |
| Report date | [Date generated] | Auto-populated |
| Prepared for | [Name/Organization] | User-specified |
| Confidentiality level | [Public/Confidential/Attorney-Client] | User-specified — default "Confidential" |
