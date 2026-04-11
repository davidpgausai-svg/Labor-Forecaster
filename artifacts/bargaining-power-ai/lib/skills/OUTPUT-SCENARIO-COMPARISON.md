# Output: Scenario Comparison

## Purpose
This file defines how to build a side-by-side comparison of up to four negotiation scenarios (proposals, counterproposals, or status quo projections) within a single Excel tab. The Scenario Comparison is the primary decision-support tool for negotiators on both sides of the table. It answers: "What does each proposal actually cost, who pays, and what's the difference?"

## When to Generate This Tab
- The user provides two or more proposals (e.g., Union Proposal and Board Counter)
- The user asks "what if" questions comparing different salary increase percentages, benefit changes, or contract structures
- The user requests a side-by-side or comparison view
- Always generate this tab if more than one scenario is discussed in the conversation, even if not explicitly requested

## Scenario Definitions

### Scenario Slots (Up to 4)

| Slot | Default Label | Typical Use |
|---|---|---|
| A | Current / Status Quo | The existing CBA terms projected forward with step advancement only (no schedule increase). This is the "do nothing" baseline. |
| B | Proposal 1 | Usually the union's initial proposal or the first scenario discussed. |
| C | Proposal 2 | Usually the board's counterproposal or a second scenario. |
| D | Proposal 3 | A mediator's recommendation, a compromise position, or a third what-if. Optional — only include if the user provides a third proposal. |

### What Varies Between Scenarios
Each scenario can differ on any combination of:
- **Salary schedule increase** — different % or $ amounts per year
- **Step advancement rules** — freeze steps, skip steps, add steps
- **Benefits changes** — different premium sharing splits, plan changes, cap adjustments
- **Stipend changes** — different stipend schedule modifications
- **One-time payments** — ratification bonuses, signing bonuses
- **Work rule changes** — calendar day changes, prep period changes
- **Retirement pickup** — district starts or stops paying employee share
- **Duration** — different contract lengths (e.g., 3-year vs. 4-year)

### What Stays Constant Across Scenarios
- Employee roster (same people in every scenario)
- Current salary schedule (the starting point is the same)
- Tax rates (Medicare, SS, SUTA, income tax rates)
- Retirement contribution rates (these are set by the state, not the CBA)
- Benefits trend factor (unless a scenario specifically changes the plan)
- Workers' compensation rates
- Contract days (unless a scenario specifically changes them)

## Excel Tab Layout

### Tab Name
`Scenario Comparison`

### Section 1: Scenario Summary Header

```
Row 1: Title — "SCENARIO COMPARISON — [District Name]"
Row 2: Subtitle — "[Union Name] | CBA [Start]-[End] | [N] Teachers"
Row 3: Blank
Row 4: Column Headers (see below)
```

#### Column Layout — Scenario Summary
```
Column A: Category / Line Item (width 30)
Column B: Scenario A label + value (width 18)
Column C: Scenario B label + value (width 18)
Column D: Scenario C label + value (width 18)
Column E: Scenario D label + value (width 18) [if applicable]
Column F: B vs A — $ Difference (width 16)
Column G: B vs A — % Difference (width 12)
Column H: C vs A — $ Difference (width 16) [if C exists]
Column I: C vs A — % Difference (width 12) [if C exists]
Column J: D vs A — $ Difference (width 16) [if D exists]
Column K: D vs A — % Difference (width 12) [if D exists]
```

### Section 2: Scenario Assumptions Block (Rows 5-18)

Display the key differentiating assumptions for each scenario so the reader can see at a glance what changed:

```
Row 5:  Header — "SCENARIO ASSUMPTIONS" (dark blue background, white text, spans all columns)
Row 6:  Salary Increase — Year 1    | 0.0%      | 3.5%      | 2.0%      | 2.75%
Row 7:  Salary Increase — Year 2    | 0.0%      | 3.5%      | 2.5%      | 3.00%
Row 8:  Salary Increase — Year 3    | 0.0%      | 3.0%      | 2.5%      | 2.75%
Row 9:  Salary Increase — Year 4    | 0.0%      | 3.0%      | 2.0%      | —
Row 10: Step Advancement            | Yes       | Yes       | Yes       | Yes
Row 11: One-Time Bonus              | $0        | $2,000    | $1,000    | $1,500
Row 12: Health Ins — ER Share       | 85%       | 90%       | 85%       | 87%
Row 13: Health Ins — Trend          | 5.0%      | 5.0%      | 5.0%      | 5.0%
Row 14: Dental/Vision Changes       | No Change | No Change | No Change | No Change
Row 15: Retirement Pickup           | Yes (9%)  | Yes (9%)  | Yes (9%)  | Yes (9%)
Row 16: Calendar Day Changes        | No Change | +2 PD days| No Change | +1 PD day
Row 17: Contract Duration           | N/A       | 4 years   | 3 years   | 3 years
Row 18: Blank separator
```

Formatting:
- Assumption values that DIFFER from Scenario A: **Bold blue text**
- Assumption values that match Scenario A: Normal black text
- This makes it instantly obvious what changed in each proposal

### Section 3: Employer Cost Comparison (Rows 19-38)

```
Row 19: Section Header — "EMPLOYER COST COMPARISON" (dark red background, white bold text)
Row 20: Sub-header — "Total cost to district across all [N] employees"
Row 21: Column headers (Scenario A | B | C | D | B vs A $ | B vs A % | C vs A $ | ...)
Row 22: Base Salary (all employees)
Row 23: Step Advancement Cost
Row 24: Schedule Increase Cost
Row 25: One-Time Bonuses
Row 26: District-Paid EE Retirement
Row 27: Employer Retirement
Row 28: Employer Insurance Fund (THIS)
Row 29: Medicare 1.45%
Row 30: Social Security 6.2% (if applicable, else "N/A — Pension Exempt")
Row 31: SUTA
Row 32: Workers Compensation
Row 33: Medical Insurance (ER Share)
Row 34: Dental (ER Share)
Row 35: Vision (ER Share)
Row 36: Life + LTD
Row 37: TOTAL EMPLOYER COST (dark red background, white bold, SUM formula)
Row 38: Per-Employee Average (= Row 37 / headcount)
```

### Section 4: Employee Impact Comparison (Rows 40-56)

```
Row 40: Section Header — "EMPLOYEE IMPACT COMPARISON" (dark green background, white bold text)
Row 41: Sub-header — "Average impact per teacher"
Row 42: Column headers
Row 43: Average Gross Salary
Row 44: Average Step Increase
Row 45: Average Schedule Increase
Row 46: One-Time Bonus (per employee)
Row 47: — Employee Retirement Deduction (negative or $0)
Row 48: — Employee Insurance Fund (THIS)
Row 49: — Medicare 1.45%
Row 50: — Social Security 6.2% (if applicable)
Row 51: — Federal Income Tax (estimated)
Row 52: — State Income Tax
Row 53: — Medical Insurance (EE Share)
Row 54: — Dental/Vision (EE Share)
Row 55: AVERAGE NET TAKE-HOME (dark green background, white bold)
Row 56: Average Monthly Take-Home (= Row 55 / 12)
```

### Section 5: Multi-Year Summary (Rows 58-75)

This section shows the cumulative employer cost and employee impact over the full contract term for each scenario.

```
Row 58: Section Header — "MULTI-YEAR CUMULATIVE IMPACT"
Row 59: Sub-header — "Total incremental cost over contract term vs. Status Quo"
Row 60: Blank
Row 61: Column headers — Year 1 | Year 2 | Year 3 | Year 4 | TOTAL
```

For EACH scenario (B, C, D), display a mini-block:

```
Row 62: "SCENARIO B: [Label]" (bold, light blue background)
Row 63: Incremental ER Cost (year by year)
Row 64: Cumulative ER Cost
Row 65: Incremental EE Net Gain (year by year)
Row 66: Cumulative EE Net Gain
Row 67: Blank

Row 68: "SCENARIO C: [Label]" (bold, light blue background)
Row 69-72: Same structure
Row 73: Blank

Row 74: "SCENARIO D: [Label]" (if applicable)
Row 75-78: Same structure
```

### Section 6: Key Metrics Comparison (Rows 80-90)

```
Row 80: Section Header — "KEY METRICS"
Row 81: Cost Multiplier (ER Cost / Salary)        | 1.32x  | 1.38x  | 1.35x  | 1.36x
Row 82: Benefits Load % of Salary                 | 32.1%  | 37.8%  | 34.5%  | 35.9%
Row 83: Total Contract Cost (cumulative ER)        | —      | $2.1M  | $1.6M  | $1.8M
Row 84: Average Annual Increase per Teacher        | —      | $3,450 | $2,180 | $2,780
Row 85: Cost per Hour Worked (ER)                  | $62.40 | $67.10 | $64.50 | $65.80
Row 86: Employer Cost Rank                         | —      | Most   | Least  | Middle
Row 87: Employee Net Gain Rank                     | —      | Most   | Least  | Middle
Row 88: Blank
Row 89: "Cost per Hour Worked = Total ER Cost / (Teachers × Contract Days × Hours Per Day)"
Row 90: "Hours Per Day assumption: [X] (see Assumptions tab)"
```

## Calculation Logic

### Status Quo (Scenario A) Baseline
The status quo is NOT "freeze everything." It is:
- Step advancement: YES (automatic, contractually guaranteed even in holdover)
- Schedule increase: NO (0% — no new negotiated increase)
- Benefits trend: YES (premiums still increase at market rate)
- All other costs: project forward with current rates

This is critical. The status quo still has cost growth due to steps and benefits. Scenario A shows what happens if the board and union cannot agree and the contract rolls over under the status quo.

### Delta Calculations
All deltas are calculated against Scenario A (Status Quo):

```
Dollar Difference = Scenario [B/C/D] value - Scenario A value
Percent Difference = (Scenario [B/C/D] value - Scenario A value) / Scenario A value × 100
```

### Handling Different Contract Durations
If scenarios have different durations (e.g., B is 4 years, C is 3 years):
- The multi-year summary shows all years for the longest scenario
- For the shorter scenario, years beyond its term show "—" or "Contract Expired"
- Total cumulative cost should be annualized for fair comparison: `Annualized Cost = Total Cumulative / Number of Years`
- Flag this in a note: "Scenarios have different durations. Annualized cost shown for comparison."

### One-Time Bonuses
One-time bonuses are included in the year they are paid but do NOT carry forward:
- Year 1 total = salary cost + bonus + benefits + taxes on (salary + bonus)
- Year 2 total = salary cost (no bonus) + benefits + taxes on salary only
- Note: bonuses ARE subject to Medicare, retirement contributions, and income tax
- Bonuses are NOT subject to SUTA (usually above wage base) or workers' comp (typically excluded)

## Formatting Rules

### Color Coding for Deltas
- Positive employer cost delta (costs more): Red text (#CC0000)
- Negative employer cost delta (saves money): Green text (#008000)
- Positive employee net delta (teacher gains): Green text (#008000)
- Negative employee net delta (teacher loses): Red text (#CC0000)

The color logic FLIPS between employer and employee sections. More cost is bad for the employer (red) but more take-home is good for the employee (green).

### Scenario Column Headers
Each scenario column header should include:
- Line 1: Scenario label (e.g., "Union Proposal")
- Line 2: Key differentiator (e.g., "3.5% / 3.5% / 3.0%")
- Format: Bold, centered, wrapped text, light fill color unique per scenario

Suggested fills:
- Scenario A (Status Quo): Light gray (#F2F2F2)
- Scenario B: Light blue (#D6E4F0)
- Scenario C: Light green (#E2EFDA)
- Scenario D: Light yellow (#FFF2CC)

### Highlighting the "Winner"
In the Key Metrics section:
- The scenario with the LOWEST total employer cost gets a green border on its Total Contract Cost cell
- The scenario with the HIGHEST employee net gain gets a green border on its Average Annual Increase cell
- Do NOT editorialize about which scenario is "best" — present the numbers and let the user decide

## Dual-Perspective Support

### Board/Management View (Default)
When the user is board-side:
- Employer Cost Comparison section comes FIRST
- Employee Impact section comes second
- Key Metrics emphasize cost multiplier, total contract cost, cost per hour
- Delta columns show increase as red (bad) and decrease as green (good)

### Union/Employee View
When the user is union-side or requests employee perspective:
- Employee Impact section comes FIRST
- Employer Cost section comes second
- Key Metrics emphasize average take-home increase, net gain per teacher, real wage growth
- Add a row: "Real Wage Growth = Salary Increase % - CPI-U %" to show whether the raise beats inflation
- Delta columns for employee section: increase is green (good), decrease is red (bad)

### How to Detect Perspective
Look for cues in the user's language:
- Board-side: "what does this cost us," "district impact," "board," "budget," "levy"
- Union-side: "what do our members get," "take-home," "real wages," "cost of living," "our proposal"
- Neutral: "compare these proposals" — default to board-side layout but include both sections prominently

## Python Code Structure

```python
def build_scenario_comparison(wb, scenarios, roster, assumptions):
    """
    scenarios: list of dicts, each containing:
        {
            'label': 'Union Proposal',
            'salary_increases': [0.035, 0.035, 0.030],  # per year
            'step_advancement': True,
            'one_time_bonus': 2000,
            'health_er_share': 0.90,
            'health_trend': 0.05,
            'calendar_day_change': 2,
            'duration_years': 3,
            # ... other provisions
        }
    scenarios[0] is always the Status Quo baseline
    """
    ws = wb.create_sheet('Scenario Comparison')
    
    # 1. Write header block
    # 2. Write assumptions block (highlight diffs from Scenario A)
    # 3. Calculate each scenario's ER cost and EE impact
    # 4. Write employer cost comparison with delta columns
    # 5. Write employee impact comparison with delta columns
    # 6. Write multi-year cumulative block
    # 7. Write key metrics with conditional formatting
    # 8. Apply all formatting
```

## Formula Requirements

All values in the Scenario Comparison tab should be **Excel formulas** referencing the Assumptions tab or calculated from other cells in the tab. Do not hardcode scenario results.

For delta columns:
```
=C22-B22          (Scenario B value minus Scenario A value)
=(C22-B22)/B22    (Percentage difference)
```

For multi-year cumulative:
```
=SUM($B$63:B63)   (Running cumulative sum)
```

For cost per hour worked:
```
=B37/(headcount * contract_days * hours_per_day)
```

For annualized cost (when durations differ):
```
=B64/B_duration_years
```
