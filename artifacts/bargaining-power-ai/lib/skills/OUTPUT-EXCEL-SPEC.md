# Output: Excel Workbook Specification

## Purpose
This file defines the exact structure, formatting, and content of the Excel workbook produced by Bargaining Power AI. Every workbook must follow this specification to ensure consistency and professionalism across all client deliverables.

## Technology
- Use Python with **openpyxl** to generate the workbook
- Use **Excel formulas** for all calculations — never hardcode computed values
- After generating, recalculate with: `python scripts/recalc.py output.xlsx`
- Verify zero formula errors before delivery

## Workbook Structure

### Tab Order (Required)
1. Executive Summary
2. Assumptions
3. Salary Schedule
4. Employee Roster
5. Employer Cost - Current
6. Employee Cost - Current
7. Incremental Cost Analysis

### Optional Tabs (Include When Data Exists)
8. Stipend Schedule
9. Scenario Comparison (if user provides multiple proposals)
10. Benefits Detail

## Formatting Standards

### Fonts
- **Primary font**: Arial, 10pt for all data cells
- **Headers**: Arial, 10pt, Bold, White text on dark blue fill (#2F5496)
- **Titles**: Arial, 14-16pt, Bold, Dark blue text (#2F5496)
- **Subtitles**: Arial, 10-11pt, Italic

### Color Coding (Financial Model Standard)
- **Blue text** (#0000FF): Hardcoded inputs and assumptions the user may change
- **Black text** (#000000): All formulas and calculated values
- **Green text** (#008000): Values pulled from other sheets within the workbook
- **Red text** (#CC0000): Values that represent costs, deductions, or negative impacts
- **White text on dark blue fill** (#2F5496): Column and section headers
- **White text on dark red fill** (#C00000): Total employer cost rows
- **White text on dark green fill** (#375623): Total employee net rows
- **Yellow fill** (#FFFF00): Summary total rows requiring attention

### Number Formats
- **Currency**: `$#,##0` for whole dollars, `$#,##0.00` for monthly/daily rates
- **Percentages**: `0.0%` with one decimal
- **Negative currency**: `($#,##0)` — use parentheses, not minus signs
- **Headcount**: No decimals, no formatting
- **Years**: Format as text to prevent comma insertion (e.g., "2024" not 2,024)

### Cell Formatting
- All data cells: Thin border on all sides
- Alternating row shading: Light gray (#F2F2F2) on even rows for readability
- Column widths: Minimum 14 for currency columns, 22 for name columns, 8 for step/lane
- Header row: Center-aligned, wrap text enabled
- Currency cells: Right-aligned
- Text cells: Left-aligned
- Step/Lane/Days: Center-aligned

---

## Tab 1: Executive Summary

### Layout
```
Row 1: Title — "TEACHER UNION CBA COST MODEL — EXECUTIVE SUMMARY"
Row 2: Subtitle — "[Union Name] | [District Name] | CBA [Start Year]-[End Year]"
Row 3: Context — "[N] Teachers | [Day] Contracts | [Pay Period] Salary Distribution"
Row 5: Section Header — "EMPLOYER COST BREAKDOWN"
       Columns: [Category] | Current (YYYY-YY) | Projected (YYYY-YY) | Incremental $ | Incremental %
Rows 6-13: Line items (salary, retirement, taxes, insurance)
Row 14: TOTAL EMPLOYER COST (dark red background, white bold text)
Row 15: Avg Cost Per Teacher
Row 17: Section Header — "EMPLOYEE IMPACT BREAKDOWN"
       Columns: [Category] | Current (YYYY-YY) | Projected (YYYY-YY) | Change $ | Change %
Rows 18-23: Line items (gross salary, deductions as negative numbers)
Row 24: TOTAL NET TAKE-HOME (dark green background, white bold text)
Row 25: Avg Net Take-Home Per Teacher
Row 27: Section Header — "KEY METRICS"
Rows 28-33: Headcount, contract day split, avg salary, benefits load %, cost multiplier
```

### Employer Cost Line Items
1. Base Salary (N Teachers)
2. Retirement — District-Paid Employee Contribution (if applicable)
3. Retirement — Employer Contribution
4. Retirement Insurance Fund (THIS, if applicable)
5. Medicare 1.45%
6. Social Security 6.2% (if applicable — label as "N/A" if exempt)
7. SUTA
8. Workers Compensation
9. Health/Dental/Vision/Life/LTD (Employer Share)

### Employee Impact Line Items
1. Gross Salary (positive)
2. Retirement — Employee Deduction (negative, or $0 if district-paid)
3. Retirement Insurance Fund (THIS, if applicable) (negative)
4. Medicare 1.45% (negative)
5. Social Security 6.2% (negative, if applicable)
6. Federal Income Tax (negative)
7. State Income Tax (negative)
8. Health/Dental/Vision — Employee Share (negative)

### Key Metrics
- Total Headcount
- Contract day breakdown (e.g., 55 on 187-day, 45 on 192-day)
- Average Salary
- Benefits Load % of Salary = (Total ER Cost - Total Salary) / Total Salary × 100
- Employer Cost Multiplier = Total ER Cost / Total Salary (typically 1.25-1.45x)

---

## Tab 2: Assumptions

### Layout
```
Row 1: Title — "Model Assumptions"
Row 3: Header Row — Assumption | Value | Source / Notes
Rows 4+: All assumptions grouped by category
```

### Required Categories (in order)
1. **CBA Source** — name, district, term, contract year
2. **Retirement** — all contribution rates, who pays, tier info
3. **Health Insurance** — premiums by tier, sharing percentages
4. **Dental/Vision/Life/LTD** — premiums and sharing
5. **Employer Payroll Taxes** — Medicare, SS, FUTA, SUTA rates and wage bases
6. **Employee Payroll Taxes** — Medicare, SS, federal effective rate, state rate
7. **Contract Schedule** — day counts, FTE, pay distribution period
8. **Annual Increases** — schedule increase amounts/percentages, CPI-U estimates

### Formatting
- Category headers: Bold text, light blue background (#D9E2F3)
- Rate values: Blue text, percentage format
- Dollar values: Blue text, currency format
- Blank rows between categories for readability
- Notes section at bottom with key modeling disclaimers

---

## Tab 3: Salary Schedule

### Layout
```
Row 1: Title — "[Union/District Name]"
Row 2: Subtitle — "Teacher Salary Schedule [Year] (Source: CBA Appendix [X])"
Row 3: Context — "CBA Term: [dates] | [increase methodology]"
Row 5: Header Row — Step | [Lane 1] | [Lane 2] | ... | [Lane N]
Rows 6+: Salary grid values
```

### Formatting
- Step column: Center-aligned, bold
- Salary values: Blue text (these are inputs), currency format, center-aligned
- Empty cells (where step/lane doesn't exist): Display "-" in gray text
- Alternating row shading

---

## Tab 4: Employee Roster

### Layout
```
Row 1: Title — "Employee Roster — [N] Teachers"
Row 2: Subtitle — "[District] | CBA [dates] | [Day types] | [Pay distribution]"
Row 4: Header Row
Rows 5+: Employee data
Last data row + 1: TOTALS row
```

### Required Columns
1. Emp ID (format: T0001, T0002, etc.)
2. First Name
3. Last Name
4. Subject / Assignment
5. Step
6. Lane
7. Contract Days
8. Annual Salary (formula referencing Salary Schedule tab if possible, or green text if cross-referenced)
9. Monthly Pay (12-mo) = Annual Salary / 12
10. Daily Rate = Annual Salary / Contract Days
11. Benefits Tier (Single, EE+Spouse, Family)
12. FTE (default 1.0)

---

## Tab 5: Employer Cost — Current

### Layout
```
Row 1: Title — "EMPLOYER TOTAL COST OF EMPLOYMENT — [Year]"
Row 2: Subtitle — "Impact to the District | All costs borne by employer"
Row 4: Header Row
Rows 5+: One row per employee
Last data row + 1: TOTALS row with SUM formulas
```

### Required Columns
1. Emp ID
2. Name (First Last)
3. Step
4. Lane
5. Contract Days
6. Base Salary
7. District-Paid Employee Retirement (if applicable)
8. Employer Retirement Contribution
9. Employer Insurance Fund (THIS, if applicable)
10. Medicare 1.45%
11. Social Security 6.2% (if applicable, else omit column)
12. SUTA
13. Workers Comp
14. Medical (ER Share)
15. Dental (ER Share)
16. Vision (ER Share)
17. Life + LTD
18. TOTAL EMPLOYER COST (bold, sum of columns 6-17)

---

## Tab 6: Employee Cost — Current

### Layout
```
Row 1: Title — "EMPLOYEE IMPACT — [Year]"
Row 2: Subtitle — "Impact to the Teacher | Deductions from gross pay | [Pay distribution]"
Row 3: Note (if applicable) — "Note: District pays the [X]% [pension] on behalf of employee"
Row 5: Header Row
Rows 6+: One row per employee
Last data row + 1: TOTALS row
```

### Required Columns
1. Emp ID
2. Name
3. Step
4. Lane
5. Gross Salary
6. Employee Retirement Deduction (or $0 if district-paid — gray text)
7. Employee Insurance Fund (THIS, if applicable)
8. Medicare 1.45%
9. Social Security 6.2% (if applicable)
10. Federal Income Tax (effective rate)
11. State Income Tax
12. Medical (EE Share)
13. Dental (EE Share)
14. Vision (EE Share)
15. Total Deductions (sum of columns 6-14)
16. Net Take-Home (Annual) = Gross - Total Deductions (bold green text)
17. Monthly Take-Home = Net / 12 (bold green text)

### Color Rules for Employee Tab
- Gross salary: Green text
- All deductions: Red text (#CC0000)
- District-paid retirement: Gray text (#999999) showing $0
- Net take-home: Bold green text (#008000)
- Monthly take-home: Bold green text (#008000)

---

## Tab 7: Incremental Cost Analysis

### Layout
This tab has TWO sections stacked vertically:

**Section 1: EMPLOYER IMPACT**
```
Row 1: Title
Row 2: Subtitle with projection methodology
Row 3: "EMPLOYER IMPACT" section label
Row 5: Header Row
Rows 6+: One row per employee
Totals Row: SUM formulas with yellow background
```

**Section 2: EMPLOYEE IMPACT** (starts 3 rows below employer totals)
```
Section Header: "EMPLOYEE IMPACT"
Header Row
Rows: One row per employee
Totals Row: SUM formulas with yellow background
```

### Employer Impact Columns
1. Emp ID
2. Name
3. Current Step
4. Projected Step
5. Lane
6. Current Salary
7. Projected Salary
8. Salary Increase $ (blue text)
9. Current Total ER Cost
10. Projected Total ER Cost
11. Incremental ER Cost (bold red text)

### Employee Impact Columns
1. Emp ID
2. Name
3. Lane
4. Current Gross
5. Projected Gross
6. Gross Increase
7. Current Total Deductions
8. Projected Total Deductions
9. Current Net Take-Home
10. Projected Net Take-Home
11. Net Take-Home Increase (bold green text)

### Projection Assumptions to Apply
- Step advancement: +1 step per year (capped at lane maximum)
- Schedule increase: Per CBA terms or CPI-U estimate
- Benefits trend: 5% annual increase on insurance premiums
- Tax rates: Hold constant (conservative assumption)
- Headcount: Hold constant unless user specifies attrition

---

## Code Generation Rules

### Python Script Structure
```python
import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import random

# 1. Define constants (colors, fonts, formats)
# 2. Create workbook
# 3. Build each tab in order
# 4. Use Excel formulas for all calculations
# 5. Apply formatting
# 6. Save to /home/claude/output.xlsx
# 7. Recalculate with recalc.py
# 8. Copy to /mnt/user-data/outputs/
```

### Formula Requirements
- TOTALS rows: Always use `=SUM(range)` formulas
- Monthly pay: `=H{row}/12` (reference annual salary cell)
- Daily rate: `=H{row}/G{row}` (salary / contract days)
- Cross-sheet references: Use sheet name if needed (e.g., `='Salary Schedule'!B6`)
- Never hardcode calculated values — always use formulas

### Recalculation
After saving the workbook, ALWAYS run:
```bash
python /mnt/skills/public/xlsx/scripts/recalc.py output.xlsx
```
Check the output JSON for errors. If errors exist, fix and re-run.
