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
/lib/db/                   — Drizzle schema + database client (run `pnpm build` after schema changes)
/lib/api-spec/             — OpenAPI spec (openapi.yaml) + Orval config
/lib/api-client-react/     — Generated React Query hooks
/lib/api-zod/              — Generated Zod schemas
/scripts/                  — Seed scripts
```

### Calculation Engine (`artifacts/api-server/src/lib/calculations/`)
- **types.ts** — Shared TypeScript interfaces for the engine
- **salary-engine.ts** — Salaried employee projections: step advancement → grid lookup → percentage/CPI/flat increase → round to whole dollar
- **hourly-engine.ts** — Hourly employee projections: CPI/flat increase, supports proRateFraction for mid-year hires
- **benefits-engine.ts** — Employer cost calc: TRS gross-up, FICA (with SS wage base cap), health insurance compounding, dental/life/disability/HSA/workers' comp
- **retirement-engine.ts** — Option 1 (4-year 5.5%), Option 2 (2-year + incentives), Option 3 (longevity $275/year)
- **scenario-engine.ts** — Orchestrates all projections, produces year-summaries and district-wide rollups

### Order of Operations — Salary Engine (CRITICAL)
1. Step advancement → grid cell lookup
2. Apply base salary increase (CPI formula OR fixed % OR flat dollar)
3. High-earner threshold override: if pre-increase salary ≥ threshold → add $3,000 flat (replaces step 2)
4. Educational advancement stipend (BA+15, MA, MA+15 lane changes)
5. Round to nearest whole dollar
6. Employer costs calculated on rounded salary

### Pro-Rating Rules (CRITICAL)
- `proRateFraction` applied ONLY to flat-dollar benefits (health, dental, disability, HSA)
- Salary-based costs (retirement/TRS, FICA, workers comp, life) are computed on the already-pro-rated salary — NO additional fraction applied
- Hourly year-0 hours multiplied by `proRateFraction`

### CPI Formula
`effective_rate = max(floor, min(cap, cpi_value + adder))`

### Integer-Cent Storage (CRITICAL)
All monetary values in `employee_year_records` are stored as **bigint cents** (mode: "number"):
- `projectedBaseSalaryCents`, `projectedTotalCompensationCents`, `retirementContributionCents`
- `ficaCostCents`, `healthInsuranceCostCents`, `otherBenefitsCostCents`
- `totalEmployerCostCents`, `retirementIncentiveAmountCents`
- Convert: `toCents = (s) => Math.round(parseFloat(s) * 100)`, `fromCents = (c) => (c / 100).toFixed(2)`
- Non-monetary columns (`effectiveRate`, `projectedHourlyRate`, `projectedStep`, `projectedLaneId`) remain as `numeric`/string

### Database Schema (lib/db/src/schema/)
- `districts` — District configuration
- `bargaining_units` — Per-unit rates (TRS/IMRF, FICA, health, dental, HSA, etc.)
- `salary_schedules` + `lanes` + `steps` + `schedule_cells` — Salary grid (lane×step matrix)
- `hourly_schedules` + `hourly_categories` — ESP/CM hourly compensation
- `employees` — Roster with lane/step placement, insurance election, retirement flags
- `scenarios` + `scenario_year_configs` — Contract proposal modeling (separate year config per bargaining unit per scenario)
- `employee_year_records` — Calculated projections cache (bigint cents)

**IMPORTANT**: After editing any schema file in lib/db/src/schema/, run `cd lib/db && pnpm build` then restart the API server, otherwise TypeScript will serve stale types from the `dist/` directory.

## Seed Data (District 21)
- District ID: `b2ab4e3b-e4ec-4127-b0b3-9e0421b12194`
- 65 Licensed employees (7 lanes × 15 steps, BA step 1 = $48,000 + $1,950/step + lane premium; grid tops at $94,800 PhD/step15)
  - 4 veteran high-earners above $125K (PhD, step 15, above-schedule salary)
  - Insurance: exactly 39 family (60%), 16 single (25%), 10 waived (15%)
  - Retirement-eligible: exactly 10 licensed staff (within spec 8–12)
- 25 ESP employees (6 categories: Paraprofessional, Secretary, Library Aide, etc.)
- 15 CM employees (4 categories: Custodian, Head Custodian, Maintenance, Grounds)
- 3 pre-built scenarios with calculated projections (1,575 year records)

## API Endpoints (all under /api)
- `GET /healthz` — Health check
- `GET|POST /districts` — District management
- `GET|PUT /districts/:id`
- `GET|POST /bargaining-units` — Bargaining unit management
- `GET|PUT|DELETE /bargaining-units/:id`
- `GET|POST /employees` — Employee roster
- `GET /employees/retirement-eligible` — Retirement analysis
- `POST /employees/import` — Bulk CSV import
- `GET /employees/export` — CSV export
- `GET|PUT|DELETE /employees/:id`
- `GET|POST /salary-schedules` — Salary grid management
- `GET|DELETE /salary-schedules/:id`
- `GET|POST /hourly-schedules` — Hourly compensation management
- `GET|POST /scenarios` — Scenario modeling
- `GET /scenarios/compare?ids=a,b,c` — Side-by-side comparison (read-only)
- `GET|PUT|DELETE /scenarios/:id`
- `POST /scenarios/:id/calculate` — Run projections (stores to DB)
- `POST /scenarios/:id/apply` — Mark scenario as final (one per district)
- `POST /scenarios/:id/year-configs` — Upsert year configs
- `GET /scenarios/:id/summary` — Get calculated summary
- `GET /heatmap/:scenarioId?bargainingUnitId=` — Lane×step cell distribution per year
- `GET /dashboard?districtId=` — Overview stats
- `GET /reports?districtId=` — Report metadata list
- `GET /reports/:scenarioId` — Full report data (5yr summaries)
- `POST /reports/generate` — Generate PDF/Excel reports (Task #3)
- `GET /settings?districtId=` — District + bargaining unit settings
- `PUT /settings/district/:id` — Update district settings
- `PUT /settings/bargaining-unit/:id` — Update bargaining unit settings

## Scenario Status Enum (DB)
Only: `"draft" | "active" | "final" | "archived"` — enforced by Postgres enum `scenario_status`

## Key Design Decisions
1. **bigint cents** for `employee_year_records` monetary columns — penny-accurate, no float rounding
2. **NUMERIC(15,2)** for salary grid cells and employee base salaries — stored as dollar strings in app
3. **Per-unit year configs**: `scenario_year_configs.bargaining_unit_id` FK enables different rates per unit per year within one scenario
4. **TRS gross-up rate** default: 0.8901% (employer picks up employee TRS contribution)
5. **FICA-exempt licensed staff** (TRS members) — only Medicare tax (1.45%)
6. **FICA-liable ESP/CM** (IMRF) — full 7.65% (with SS wage base cap at $176,100)
7. **One final scenario per district** — `isFinal` is enforced cross-district at the application layer

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
  - Drizzle schema pushed to Postgres (bigint cents in employee_year_records)
  - Full calculation engine (salary, hourly, benefits, retirement, scenario orchestration)
  - OpenAPI spec covering all endpoints
  - All route handlers implemented with Zod validation
  - Seed data loaded: District 21, 105 employees, 3 scenarios, 1,575 year records
  - TypeScript: 0 errors
  - All endpoints smoke-tested and verified
- **Task #2 (Frontend)**: PENDING
- **Task #3 (Reports: PDF + Excel)**: PENDING

---

## Bargaining Power AI (Task #25) — COMPLETE

A separate standalone SaaS app for school district administrators to upload teacher union CBA PDFs and generate Excel cost models.

### Location & Routing
- **Directory**: `artifacts/bargaining-power-ai/`
- **Preview path**: `/bpai` (separate from CollBar at `/`)
- **Port**: 3001
- **Package**: `@workspace/bargaining-power-ai`

### Stack
- Next.js 15 App Router + TypeScript
- NextAuth v5 (Credentials provider, JWT sessions)
- PostgreSQL (same instance as CollBar, tables prefixed `bp_`)
- Anthropic SDK: claude-sonnet-4-5 (extraction), claude-opus-4-5 (modeling)
- openpyxl via Python subprocess for Excel generation
- Tailwind CSS v4

### Database Tables (prefix: `bp_`)
- `bp_users` — User accounts with password_hash
- `bp_orgs` — Multi-tenant organizations/districts
- `bp_org_members` — User↔org join table with roles
- `bp_projects` — CBA projects per org
- `bp_uploads` — File uploads (CBA PDFs + rosters)
- `bp_cost_models` — Generated Excel model records

### Key Architecture Notes
1. **basePath `/bpai`**: Next.js basePath is set; all internal routes auto-prefix
2. **Server Actions for auth**: `signIn`/`signOut` use server actions (NOT `next-auth/react`) to ensure basePath is respected in redirects
3. **`apiPath()` utility** (`lib/api.ts`): Client components prefix fetch URLs with `NEXT_PUBLIC_BASE_PATH`
4. **Split auth config**: `lib/auth.config.ts` (Edge-compatible, no Node.js APIs) used by middleware; `lib/auth.ts` adds Credentials provider + DB
5. **Env vars**: `AUTH_SECRET` (Replit Secret), `ANTHROPIC_API_KEY` (Replit Secret), `DATABASE_URL` (Replit Secret)

### AI Pipeline
1. Upload PDF → stored in `.uploads/` directory
2. Extract: Claude Sonnet reads PDF text, outputs structured JSON (salary schedule, benefits, pension)
3. Generate: Claude Opus generates openpyxl Python code → executed → Excel file saved
4. Download: Excel file served from `.uploads/` directory

### Running the Migration
```bash
cd artifacts/bargaining-power-ai && npx tsx lib/migrate.ts
```
