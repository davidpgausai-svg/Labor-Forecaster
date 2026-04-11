# Domain: Teacher Retirement Systems by State

## Purpose
This file contains the rules for calculating retirement/pension contributions for K-12 teachers. These calculations are the most frequently mismodeled component in CBA cost analysis. The critical facts: most teachers do NOT pay Social Security, contribution rates vary by state, and the employer often picks up the employee's share.

## Universal Rules

### Social Security Exemption
Teachers in the following states are EXEMPT from Social Security (6.2% FICA) because their pension system replaces it. They still pay Medicare (1.45%):

**Fully exempt (no SS for teachers):** Alaska, California, Colorado, Connecticut, Georgia (some), Illinois, Kentucky (some), Louisiana, Maine, Massachusetts, Missouri, Nevada, Ohio, Rhode Island (some), Texas

**Partially exempt (varies by district):** Georgia, Kentucky, Rhode Island, Minnesota (some Minneapolis teachers)

**All other states:** Teachers pay both Social Security (6.2%) AND their state pension contribution. This creates a higher total deduction rate.

### When District Pays Employee Contribution
Many CBAs contain a provision where the district "picks up" or "shelters" the employee's retirement contribution. This means:
- The employee's gross salary is effectively higher (grossed-up)
- The district's cost includes base salary PLUS the employee's retirement percentage
- The employee does NOT see this deduction on their paycheck
- For IRS purposes, the contribution is still "employee" money — it's tax-sheltered

When you see this provision, model it as:
- **Employer cost**: Base Salary + (Base Salary × Employee Rate) + (Base Salary × Employer Rate)
- **Employee deduction**: $0 for retirement (district pays it)

## State-by-State Reference

### Illinois — Teachers' Retirement System (TRS)
- **Employee contribution**: 9.0% of creditable earnings
- **Employer contribution**: 0.58% of creditable earnings
- **THIS Fund (health insurance)**: Employee 0.90%, Employer 0.67%
- **Social Security**: NO — TRS replaces SS
- **Medicare**: YES — 1.45% each
- **Common CBA provision**: District pays the employee's 9.0% TRS contribution. This is extremely common in Illinois suburban districts.
- **Tier 1** (hired before 1/1/2011): Retire at 55 with 35 years, or 62 with 5 years
- **Tier 2** (hired on/after 1/1/2011): Retire at 67 with 10 years. Earnings cap applies (~$127K in 2025-26).
- **Employer penalty**: If a teacher's salary increases more than 6% in any year, the employer pays an additional contribution on the excess to TRS.
- **Grossing-up calculation**: When district pays 9%, creditable earnings = Base × 1.098901 (so the 9% of the grossed-up amount equals 9.89% of the base).

### Ohio — State Teachers Retirement System (STRS Ohio)
- **Employee contribution**: 14.0% of gross salary
- **Employer contribution**: 14.0% of gross salary
- **Social Security**: NO
- **Medicare**: YES — 1.45% each
- **Common CBA provision**: Some districts pay a portion (often 100%) of the employee's 14%
- **Note**: Ohio has the highest combined contribution rate in the nation (28% total)

### California — CalSTRS
- **Employee contribution**: 10.25% (2024-25)
- **Employer contribution**: 19.10% (2024-25)
- **Social Security**: NO
- **Medicare**: YES — 1.45% each
- **Note**: CalSTRS employer rate has been increasing annually and is among the highest in the nation

### Texas — Teacher Retirement System of Texas (TRS)
- **Employee contribution**: 8.25%
- **Employer contribution**: 8.25% (state pays most of this; district contribution varies)
- **Social Security**: NO
- **Medicare**: Most Texas teachers DO pay Medicare, but some districts opted out before 1986. Always verify.
- **TRS-Care**: Retiree health insurance. Active employee contribution: 0.65%. Employer: 0.75%. State: 0.75%.

### New York — New York State Teachers' Retirement System (NYSTRS)
- **Employee contribution**: Tier 6 members (hired after 4/1/2012): 3-6% based on salary (graduated scale). After 10 years: 0%.
- **Employer contribution**: Variable, set annually by NYSTRS actuary. Typically 9-12% of salary.
- **Social Security**: YES — NY teachers pay SS + pension
- **Medicare**: YES — 1.45% each

### Pennsylvania — Public School Employees' Retirement System (PSERS)
- **Employee contribution**: 7.5% (most members). Some at 10.3% depending on election.
- **Employer contribution**: Set annually by PSERS actuary. 2024-25 rate: ~35.26% of payroll. (Yes, 35%+ — PA has massive unfunded liability.)
- **Social Security**: YES — PA teachers pay SS + PSERS
- **Medicare**: YES — 1.45% each
- **Note**: PA's employer contribution is the single largest non-salary cost item and is the primary driver of school budget stress in the state.

### Michigan — Michigan Public School Employees Retirement System (MPSERS)
- **Employee contribution**: 3.0-7.0% depending on plan election
- **Employer contribution**: ~20.96% (combined pension + retiree healthcare)
- **Social Security**: YES — MI teachers pay SS + MPSERS
- **Medicare**: YES — 1.45% each

### Wisconsin — Wisconsin Retirement System (WRS)
- **Employee contribution**: 6.90% (2024)
- **Employer contribution**: 6.90% (2024) — WRS is 50/50 by law
- **Social Security**: YES — WI teachers pay SS + WRS
- **Medicare**: YES — 1.45% each
- **Note**: After Act 10, many districts no longer pick up the employee's share

### Minnesota — Teachers Retirement Association (TRA)
- **Employee contribution**: 7.75%
- **Employer contribution**: 8.56%
- **Social Security**: Most MN teachers pay SS + TRA (except some Minneapolis and St. Paul teachers)
- **Medicare**: YES

### New Jersey — Teachers' Pension and Annuity Fund (TPAF)
- **Employee contribution**: 7.5% of base salary
- **Employer contribution**: State pays the employer share (not the local district)
- **Social Security**: YES — NJ teachers pay SS + TPAF
- **Medicare**: YES

### Connecticut — Connecticut Teachers' Retirement Board (CTRB)
- **Employee contribution**: 7.0%
- **Employer contribution**: State pays (not the local district) — ~31% of payroll
- **Social Security**: NO — CT teachers are exempt from SS
- **Medicare**: YES
- **Note**: Town/district does NOT pay the pension contribution — the state does. But the town DOES pay Medicare.

### Massachusetts — Massachusetts Teachers' Retirement System (MTRS)
- **Employee contribution**: 11% (hired after 7/1/2001). Earlier tiers at 5-9%.
- **Employer contribution**: State reimburses (not local district)
- **Social Security**: NO
- **Medicare**: YES (for those hired after 3/31/1986)

## Default Assumptions When State is Unknown

If you cannot determine the state from the CBA, use these conservative defaults:
- Employee retirement contribution: 9.0%
- Employer retirement contribution: 10.0%
- Social Security: Assume NO (pension-covered)
- Medicare: YES — 1.45% each
- District pays employee share: Assume NO unless CBA says otherwise

## How to Apply in the Cost Model

### Employer Cost Tab
```
Base Salary
+ District-Paid Employee TRS (if applicable) = Salary × Employee Rate
+ Employer TRS Contribution = Salary × Employer Rate
+ Employer THIS/Insurance Fund (if applicable) = Salary × THIS Rate
+ Medicare (Employer) = Salary × 1.45%
+ Social Security (Employer) = Salary × 6.2% [ONLY if state requires SS]
```

### Employee Cost Tab
```
Gross Salary
- Employee TRS Deduction = Salary × Employee Rate [if NOT district-paid]
  OR $0 [if district pays the employee share]
- Employee THIS/Insurance Fund (if applicable) = Salary × THIS Rate
- Medicare (Employee) = Salary × 1.45%
- Social Security (Employee) = Salary × 6.2% [ONLY if state requires SS]
- Federal Income Tax (estimated effective rate)
- State Income Tax
- Insurance premiums (employee share)
= Net Take-Home Pay
```

### Critical: TRS Grossing-Up
When the district pays the employee's TRS contribution, the IRS requires "grossing up" the creditable earnings. Example for Illinois (9% TRS):

- Base salary: $60,000
- Grossed-up creditable earnings: $60,000 ÷ 0.91 = $65,934.07
- Employee TRS contribution (paid by district): $65,934.07 × 9% = $5,934.07
- This is more than $60,000 × 9% = $5,400

**For simplicity in the cost model**, you may use the straight percentage (Base × 9%) unless the user specifically requests gross-up calculations. Note the simplification in the Assumptions tab.
