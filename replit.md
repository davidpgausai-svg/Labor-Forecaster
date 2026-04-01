# CollBar — Collective Bargaining Compensation & Labor Forecasting Platform

## Project Overview

CollBar is a single-tenant K-12 CSBO (Chief School Business Official) platform for modeling multi-year labor costs across multiple bargaining units. It builds and compares contract proposals with penny-accurate projections and generates board presentation reports.

## Architecture

### Stack
- **Frontend**: React + Vite (Task #2 — pending)
- **Backend**: Express 5 + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Codegen**: Orval from OpenAPI spec → React Query hooks + Zod schemas
- **Math precision**: decimal.js for all monetary calculations
- **Dates**: date-fns

### Monorepo Structure
```
/artifacts/api-server/     — Express 5 API server
/lib/db/                   — Drizzle schema + database client
/lib/api-spec/             — OpenAPI spec (openapi.yaml) + Orval config
/lib/api-client-react/     — Generated React Query hooks
/lib/api-zod/              — Generated Zod schemas
/scripts/                  — Seed scripts
```

### Calculation Engine (`artifacts/api-server/src/lib/calculations/`)
- **types.ts** — Shared TypeScript interfaces for the engine
- **salary-engine.ts** — Salaried employee projections: step advancement → grid lookup → percentage/CPI/flat increase → round to $0.01
- **benefits-engine.ts** — Employer cost calc: TRS gross-up, FICA (with SS wage base cap), health insurance compounding, dental/life/disability/HSA/workers' comp
- **retirement-engine.ts** — Option 1 (4-year 5.5%), Option 2 (2-year + incentives), Option 3 (longevity $275/year)
- **scenario-engine.ts** — Orchestrates all projections, produces year-summaries and district-wide rollups

### Order of Operations (CRITICAL)
1. Step advancement → grid cell lookup
2. Base salary increase (CPI formula OR fixed % OR flat dollar)
3. High-earner threshold override ($125K default → flat $3,000)
4. Educational advancement (BA+15, MA, MA+15)
5. Round to nearest $0.01 (stored as NUMERIC(15,2) in Postgres)
6. Employer costs calculated on rounded salary

### CPI Formula
`effective_rate = max(floor, min(cap, cpi_value + adder))`

### Database Schema (lib/db/src/schema/)
- `districts` — District configuration
- `bargaining_units` — Per-unit rates (TRS/IMRF, FICA, health, dental, HSA, etc.)
- `salary_schedules` + `lanes` + `steps` + `schedule_cells` — Salary grid (lane×step matrix)
- `hourly_schedules` + `hourly_categories` — ESP/CM hourly compensation
- `employees` — Roster with lane/step placement, insurance election, retirement flags
- `scenarios` + `scenario_year_configs` — Contract proposal modeling (key: separate year config per bargaining unit per scenario)
- `employee_year_records` — Calculated projections cache

## Seed Data (District 21)
- 65 Licensed employees (7 lanes × 15 steps, base BA step 1 = $48,000, 2.5%/step)
- 25 ESP employees (6 categories: Paraprofessional, Secretary, Library Aide, etc.)
- 15 CM employees (4 categories: Custodian, Head Custodian, Maintenance, Grounds)
- 3 pre-built scenarios: 3% Flat, CPI+0.5% (2-5% cap/floor), Step-Only freeze
- District ID: b5562c32-4641-4559-a468-f8d9bdb96b26

## API Endpoints (all under /api)
- `GET /healthz` — Health check
- `GET|POST /districts` — District management
- `GET|PUT /districts/:id`
- `GET|POST /bargaining-units` — Bargaining unit management
- `GET|PUT|DELETE /bargaining-units/:id`
- `GET|POST /employees` — Employee roster
- `GET /employees/retirement-eligible` — Retirement analysis
- `POST /employees/import` — Bulk CSV import
- `GET|PUT|DELETE /employees/:id`
- `GET|POST /salary-schedules` — Salary grid management
- `GET|DELETE /salary-schedules/:id`
- `GET|POST /hourly-schedules` — Hourly compensation management
- `GET|POST /scenarios` — Scenario modeling
- `GET /scenarios/compare?ids=a,b,c` — Side-by-side comparison
- `GET|PUT|DELETE /scenarios/:id`
- `POST /scenarios/:id/calculate` — Run projections (stores to DB)
- `POST /scenarios/:id/apply` — Mark scenario as final
- `POST /scenarios/:id/year-configs` — Upsert year configs
- `GET /scenarios/:id/summary` — Get calculated summary
- `GET /heatmap/:scenarioId` — Lane×step employee distribution
- `GET /dashboard` — Overview stats

## Key Design Decisions
1. **NUMERIC(15,2)** for all monetary columns — never FLOAT
2. **Per-unit year configs**: `scenario_year_configs.bargaining_unit_id` FK enables different rates per unit per year within one scenario
3. **TRS gross-up rate** default: 0.8901% (employer picks up employee TRS contribution)
4. **FICA-exempt licensed staff** (TRS members) — only Medicare tax (1.45%)
5. **FICA-liable ESP/CM** (IMRF) — full 7.65% (with SS wage base cap at $176,100)

## Color System (for Frontend)
- Licensed (salary): Blue (#3b82f6)
- ESP (hourly): Purple (#8b5cf6)
- CM (custodial): Amber (#f59e0b)
- Dark backgrounds: #0a0e14 (main), #111620 (card)

## Typography (for Frontend)
- JetBrains Mono — all financial numbers, right-aligned
- Inter — labels and non-numeric text

## Task Progress
- **Task #1 (Foundation: DB + Engine + API)**: COMPLETE
  - Drizzle schema pushed to Postgres (6 schema files)
  - Full calculation engine (4 engine files)
  - OpenAPI spec (all endpoints)
  - Orval codegen run (React Query hooks + Zod schemas)
  - All route handlers implemented
  - Seed data loaded (District 21, 105 employees, 3 scenarios)
  - API verified working (health, districts, employees, scenarios, calculate, heatmap, dashboard)
- **Task #2 (Frontend)**: PENDING
- **Task #3 (Reports: PDF + Excel)**: PENDING
