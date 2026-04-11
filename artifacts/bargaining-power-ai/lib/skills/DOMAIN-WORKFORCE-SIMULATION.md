# Domain: Workforce Aging and Turnover Simulation

## Purpose
This file defines how to dynamically simulate the evolution of a teacher workforce over a multi-year CBA term. Static models assume the same 100 people sit in the same seats every year. Real workforces change: teachers retire, quit, get hired, earn degrees, age into benefit eligibility thresholds, and hit step caps. Each of these changes has a cost impact that compounds over time.

A proper workforce simulation answers: "What does this workforce look like in Year 3, and what does THAT workforce cost — not today's workforce at Year 3 prices?"

## Why Static Models Fail

A static projection takes today's roster and applies Year 3 salary increases and benefit trends. This overstates cost because it ignores:
- **Turnover replacement savings**: A Step 20/MA+30 teacher who retires ($95K) gets replaced by a Step 1/BA teacher ($42K) — saving $53K in salary alone
- **Topped-out teachers**: 20% of the workforce may already be at the max step. A static model still applies step increases to them — overstating step cost
- **Benefits tier shifts**: Younger new hires are more likely to elect single coverage ($9,600) vs. the family coverage ($26,400) of the retiring teacher

A static model also UNDERSTATES cost in some areas:
- **Longevity stipends**: Teachers crossing 15, 20, or 25-year thresholds may trigger longevity payments
- **Lane movement**: Teachers completing graduate work move to higher-paying lanes
- **Sick leave accumulation**: Long-tenured teachers build large cash-out liabilities

The simulation captures both effects.

## Simulation Architecture

### Year-by-Year Roster Evolution
For each projection year (Year 2, Year 3, Year 4, etc.), the simulation:

1. **Age the roster** — advance every teacher one step, one year of service
2. **Apply turnover** — remove departures, add replacements
3. **Apply lane movement** — move a percentage of teachers to higher lanes
4. **Recalculate eligibilities** — check for longevity, step cap, benefit changes
5. **Apply salary schedule changes** — new schedule for the projection year
6. **Calculate costs** — full employer and employee cost for the evolved roster

### The Evolved Roster Is the Input for the Next Year
Year 2's evolved roster becomes the starting roster for Year 3's simulation. This is sequential — you cannot calculate Year 3 without first calculating Year 2.

## Component 1: Turnover Modeling

### Turnover Rate Assumptions

| Workforce Segment | Annual Turnover Rate | Primary Reason |
|---|---|---|
| Steps 1-3 (Early Career) | 12-18% | Career change, relocation, burnout |
| Steps 4-8 (Mid-Early) | 6-10% | Relocation, family, career change |
| Steps 9-15 (Mid-Career) | 3-5% | Minimal — vested in pension, stable |
| Steps 16-22 (Late Career) | 2-4% | Some early retirement |
| Steps 23+ (Pre-Retirement) | 8-15% | Retirement eligibility |
| **Weighted Average** | **6-9%** | — |

### Default Turnover Rate
Use **8% overall** unless the user specifies otherwise. Weight toward early-career and pre-retirement as shown above.

### Selecting Who Departs
For simulation purposes, departures should be weighted by the turnover rates above. For a 100-person roster with 8% turnover:
- 8 departures total
- ~3 from Steps 1-5 (high early-career turnover)
- ~2 from Steps 6-15 (low mid-career turnover, but large population)
- ~1 from Steps 16-22 (low rate)
- ~2 from Steps 23+ (retirement-eligible)

### Replacement Assumptions
Each departure is replaced with a new hire. Default new-hire profile:

| Attribute | Default Value | Notes |
|---|---|---|
| Step | 1 | First-year teacher. Some districts hire at Step 2-3 for prior experience. |
| Lane | BA (50%), MA (40%), BA+15 (10%) | Reflects current teacher prep market |
| Contract Days | Same as departed teacher | Position-based, not person-based |
| Benefits Tier | Single (70%), EE+Spouse (20%), Family (10%) | Younger, fewer dependents |
| FTE | Same as departed teacher | 1.0 default |

### Turnover Cost Impact Calculation
```
For each departure/replacement pair:

Salary Savings = Departed Teacher Salary - Replacement Salary
Benefits Savings = Departed ER Benefits Cost - Replacement ER Benefits Cost
Tax Savings = Savings from lower salary reducing Medicare, retirement, etc.
Separation Cost = Sick Leave Cash-Out (if eligible) + any severance

Net Turnover Impact = Salary Savings + Benefits Savings + Tax Savings - Separation Cost
```

Typical net savings per turnover event: **$15,000-$45,000** when a senior teacher is replaced by a new hire.

### Aggregate Turnover Impact
```
Total Turnover Savings = SUM of Net Turnover Impact for all departures
```

For a 100-person roster with 8 departures, typical aggregate savings: **$80,000-$200,000/year**

This is significant — it often offsets 30-50% of the step advancement cost. Models that ignore turnover overstate incremental cost.

## Component 2: Step Advancement with Caps

### Step Cap Logic
Every salary schedule has a maximum step per lane. When a teacher reaches the max step, they receive no further step increase — they are "topped out."

```
For each employee:
    if current_step < max_step_for_lane:
        new_step = current_step + 1
        step_increase = Schedule[new_step][lane] - Schedule[current_step][lane]
    else:
        new_step = current_step  (stays the same)
        step_increase = $0
```

### Longevity Increments
Some CBAs provide additional compensation for teachers who have been at the max step for multiple years. Look for:
- "Longevity increment" / "Career increment"
- "Teachers at Step [max] for 3+ years shall receive an additional $X"
- "Off-schedule longevity payment of $1,500 after 25 years of service"

Model longevity as a separate line item, NOT as a modification to the salary schedule.

```
Longevity Payment = $X if (years_at_max_step >= threshold)
```

### Tracking Years at Max Step
In the simulation, track how long each topped-out teacher has been at max:
```
if employee was at max_step last year AND is still at max_step:
    years_at_max += 1
else if employee just reached max_step:
    years_at_max = 0
```

## Component 3: Lane Movement Simulation

### Annual Lane Movement
Each year, some teachers complete graduate coursework and move to a higher-paying lane.

**Default**: 5% of teachers NOT in the highest lane move one lane per year.

### Selection Logic
```
eligible_teachers = [t for t in roster if t.lane != highest_lane]
movers = random.sample(eligible_teachers, int(len(eligible_teachers) * lane_move_rate))
for teacher in movers:
    teacher.lane = next_lane(teacher.lane)
```

### Lane Movement Direction
Teachers only move UP (to more education). The lane order is:
```
BA → BA+15 → BA+30 → MA → MA+15 → MA+30 → MA+45 → MA+60 → PhD/EdD
```

Some teachers skip lanes (e.g., BA → MA directly). For simplicity, model single-lane advancement unless the user specifies otherwise.

### Lane Movement Cost
```
Lane Increase = Schedule[new_step][new_lane] - Schedule[new_step][old_lane]
```

This also cascades through retirement contributions, Medicare, etc.

## Component 4: Eligibility Changes Over Time

### Benefit Eligibility Thresholds
As teachers age and accumulate service years, they may cross thresholds that change their cost profile:

| Threshold | Trigger | Cost Impact |
|---|---|---|
| Pension vesting | 5-10 years of service | No direct cost change, but reduces turnover probability |
| Retiree health eligibility | 15-20 years + age 55 | Future liability — may affect OPEB calculations |
| Longevity pay | 20-25 years of service | Adds $1,000-$3,000/year |
| Sick leave cash-out eligibility | Retirement-eligible | Activates accumulated liability |
| Step cap | Max step reached | Stops step cost; may trigger longevity |
| Social Security WEP/GPO | Retirement with SS from other employment | Employee impact — not a district cost |

### Modeling Eligibility Changes
Track these thresholds per employee per simulation year:
```
for each employee in each projection year:
    years_of_service = starting_YOS + projection_year_offset
    
    if years_of_service >= longevity_threshold and not already_receiving_longevity:
        add longevity_payment to employer cost
    
    if years_of_service >= cash_out_eligibility and approaching_retirement:
        flag potential cash-out liability
```

### Benefits Tier Shifts Over Time
As the workforce ages, the distribution of health insurance tiers shifts:
- New hires (replacing retirees): More likely Single → reduces average benefit cost
- Existing teachers aging: Some move from Single to Family as they marry/have children
- Net effect over 3-4 year simulation: Slight decrease in average benefit cost (turnover effect dominates)

**Default assumption for simulation**: Hold existing teachers' benefit tiers constant. New hires use the new-hire tier distribution (70% Single, 20% EE+Spouse, 10% Family).

## Simulation Output

### Projected Roster Tab (Optional)
For multi-year simulations, generate a projected roster for each year showing the evolved workforce:

```
Headers: Emp ID | Name | Status | Step (Yr1) | Step (Yr2) | Step (Yr3) | Lane (Yr1) | Lane (Yr2) | Lane (Yr3) | Salary (Yr1) | Salary (Yr2) | Salary (Yr3)

Status values:
- "Active" — continuing employee
- "New Hire (Yr2)" — replacement for a departed teacher
- "Departed (Yr2)" — left the workforce (row grayed out)
- "Retired (Yr3)" — retired (row grayed out, cash-out noted)
```

### Simulation Summary Block
Add to the Multi-Year Summary in the Executive Summary or Incremental Cost tab:

```
WORKFORCE SIMULATION RESULTS
                            Year 1      Year 2      Year 3      Year 4
                            (Current)   (Projected) (Projected) (Projected)
─────────────────────────────────────────────────────────────────────────
Active Headcount            100         100         100         100
Departures                  —           8           8           8
    Retirements             —           3           2           3
    Voluntary Turnover      —           5           6           5
New Hires                   —           8           8           8
Teachers at Max Step        22          24          25          27
Average Step                11.4        10.8        10.3        9.9
Average Salary              $76,805     $78,200     $79,100     $80,500
Avg ER Cost per Teacher     $104,576    $107,100    $109,800    $112,600
─────────────────────────────────────────────────────────────────────────
Step Cost (with turnover)   —           $142,000    $148,000    $153,000
Step Cost (static, no turn) —           $185,000    $192,000    $198,000
Turnover Savings            —           ($43,000)   ($44,000)   ($45,000)
```

The "Step Cost (static)" vs. "Step Cost (with turnover)" comparison is extremely powerful — it shows the board exactly how much turnover naturally offsets cost growth.

### Sensitivity Analysis
For each projection, show two versions:
1. **Static model** — same roster, no turnover, no lane movement
2. **Dynamic model** — with turnover and lane movement simulation

The difference between these is the "workforce evolution effect." Present both so the user understands the range.

## Integration with Other Files

### Integration with OUTPUT-INCREMENTAL-COST.md
The five cost drivers remain the same. The simulation enhances Driver 1 (Step Advancement), Driver 3 (Lane Movement), and Driver 5 (Headcount Changes) by replacing simple estimates with per-employee simulation results.

### Integration with OUTPUT-SCENARIO-COMPARISON.md
Each scenario in the comparison should use the SAME turnover simulation (same teachers depart, same replacements hired) to ensure a fair comparison. The only differences between scenarios should be the negotiated terms, not random variation in the simulation.

To achieve this:
```
# Generate one set of turnover events
turnover_events = simulate_turnover(roster, years=4, seed=42)

# Apply the same events to each scenario
for scenario in scenarios:
    evolved_roster = apply_turnover(roster, turnover_events)
    scenario_cost = calculate_cost(evolved_roster, scenario.terms)
```

### Integration with DOMAIN-LEAVE-COSTS.md
As teachers depart and are replaced:
- Departed teachers' accumulated sick leave balances trigger cash-out costs (if eligible)
- New hires start with zero accumulated sick leave
- The district's total sick leave liability decreases when high-balance teachers retire and increases as remaining teachers accumulate

## Assumptions Tab Entries

| Assumption | Value | Source / Notes |
|---|---|---|
| Overall annual turnover rate | 8% | Default estimate |
| Early-career turnover (Steps 1-3) | 15% | National average |
| Mid-career turnover (Steps 4-15) | 5% | National average |
| Late-career turnover (Steps 16-22) | 3% | National average |
| Pre-retirement turnover (Steps 23+) | 10% | Retirement eligibility |
| Lane movement rate | 5% | Default — eligible teachers only |
| New hire default step | 1 | District policy |
| New hire lane distribution | 50% BA / 40% MA / 10% BA+15 | Current market estimate |
| New hire benefits tier | 70% Single / 20% EE+SP / 10% Family | Age-weighted estimate |
| Longevity threshold | 20 years | CBA Article [X] — if applicable |
| Longevity payment | $1,500/year | CBA Article [X] — if applicable |
| Simulation seed | 42 | Fixed for reproducibility across scenarios |

## Python Implementation Notes

### Reproducibility
Always use a fixed random seed so that:
- Turnover selections are consistent across scenario comparisons
- Results are reproducible if the model is re-run
- The user can change the seed to see sensitivity to different turnover patterns

### Data Structure
```python
class Employee:
    emp_id: str
    name: str
    step: int
    lane: str
    contract_days: int
    benefits_tier: str
    years_of_service: int
    years_at_max_step: int
    accumulated_sick_days: float
    status: str  # 'active', 'departed', 'retired', 'new_hire'
    departure_year: int  # None if active
    hire_year: int  # 0 for original roster

def simulate_year(roster, year, turnover_rate, lane_move_rate, 
                  schedule, assumptions, seed):
    """
    Returns: evolved_roster, turnover_events, cost_summary
    """
    rng = random.Random(seed + year)  # Deterministic per year
    
    # 1. Identify departures
    departures = select_departures(roster, turnover_rate, rng)
    
    # 2. Generate replacements
    replacements = generate_new_hires(departures, assumptions, year, rng)
    
    # 3. Remove departures, add replacements
    evolved = [e for e in roster if e not in departures] + replacements
    
    # 4. Advance steps (for continuing employees)
    for emp in evolved:
        if emp.status == 'active' and emp not in replacements:
            advance_step(emp, schedule)
    
    # 5. Apply lane movement
    apply_lane_movement(evolved, lane_move_rate, schedule, rng)
    
    # 6. Update service years and eligibilities
    update_eligibilities(evolved, assumptions)
    
    return evolved, departures, replacements
```

## Board-Side vs. Union-Side Framing

### Board-Side
Emphasize:
- Turnover savings as a natural cost offset ("The district saves $180K/year through normal attrition — the net cost of this contract is lower than the headline number")
- Step cap impact ("27 of 100 teachers are topped out by Year 3 — step cost naturally decreases")
- New hire cost efficiency ("Each retirement replaced by a new hire saves $40K in total compensation")

### Union-Side
Emphasize:
- Turnover means losing experienced teachers ("8 departures per year means the average classroom has a less experienced teacher — this has educational quality implications")
- New hires at Step 1 earn below-market starting salary
- Turnover is partly driven by inadequate compensation — higher raises could reduce turnover
- The simulation assumes constant turnover, but a better contract could improve retention

Neither framing is wrong — they're different lenses on the same data. The model should present the numbers neutrally and let the user apply their framing.
