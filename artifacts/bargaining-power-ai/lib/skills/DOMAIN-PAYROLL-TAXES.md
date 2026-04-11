# Domain: Payroll Taxes for K-12 School Districts

## Purpose
This file provides rules for calculating employer and employee payroll tax obligations for teachers. The most critical distinction: most teachers in pension-covered states do NOT pay Social Security.

## Federal Taxes

### Medicare (FICA - Hospital Insurance)
- **Employee**: 1.45% of all wages (no cap)
- **Employer**: 1.45% of all wages (no cap)
- **Additional Medicare**: 0.9% employee-only on wages over $200,000 (rarely applies to teachers)
- **Applies to**: ALL teachers in ALL states, regardless of pension system
- **Applied to**: Base salary + stipends + extra-duty pay

### Social Security (FICA - OASDI)
- **Employee**: 6.2% of wages up to the taxable maximum ($176,100 in 2025)
- **Employer**: 6.2% of wages up to the taxable maximum
- **DOES NOT APPLY** to teachers in pension-covered states that opted out of SS (see DOMAIN-RETIREMENT-SYSTEMS.md)
- **DOES APPLY** to teachers in states where they participate in both SS and a pension (NY, PA, MI, WI, NJ, and others)

### Federal Unemployment Tax (FUTA)
- **Rate**: 6.0% on first $7,000 of wages per employee
- **Credit**: Up to 5.4% credit for state unemployment taxes paid on time
- **Effective rate**: Typically 0.6% on first $7,000 = $42 per employee maximum
- **IMPORTANT**: Public school districts in most states are EXEMPT from FUTA. Government entities can choose to be "reimbursing employers" instead of paying FUTA.
- **Default for K-12 modeling**: EXCLUDE FUTA unless the user specifically indicates the district pays it. Most public school districts do NOT pay FUTA.

### Federal Income Tax (Employee Only)
For estimating employee take-home pay, apply an effective federal tax rate. Do NOT attempt to calculate precise withholding — too many variables (filing status, dependents, other income, deductions).

**Default effective rates by salary range:**
| Salary Range | Effective Federal Rate |
|---|---|
| $40,000 - $55,000 | 10-12% |
| $55,000 - $75,000 | 12-14% |
| $75,000 - $100,000 | 14-17% |
| $100,000 - $130,000 | 17-20% |
| $130,000+ | 20-24% |

**Default for modeling**: Use 15% effective rate for the average teacher salary. This slightly overstates tax for lower-paid teachers and understates for higher-paid, but produces a reasonable aggregate estimate.

**Note in Assumptions tab**: "Federal income tax estimated at [X]% effective rate. Actual tax varies by filing status, deductions, and other income. This is an estimate for modeling purposes only."

## State Income Taxes

### States with No Income Tax
Alaska, Florida, Nevada, New Hampshire (interest/dividends only), South Dakota, Tennessee (interest/dividends only), Texas, Washington, Wyoming

For teachers in these states, state income tax = $0.

### Key State Rates for Target Markets

| State | Tax Structure | Effective Rate for Teachers |
|---|---|---|
| Illinois | Flat 4.95% | 4.95% |
| Ohio | Graduated 0-3.75% | ~2.5-3.0% effective |
| Michigan | Flat 4.25% | 4.25% |
| Minnesota | Graduated 5.35-9.85% | ~5.5-6.5% effective |
| Wisconsin | Graduated 3.54-7.65% | ~4.5-5.5% effective |
| New Jersey | Graduated 1.4-10.75% | ~4.0-5.5% effective |
| Connecticut | Graduated 3.0-6.99% | ~4.5-5.5% effective |
| Massachusetts | Flat 5.0% (+ 4% surtax >$1M) | 5.0% |
| Pennsylvania | Flat 3.07% | 3.07% |
| New York | Graduated 4.0-10.9% | ~5.0-6.5% effective |
| California | Graduated 1.0-13.3% | ~4.0-6.0% effective |
| Texas | None | 0% |

### Local/City Income Taxes
Some jurisdictions levy additional local income taxes:
- **Ohio**: Many cities levy 1.0-2.5% municipal income tax
- **Pennsylvania**: Local EIT (Earned Income Tax) of 1.0-3.0% depending on municipality
- **New York City**: Additional 3.078-3.876% for NYC residents
- **Michigan**: Some cities (Detroit, Grand Rapids) levy 1.0-2.4%

**Default**: Do NOT include local taxes unless the user specifies a locality known to have them. Note in Assumptions: "Local/municipal income taxes excluded. Add [X]% if applicable."

## State Unemployment Tax (SUTA)

### Public School District Treatment
Like FUTA, public school districts in most states are exempt from standard SUTA contributions. They can choose to:
1. **Pay contributions** like a private employer (experience-rated)
2. **Self-insure / reimburse** — pay dollar-for-dollar for actual unemployment claims

### Default for K-12 Modeling
- **If modeling as a standard employer** (for comparison purposes): Use the state's new employer rate or average rate
- **If modeling as a public employer**: Use a minimal rate or exclude entirely

**Conservative default**: Include SUTA at the state's new employer rate applied to the state's taxable wage base. This slightly overstates cost but ensures the model doesn't undercount.

### Key State SUTA Rates and Wage Bases

| State | New Employer Rate | Wage Base |
|---|---|---|
| Illinois | 3.175% | $13,590 |
| Ohio | 2.7% | $9,000 |
| California | 3.4% | $7,000 |
| Texas | 2.7% | $9,000 |
| New York | 4.025% | $12,500 |
| Pennsylvania | 3.6890% | $10,000 |
| Michigan | 2.7% | $9,500 |
| Wisconsin | 2.71% | $14,000 |
| Minnesota | 1.0% (new) | $42,000 |
| New Jersey | 2.8% | $42,300 |
| Connecticut | 3.0% | $25,000 |
| Massachusetts | 1.87% | $15,000 |

**Default if state unknown**: 3.0% on first $12,000 = $360 per employee maximum.

### SUTA Modeling
- SUTA is ALWAYS employer-only (employees do not pay SUTA in most states)
- Exception: Alaska, New Jersey, and Pennsylvania have small employee SUTA contributions
- Apply rate only to wages up to the taxable wage base, NOT total salary
- Formula: `MIN(salary, wage_base) × rate`

## Summary: Tax Components in the Cost Model

### Employer Tax Costs Per Employee
```
Medicare (1.45%)                    = Salary × 0.0145
Social Security (6.2%)             = Salary × 0.062 [ONLY if state requires]
FUTA (0.6%)                        = MIN(Salary, $7,000) × 0.006 [Usually exempt for K-12]
SUTA                               = MIN(Salary, Wage Base) × State Rate
Retirement - Employer Share         = Salary × Employer Pension Rate
Retirement - District-Paid EE Share = Salary × Employee Pension Rate [if CBA requires]
THIS/Insurance Fund                 = Salary × THIS Rate [if applicable, e.g., IL]
```

### Employee Tax Deductions
```
Medicare (1.45%)                    = Salary × 0.0145
Social Security (6.2%)             = Salary × 0.062 [ONLY if state requires]
Federal Income Tax                  = Salary × Effective Rate (~15%)
State Income Tax                    = Salary × State Rate
Retirement - Employee Share         = Salary × Employee Pension Rate [if NOT district-paid]
THIS/Insurance Fund                 = Salary × THIS Rate [if applicable]
```

## Formatting Rules for Tax Cells in Excel
- All tax rates should be stored as assumptions (blue font, separate cells)
- All tax calculations should reference the assumption cells (black font, formulas)
- Label headers should specify the rate: "Medicare 1.45%", "SUTA 3.175%"
- SUTA calculations must use MIN() to cap at wage base
