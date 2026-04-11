# Domain: Retirement Systems by State and Sector

## Purpose
This file contains the rules for calculating retirement/pension contributions for CBAs. It covers two fundamentally different pension architectures:

1. **Public defined-benefit pension systems** — for K-12 teachers and public employees, administered by state-level agencies (TRS, STRS, PERS, etc.)
2. **Taft-Hartley multi-employer pension funds** — for private-sector union workers in healthcare, trades, and services, administered by joint labor-management trustees

Identify which architecture applies before modeling. They calculate differently, have different social security rules, and have very different employer/employee contribution structures.

---

## PART 1: PUBLIC PENSION SYSTEMS (K-12 Teachers and Public Employees)

### Universal Rules

#### Social Security Exemption
Teachers in the following states are EXEMPT from Social Security (6.2% FICA) because their pension system replaces it. They still pay Medicare (1.45%):

**Fully exempt (no SS for teachers):** Alaska, California, Colorado, Connecticut, Georgia (some), Illinois, Kentucky (some), Louisiana, Maine, Massachusetts, Missouri, Nevada, Ohio, Rhode Island (some), Texas

**Partially exempt (varies by district):** Georgia, Kentucky, Rhode Island, Minnesota (some Minneapolis teachers)

**All other states:** Teachers pay both Social Security (6.2%) AND their state pension contribution. This creates a higher total deduction rate.

#### When District Pays Employee Contribution
Many CBAs contain a provision where the district "picks up" or "shelters" the employee's retirement contribution. This means:
- The employee's gross salary is effectively higher (grossed-up)
- The district's cost includes base salary PLUS the employee's retirement percentage
- The employee does NOT see this deduction on their paycheck
- For IRS purposes, the contribution is still "employee" money — it's tax-sheltered

When you see this provision, model it as:
- **Employer cost**: Base Salary + (Base Salary × Employee Rate) + (Base Salary × Employer Rate)
- **Employee deduction**: $0 for retirement (district pays it)

### State-by-State Reference

#### Illinois — Teachers' Retirement System (TRS)
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

#### Ohio — State Teachers Retirement System (STRS Ohio)
- **Employee contribution**: 14.0% of gross salary
- **Employer contribution**: 14.0% of gross salary
- **Social Security**: NO
- **Medicare**: YES — 1.45% each
- **Common CBA provision**: Some districts pay a portion (often 100%) of the employee's 14%
- **Note**: Ohio has the highest combined contribution rate in the nation (28% total)

#### California — CalSTRS
- **Employee contribution**: 10.25% (2024-25)
- **Employer contribution**: 19.10% (2024-25)
- **Social Security**: NO
- **Medicare**: YES — 1.45% each
- **Note**: CalSTRS employer rate has been increasing annually and is among the highest in the nation

#### Texas — Teacher Retirement System of Texas (TRS)
- **Employee contribution**: 8.25%
- **Employer contribution**: 8.25% (state pays most of this; district contribution varies)
- **Social Security**: NO
- **Medicare**: Most Texas teachers DO pay Medicare, but some districts opted out before 1986. Always verify.
- **TRS-Care**: Retiree health insurance. Active employee contribution: 0.65%. Employer: 0.75%. State: 0.75%.

#### New York — New York State Teachers' Retirement System (NYSTRS)
- **Employee contribution**: Tier 6 members (hired after 4/1/2012): 3-6% based on salary (graduated scale). After 10 years: 0%.
- **Employer contribution**: Variable, set annually by NYSTRS actuary. Typically 9-12% of salary.
- **Social Security**: YES — NY teachers pay SS + pension
- **Medicare**: YES — 1.45% each
- **Note**: NYSTRS covers public school teachers. Private-sector hospital and healthcare workers in NY are NOT in NYSTRS — they use Taft-Hartley pension funds (see Part 2).

#### Pennsylvania — Public School Employees' Retirement System (PSERS)
- **Employee contribution**: 7.5% (most members). Some at 10.3% depending on election.
- **Employer contribution**: Set annually by PSERS actuary. 2024-25 rate: ~35.26% of payroll. (Yes, 35%+ — PA has massive unfunded liability.)
- **Social Security**: YES — PA teachers pay SS + PSERS
- **Medicare**: YES — 1.45% each
- **Note**: PA's employer contribution is the single largest non-salary cost item and is the primary driver of school budget stress in the state.

#### Michigan — Michigan Public School Employees Retirement System (MPSERS)
- **Employee contribution**: 3.0-7.0% depending on plan election
- **Employer contribution**: ~20.96% (combined pension + retiree healthcare)
- **Social Security**: YES — MI teachers pay SS + MPSERS
- **Medicare**: YES — 1.45% each

#### Wisconsin — Wisconsin Retirement System (WRS)
- **Employee contribution**: 6.90% (2024)
- **Employer contribution**: 6.90% (2024) — WRS is 50/50 by law
- **Social Security**: YES — WI teachers pay SS + WRS
- **Medicare**: YES — 1.45% each
- **Note**: After Act 10, many districts no longer pick up the employee's share

#### Minnesota — Teachers Retirement Association (TRA)
- **Employee contribution**: 7.75%
- **Employer contribution**: 8.56%
- **Social Security**: Most MN teachers pay SS + TRA (except some Minneapolis and St. Paul teachers)
- **Medicare**: YES

#### New Jersey — Teachers' Pension and Annuity Fund (TPAF)
- **Employee contribution**: 7.5% of base salary
- **Employer contribution**: State pays the employer share (not the local district)
- **Social Security**: YES — NJ teachers pay SS + TPAF
- **Medicare**: YES

#### Connecticut — Connecticut Teachers' Retirement Board (CTRB)
- **Employee contribution**: 7.0%
- **Employer contribution**: State pays (not the local district) — ~31% of payroll
- **Social Security**: NO — CT teachers are exempt from SS
- **Medicare**: YES
- **Note**: Town/district does NOT pay the pension contribution — the state does. But the town DOES pay Medicare.

#### Massachusetts — Massachusetts Teachers' Retirement System (MTRS)
- **Employee contribution**: 11% (hired after 7/1/2001). Earlier tiers at 5-9%.
- **Employer contribution**: State reimburses (not local district)
- **Social Security**: NO
- **Medicare**: YES (for those hired after 3/31/1986)

### Default Assumptions When State is Unknown (Public Sector)

If you cannot determine the state from the CBA, use these conservative defaults:
- Employee retirement contribution: 9.0%
- Employer retirement contribution: 10.0%
- Social Security: Assume NO (pension-covered)
- Medicare: YES — 1.45% each
- District pays employee share: Assume NO unless CBA says otherwise

### How to Apply in the Cost Model (Public Pension)

#### Employer Cost Tab
```
Base Salary
+ District-Paid Employee TRS (if applicable) = Salary × Employee Rate
+ Employer TRS Contribution = Salary × Employer Rate
+ Employer THIS/Insurance Fund (if applicable) = Salary × THIS Rate
+ Medicare (Employer) = Salary × 1.45%
+ Social Security (Employer) = Salary × 6.2% [ONLY if state requires SS]
```

#### Employee Cost Tab
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

#### Critical: TRS Grossing-Up
When the district pays the employee's TRS contribution, the IRS requires "grossing up" the creditable earnings. Example for Illinois (9% TRS):

- Base salary: $60,000
- Grossed-up creditable earnings: $60,000 ÷ 0.91 = $65,934.07
- Employee TRS contribution (paid by district): $65,934.07 × 9% = $5,934.07
- This is more than $60,000 × 9% = $5,400

**For simplicity in the cost model**, you may use the straight percentage (Base × 9%) unless the user specifically requests gross-up calculations. Note the simplification in the Assumptions tab.

---

## PART 2: TAFT-HARTLEY MULTI-EMPLOYER PENSION FUNDS (Private Sector Union)

### What Is a Taft-Hartley Pension Fund?
A multi-employer defined benefit pension fund governed by joint labor-management trustees under ERISA. Common in healthcare, building trades, hospitality, retail food, and transportation. The employer contributes a fixed percentage of payroll; the fund trustees manage investments and set benefit levels.

**Key differences from public pension systems:**
- Employer contributes a percentage of gross payroll (similar to public pension)
- **Employee typically contributes NOTHING** — the pension is entirely employer-funded
- The fund is NOT a state agency — it is a private trust governed by ERISA
- Social Security status: Private-sector workers almost always pay Social Security in addition to the pension contribution
- Benefit formula is set by the trustees, not the CBA — the CBA only specifies the contribution rate

### Social Security for Taft-Hartley Workers
**Private-sector workers covered by Taft-Hartley pension funds almost universally pay Social Security.** Unlike public school teachers, private hospital workers, hotel employees, and building trades workers are subject to full FICA (6.2% SS + 1.45% Medicare) on both the employer and employee side.

The only exception: some legacy public hospital or quasi-public employer agreements may contain a provision explicitly prohibiting withdrawal from Social Security (e.g., 1199SEIU/League CBA Article XXIV, Section 3: "The Employer shall not withdraw from the Social Security Program"). This is a contractual lock-in, not a state exemption.

**Model SS for all private-sector Taft-Hartley workers unless the CBA explicitly exempts them.**

### 1199SEIU Health Care Employees Pension Fund — Reference Rates
The largest healthcare union pension fund in the US. Key modeling facts:
- **Employer contribution rate**: 11.30% of gross payroll (per 2021-2024 CBA)
- **Employee contribution**: $0 — entirely employer-funded
- **Covered payroll**: Gross payroll, excluding wages earned in first 2 months of employment
- **Benefit formula**: 1.60% × 10-year final average pay × years of credited future service (for participants commencing after 8/1/2009)
- **Waiting period**: 12 months from date of hire before service credit accrues (does not affect vesting or employer contributions)
- **Early retirement**: Modified to age 62.5 / 25 years (effective 1/2/2019); prior formula was 62/20
- **Retiree bonus provision**: Periodic one-time bonuses to retirees (e.g., 3% of annual pension benefit) may appear — these are fund-level costs, not modeled in the employer contribution rate

### Stacked Fund Contributions (Beyond the Pension Fund)
Taft-Hartley CBAs typically require contributions to multiple funds. The pension fund is one layer; always extract all of them. See `DOMAIN-BENEFITS-MODELING.md` for the full fund stack and modeling rules.

**Typical total fund burden for 1199SEIU-type agreements:**
```
Pension Fund                   11.30% of gross payroll
Training & Upgrading Fund       0.50% of gross payroll
Job Security Fund               0.25% of gross payroll
Child Care Fund                 0.50% of gross payroll
─────────────────────────────────────────────────────
Total (ex-benefits)            12.55% of gross payroll
PLUS NBF/Benefit Fund           PMPY flat rate (~$23K/head in 2023-24)
```

### Pension Contribution Diversions
Some Taft-Hartley CBAs include provisions where pension contributions can be temporarily diverted to another fund (e.g., to shore up the health fund). Watch for language like: "Pension Contribution Diversions... shall be as set forth in Attachment [X]." When this triggers, the employer's pension contribution goes to the benefit fund instead — net employer cost is unchanged but the pension fund receives less. Note in Assumptions but do not adjust the total cost calculation.

### Contribution Rate Changes During the Contract Term
Unlike public pension systems where actuaries set rates annually, Taft-Hartley CBAs typically fix the contribution rate for the life of the agreement. The rate may step up annually per a schedule in the CBA. Always extract the full schedule, not just the current year rate.

### How to Apply in the Cost Model (Taft-Hartley Pension)

#### Employer Cost Tab
```
Base Salary
+ Pension Fund Contribution = Gross Payroll × Employer Pension Rate (e.g., 11.30%)
+ Training Fund = Gross Payroll × TUF Rate (e.g., 0.50%)
+ Job Security Fund = Gross Payroll × JSF Rate (e.g., 0.25%)
+ Child Care Fund = Gross Payroll × CCF Rate (e.g., 0.50%)
+ Social Security (Employer) = MIN(Salary, SS Wage Base) × 6.2%
+ Medicare (Employer) = Salary × 1.45%
+ SUTA = MIN(Salary, State Wage Base) × State Rate
+ Workers' Compensation = Salary × WC Rate
+ Benefit Fund (NBF) = PMPY Rate × Headcount  [see DOMAIN-BENEFITS-MODELING.md]
```

#### Employee Cost Tab
```
Gross Salary
- Pension Deduction = $0  [employee contributes nothing]
- Social Security (Employee) = MIN(Salary, SS Wage Base) × 6.2%
- Medicare (Employee) = Salary × 1.45%
- Federal Income Tax (estimated effective rate)
- State Income Tax
- Health/Dental/Vision Premium = $0  [covered by Benefit Fund at no EE cost]
= Net Take-Home Pay
```

### Default Assumptions When Taft-Hartley Fund is Unknown
If you cannot identify the specific fund from the CBA, use these defaults for private-sector healthcare:
- Employer pension contribution: 10.0% of gross payroll
- Employee pension contribution: $0
- Social Security: YES — both employer and employee pay full 6.2%
- Medicare: YES — 1.45% each
- Health benefits: PMPY flat rate — use $20,000/member/year as conservative default for NYC/urban markets, $15,000 for other markets
- Employee health premium: $0
