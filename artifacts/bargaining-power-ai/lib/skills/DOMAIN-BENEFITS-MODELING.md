# Domain: Benefits Modeling for K-12 School Districts and Healthcare/Union Employers

## Purpose
This file provides rules for modeling the employer and employee cost of health and welfare benefits in a CBA cost model. It covers two distinct benefit architectures:

1. **Employer-administered plans** — typical in K-12 school districts, where the employer selects and manages insurance plans and shares premiums with employees
2. **Taft-Hartley multi-employer benefit funds** — typical in healthcare, building trades, hotel/hospitality, and other heavily-unionized private sectors, where the employer contributes a fixed rate to a jointly-trusteed fund that administers all benefits

Identify which architecture applies before modeling. The two systems calculate very differently.

---

## PART 1: EMPLOYER-ADMINISTERED PLANS (K-12 School Districts)

### Health Insurance

#### Tier Structure
Almost all school district health plans use a 3-4 tier structure:

| Tier | Also Called |
|---|---|
| Single / Employee Only | EE, Individual |
| Employee + Spouse | EE+SP, Two-Party |
| Employee + Child(ren) | EE+CH, Parent+Child(ren) |
| Family | EE+Family, Full Family |

Some districts use only 3 tiers (Single, EE+1, Family). Map "EE+1" to EE+Spouse for modeling purposes.

#### Premium Ranges by Region (Annual, 2024-25)
These are TOTAL premiums (employer + employee combined). Use these when the CBA does not specify dollar amounts but does specify a percentage split.

| Tier | Low (Rural/South) | Mid (Suburban/Midwest) | High (Urban/Northeast/CA) |
|---|---|---|---|
| Single | $7,200 | $9,600 | $12,000 |
| EE+Spouse | $14,400 | $19,200 | $24,000 |
| EE+Child(ren) | $13,200 | $17,400 | $21,600 |
| Family | $20,400 | $26,400 | $33,600 |

#### Default Premiums When CBA is Silent
If the CBA specifies a percentage split but not dollar amounts, use the **Mid** column above for Midwestern states (IL, OH, MI, WI, MN, IN, IA, MO) and adjust up/down by region.

#### Premium Sharing Models
CBAs define premium sharing in one of these patterns:

**Pattern 1: Percentage Split**
"The Board shall pay 90% of the premium for single coverage and 80% of the premium for family coverage."
- Employer cost = Total Premium × Board %
- Employee cost = Total Premium × (1 - Board %)

**Pattern 2: Dollar Cap**
"The Board's contribution toward health insurance shall not exceed $15,000 per employee per year."
- Employer cost = MIN(Total Premium, $15,000)
- Employee cost = MAX(Total Premium - $15,000, 0)

**Pattern 3: Base Plan + Buy-Up**
"The Board shall pay 100% of the HMO plan. Employees electing PPO shall pay the difference."
- Employer cost = HMO premium
- Employee cost = PPO premium - HMO premium (if electing PPO), or $0 (if electing HMO)

**Pattern 4: Flat Monthly Contribution**
"The Board shall contribute $800/month toward health insurance."
- Employer cost = $800 × 12 = $9,600/year
- Employee cost = Total Premium - $9,600

#### Default Premium Sharing When CBA is Silent
If the CBA does not specify premium sharing, use:
- Employer pays 85% of Single
- Employer pays 80% of EE+Spouse
- Employer pays 75% of Family

#### Employee Benefits Tier Distribution
When generating a synthetic roster, distribute employees across tiers:
- Single: 30-40% (default 35%)
- EE+Spouse: 20-30% (default 25%)
- Family: 35-45% (default 40%)

Note: Younger/less-experienced workers skew toward Single. Senior workers skew toward Family.

### Dental Insurance

#### Typical Annual Premiums (2024-25)
| Tier | Total Premium |
|---|---|
| Single | $600-$900 |
| EE+Spouse | $1,000-$1,500 |
| Family | $1,500-$2,100 |

#### Default Dental Modeling
- Use mid-range: Single $720, EE+Spouse $1,200, Family $1,800
- Employer typically pays 90-100% of single, 80-90% of family
- Default: Employer pays 90% across all tiers

### Vision Insurance

#### Typical Annual Premiums (2024-25)
| Tier | Total Premium |
|---|---|
| Single | $120-$240 |
| EE+Spouse | $240-$420 |
| Family | $360-$540 |

#### Default Vision Modeling
- Use mid-range: Single $180, EE+Spouse $300, Family $420
- Employer typically pays 90-100% of single, 80-90% of family
- Default: Employer pays 90% across all tiers

### Life Insurance

#### Standard Provision
- Employer-paid basic life: $25,000-$50,000 coverage
- Annual cost to employer: $3-$8 per $1,000 of coverage
- Default assumption: $50,000 coverage at $6/$1,000 = $300/year per employee
- Some CBAs provide life insurance equal to 1x or 2x salary — model accordingly

### Long-Term Disability (LTD)

#### Standard Provision
- Employer-paid, 60% of salary benefit after 90-180 day elimination period
- Annual cost to employer: Typically 0.4%-0.8% of covered payroll
- Default assumption: 0.6% of salary = ~$480/year for a $80K teacher
- Alternative flat rate: $30-$50/month per employee

### Short-Term Disability (STD)

#### Modeling Approach
Most K-12 districts do NOT carry a separate STD policy. Instead, sick leave serves as the short-term disability mechanism. Do NOT include a separate STD cost unless the CBA specifically references an STD insurance policy.

### HSA / HRA Contributions

#### When to Model
Only include HSA/HRA employer contributions if:
- The CBA specifically references an HDHP/HSA plan
- The CBA specifies a district contribution to the HSA

#### Typical HSA Contributions
- Single: $500-$1,500/year
- Family: $1,000-$3,000/year
- These are IN ADDITION to premium sharing, not a replacement

### Benefits Trend Factor (Employer-Administered Plans)

#### Annual Premium Increases
Health insurance premiums increase every year. The long-term average is 5-7% annually.

| Projection Year | Conservative Trend | Moderate Trend | Aggressive Trend |
|---|---|---|---|
| Year 2 | 4.0% | 5.5% | 7.0% |
| Year 3 | 4.0% | 5.5% | 7.0% |
| Year 4 | 4.0% | 5.5% | 7.0% |
| Year 5 | 4.0% | 5.5% | 7.0% |

#### Default: Use 5.0% Annual Trend
Unless the user specifies otherwise or the CBA contains a cap on premium increases, apply a 5.0% annual trend factor to all insurance premiums (medical, dental, vision) when projecting future years.

#### How Trend Interacts with CBA Premium Sharing
If the CBA fixes the employer's percentage (e.g., "Board pays 85%"), the trend increase is shared proportionally — the employer absorbs 85% of the increase, the employee absorbs 15%.

If the CBA fixes a dollar cap (e.g., "Board pays up to $15,000"), the entire trend increase above the cap falls on the employee. This is a critical distinction for employee impact analysis.

---

## PART 2: TAFT-HARTLEY MULTI-EMPLOYER BENEFIT FUNDS

### What Is a Taft-Hartley Fund?
A Taft-Hartley fund (also called a "joint labor-management trust fund") is a separately incorporated entity governed jointly by trustees appointed by the union and employer(s). The employer does not administer benefits directly — instead, it contributes a specified rate to the fund, and the fund's trustees determine what benefits to provide.

**Common in:** Healthcare (1199SEIU, SEIU, AFSCME), building trades (carpenters, electricians, plumbers), hotel/hospitality, supermarkets, trucking, entertainment.

**Key distinction from employer-administered plans:**
- The employer has NO control over plan design — trustees set benefits
- Employees typically pay **zero premium** — the fund covers all costs from employer contributions
- Employer liability is capped at the contribution rate — cost overruns are handled by the fund
- The contribution rate is typically negotiated in the CBA; benefit levels are set by the trustees separately

### Pattern 5: Flat PMPY (Per-Member-Per-Year) Rate
The most common Taft-Hartley contribution structure for healthcare and service workers.

"The Employer shall contribute to the [Fund Name] at the Required Contribution Rate (RCR) of $X per covered member per year."

- Employer cost = RCR × number of covered employees
- Employee premium cost = $0 (fund provides benefits at no cost to employee)
- **This rate is NOT tied to the employee's coverage tier** — there is no single/family distinction in employer cost
- The RCR is set by the fund's actuary, not directly by the CBA — the CBA may specify the rate or a schedule of rates

**Modeling:**
```
Annual employer benefit cost = PMPY Rate × FTE headcount
```

Do NOT model tier distribution (single/family) for PMPY funds — the employer pays the same per head regardless.

### Pattern 6: Percentage of Gross Wages (WC II/III)
Some Taft-Hartley CBAs use a percentage-of-payroll contribution as an alternative or supplement to the PMPY rate. Often applied to part-time workers or specific wage classes.

"Employers shall contribute [X]% of gross wages for Wage Class II and III employees."

- Employer cost = Total payroll for covered class × contribution %
- Employee premium cost = $0

**Modeling:**
```
Annual employer benefit cost = Gross Payroll × Contribution %
```

### NBF (National Benefit Fund) Structure — 1199SEIU Example
The 1199SEIU National Benefit Fund for Health and Human Service Employees is the largest healthcare Taft-Hartley fund in the US. Key modeling facts:
- WC I rate (hospitals): ~$19,772–$22,926+ per member per year (2021-2023), growing ~7-8% annually
- WC II/III rate (certain workers): percentage of gross wages (approximately 41-45%)
- Nursing homes use a separate, lower PMPY rate than hospitals
- The fund covers medical, dental, disability, death benefits, and PFL — all at zero employee cost
- The fund assumes the NY State Disability Benefits Law obligation — employer does NOT deduct disability premiums from wages

### Stacked Fund Contributions in Taft-Hartley CBAs
Taft-Hartley CBAs commonly require employer contributions to MULTIPLE funds beyond the health benefit fund. Always extract ALL fund contribution rates, not just the health fund. Common stack:

| Fund Type | Typical Rate | Notes |
|---|---|---|
| Health/Benefit Fund (NBF) | PMPY flat rate or % of wages | Primary benefit cost |
| Pension Fund | 8-15% of gross payroll | Defined benefit; employer only |
| Training & Upgrading Fund (TUF) | 0.25-1.0% of gross payroll | Workforce development |
| Job Security Fund (JSF) | 0.10-0.50% of gross payroll | May have balance cap trigger |
| Child Care Fund (CCF) | 0.25-1.0% of gross payroll | |
| Labor-Management Initiative (LMI) | Typically diverted from other funds | Usually $0 net additional cost |

**Total employer fund burden in 1199SEIU-type CBAs typically runs 13-16% of gross payroll PLUS the PMPY benefit contribution.**

### JSF Balance Cap Trigger
Watch for this common provision: "Contributions to the JSF shall be discontinued when the fund balance reaches $[X] million and shall resume when the balance falls below $[Y] million." When modeling multi-year projections, note this contingency — JSF contributions may not be required every year. Model at full rate as conservative assumption unless told otherwise.

### Benefit Trend for PMPY Funds
PMPY rates in Taft-Hartley funds typically increase faster than commercial insurance because they reflect actual claims experience of the covered population. Use a higher trend assumption than for employer-administered plans:

| Source | Annual Trend |
|---|---|
| Historical 1199SEIU NBF (2021-2023) | ~8% per year |
| General Taft-Hartley health fund trend | 7-10% per year |
| Conservative projection assumption | 7% per year |
| Default if no data | 8% per year |

**Do not use the 5% trend assumption from Part 1 for Taft-Hartley PMPY funds.** The 5% figure applies to commercial insurance premium sharing arrangements.

### Employee Cost Under Taft-Hartley
Employees covered by a Taft-Hartley benefit fund typically:
- Pay **$0 in health/dental/vision premiums**
- Pay **$0 in disability insurance premiums** (fund assumes this obligation)
- Have no benefits-related payroll deductions

This is a significant advantage for employee net take-home calculations. Always note this in the Assumptions tab: "NBF/Fund covers all health benefits at no premium cost to employees per CBA Article [X]."

---

## Workers' Compensation

### Standard Rates for K-12 Teachers
Teachers are classified under workers' comp class code 8868 (Schools – Professional Employees) in most states.

| State | Typical Rate per $100 of Payroll |
|---|---|
| Illinois | $0.40-$0.60 |
| Ohio | $0.35-$0.55 |
| California | $0.50-$0.80 |
| Texas | $0.30-$0.50 |
| New York | $0.45-$0.70 |
| Pennsylvania | $0.50-$0.75 |
| Default | $0.50 ($0.005 per dollar of payroll) |

### Standard Rates for Healthcare Workers (NY)
Hospital and healthcare workers in NY typically fall under class codes 8833 (hospital) or 8868 (professional). Use 0.50-0.70% of payroll as a conservative default for NY healthcare workers.

### Modeling Workers' Comp
- Workers' comp is ALWAYS an employer cost, never an employee deduction
- Apply rate to total payroll (base salary + stipends + differentials if significant)
- Use the state-specific rate if known, otherwise default to 0.5% of payroll

---

## Summary: Benefits Cost Components

### Employer Cost Per Employee — Employer-Administered Plan (K-12)
```
Medical Insurance (ER share)    $8,000 - $25,000
Dental Insurance (ER share)       $650 - $1,900
Vision Insurance (ER share)       $160 - $480
Life Insurance                    $200 - $400
Long-Term Disability              $300 - $600
Workers' Compensation             $300 - $600
HSA Contribution (if applicable)  $500 - $3,000
───────────────────────────────────────────────
Total Benefits Per Employee    $10,110 - $31,980
```

### Employer Cost Per Employee — Taft-Hartley Fund (Healthcare, NYC-area 2023-24)
```
NBF/Benefit Fund (PMPY)        $20,000 - $25,000+
Pension Fund (11-15% payroll)   $7,000 - $18,000  (varies by salary)
TUF + JSF + CCF (1.0-2.0%)       $700 - $2,500    (varies by salary)
Workers' Compensation             $300 - $800
───────────────────────────────────────────────
Total Benefits Per Employee    $28,000 - $46,000+
(Note: higher than K-12 due to PMPY rate level and pension rate)
```

### Employee Benefits Deduction — Employer-Administered Plan (K-12)
```
Medical Insurance (EE share)    $1,000 - $6,000
Dental Insurance (EE share)        $60 - $300
Vision Insurance (EE share)        $20 - $60
───────────────────────────────────────────────
Total EE Benefits Deduction     $1,080 - $6,360
```

### Employee Benefits Deduction — Taft-Hartley Fund
```
Health/Dental/Vision Premium    $0
Disability Premium              $0
───────────────────────────────
Total EE Benefits Deduction     $0
```
