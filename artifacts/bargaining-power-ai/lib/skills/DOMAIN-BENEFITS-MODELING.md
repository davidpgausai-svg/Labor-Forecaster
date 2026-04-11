# Domain: Benefits Modeling for K-12 School Districts

## Purpose
This file provides rules for modeling the employer and employee cost of health and welfare benefits in a school district CBA cost model. Benefits are the second-largest cost after salary and the hardest to predict because of compounding annual trend increases.

## Health Insurance

### Tier Structure
Almost all school district health plans use a 3-4 tier structure:

| Tier | Also Called |
|---|---|
| Single / Employee Only | EE, Individual |
| Employee + Spouse | EE+SP, Two-Party |
| Employee + Child(ren) | EE+CH, Parent+Child(ren) |
| Family | EE+Family, Full Family |

Some districts use only 3 tiers (Single, EE+1, Family). Map "EE+1" to EE+Spouse for modeling purposes.

### Premium Ranges by Region (Annual, 2024-25)
These are TOTAL premiums (employer + employee combined). Use these when the CBA does not specify dollar amounts but does specify a percentage split.

| Tier | Low (Rural/South) | Mid (Suburban/Midwest) | High (Urban/Northeast/CA) |
|---|---|---|---|
| Single | $7,200 | $9,600 | $12,000 |
| EE+Spouse | $14,400 | $19,200 | $24,000 |
| EE+Child(ren) | $13,200 | $17,400 | $21,600 |
| Family | $20,400 | $26,400 | $33,600 |

### Default Premiums When CBA is Silent
If the CBA specifies a percentage split but not dollar amounts, use the **Mid** column above for Midwestern states (IL, OH, MI, WI, MN, IN, IA, MO) and adjust up/down by region.

### Premium Sharing Models
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

**Pattern 4: Flat Contribution**
"The Board shall contribute $800/month toward health insurance."
- Employer cost = $800 × 12 = $9,600/year
- Employee cost = Total Premium - $9,600

### Default Premium Sharing When CBA is Silent
If the CBA does not specify premium sharing, use:
- Employer pays 85% of Single
- Employer pays 80% of EE+Spouse
- Employer pays 75% of Family

### Employee Benefits Tier Distribution
When generating a synthetic roster, distribute employees across tiers:
- Single: 30-40% (default 35%)
- EE+Spouse: 20-30% (default 25%)
- Family: 35-45% (default 40%)

Note: Younger/less-experienced teachers skew toward Single. Senior teachers skew toward Family. If the roster has step distribution data, weight accordingly.

## Dental Insurance

### Typical Annual Premiums (2024-25)
| Tier | Total Premium |
|---|---|
| Single | $600-$900 |
| EE+Spouse | $1,000-$1,500 |
| Family | $1,500-$2,100 |

### Default Dental Modeling
- Use mid-range: Single $720, EE+Spouse $1,200, Family $1,800
- Employer typically pays 90-100% of single, 80-90% of family
- Default: Employer pays 90% across all tiers

## Vision Insurance

### Typical Annual Premiums (2024-25)
| Tier | Total Premium |
|---|---|
| Single | $120-$240 |
| EE+Spouse | $240-$420 |
| Family | $360-$540 |

### Default Vision Modeling
- Use mid-range: Single $180, EE+Spouse $300, Family $420
- Employer typically pays 90-100% of single, 80-90% of family
- Default: Employer pays 90% across all tiers

## Life Insurance

### Standard Provision
- Employer-paid basic life: $25,000-$50,000 coverage
- Annual cost to employer: $3-$8 per $1,000 of coverage
- Default assumption: $50,000 coverage at $6/$1,000 = $300/year per employee
- Some CBAs provide life insurance equal to 1x or 2x salary — model accordingly

## Long-Term Disability (LTD)

### Standard Provision
- Employer-paid, 60% of salary benefit after 90-180 day elimination period
- Annual cost to employer: Typically 0.4%-0.8% of covered payroll
- Default assumption: 0.6% of salary = ~$480/year for a $80K teacher
- Alternative flat rate: $30-$50/month per employee

## Short-Term Disability (STD)

### Modeling Approach
Most K-12 districts do NOT carry a separate STD policy. Instead, sick leave serves as the short-term disability mechanism. Do NOT include a separate STD cost unless the CBA specifically references an STD insurance policy.

## HSA / HRA Contributions

### When to Model
Only include HSA/HRA employer contributions if:
- The CBA specifically references an HDHP/HSA plan
- The CBA specifies a district contribution to the HSA

### Typical HSA Contributions
- Single: $500-$1,500/year
- Family: $1,000-$3,000/year
- These are IN ADDITION to premium sharing, not a replacement

## Benefits Trend Factor

### Annual Premium Increases
Health insurance premiums increase every year. The long-term average is 5-7% annually. For projecting future years:

| Projection Year | Conservative Trend | Moderate Trend | Aggressive Trend |
|---|---|---|---|
| Year 2 | 4.0% | 5.5% | 7.0% |
| Year 3 | 4.0% | 5.5% | 7.0% |
| Year 4 | 4.0% | 5.5% | 7.0% |
| Year 5 | 4.0% | 5.5% | 7.0% |

### Default: Use 5.0% Annual Trend
Unless the user specifies otherwise or the CBA contains a cap on premium increases, apply a 5.0% annual trend factor to all insurance premiums (medical, dental, vision) when projecting future years.

### How Trend Interacts with CBA Premium Sharing
If the CBA fixes the employer's percentage (e.g., "Board pays 85%"), the trend increase is shared proportionally — the employer absorbs 85% of the increase, the employee absorbs 15%.

If the CBA fixes a dollar cap (e.g., "Board pays up to $15,000"), the entire trend increase above the cap falls on the employee. This is a critical distinction for employee impact analysis.

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

### Modeling Workers' Comp
- Workers' comp is ALWAYS an employer cost, never an employee deduction
- Apply rate to total payroll (base salary + stipends)
- Use the state-specific rate if known, otherwise default to 0.5% of payroll

## Summary: Benefits Cost Components

### Employer Cost Per Employee (order of magnitude)
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

### Employee Cost Per Employee (order of magnitude)
```
Medical Insurance (EE share)    $1,000 - $6,000
Dental Insurance (EE share)        $60 - $300
Vision Insurance (EE share)        $20 - $60
───────────────────────────────────────────────
Total EE Benefits Deduction     $1,080 - $6,360
```
