# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CollBar** — a single-tenant K-12 CSBO platform for modeling multi-year labor costs across multiple bargaining units. Builds and compares contract proposals with penny-accurate projections and generates board presentation reports.

## Commands

```bash
# Install dependencies (pnpm required — enforced via preinstall hook)
pnpm install

# Build everything (includes typecheck)
pnpm build

# Typecheck only
pnpm run typecheck

# API Server (dev mode with auto-rebuild)
cd artifacts/api-server && pnpm run dev

# Frontend dev server
cd artifacts/collbar-web && pnpm run dev

# Seed database (loads District 21 test data)
cd scripts && pnpm run seed

# Push DB schema changes to Postgres
cd lib/db && pnpm run push

# Regenerate React Query hooks + Zod schemas from OpenAPI spec
cd lib/api-spec && pnpm run codegen
```

**After editing any file in `lib/db/src/schema/`**: run `cd lib/db && pnpm build` then restart the API server, otherwise TypeScript serves stale types from `dist/`.

## Monorepo Structure

```
artifacts/api-server/          — Express 5 API server (esbuild bundled to ESM)
artifacts/collbar-web/         — React 19 + Vite 7 frontend (Task #2 — pending)
artifacts/mockup-sandbox/      — UI component sandbox
lib/db/                        — Drizzle schema + PostgreSQL client
lib/calc-engine/               — Calculation engines (salary, hourly, benefits, retirement)
lib/api-spec/                  — OpenAPI spec (openapi.yaml) + Orval codegen config
lib/api-client-react/          — Generated React Query hooks (do not edit manually)
lib/api-zod/                   — Generated Zod schemas (do not edit manually)
scripts/                       — Database seeding utilities
```

## Architecture

### API Layer

Express 5 routes in `artifacts/api-server/src/routes/` aggregate in `routes/index.ts`. All endpoints live under `/api/`. Zod validates all POST/PUT request bodies. Route handlers call into calc-engine or Drizzle directly.

### Calculation Engine

Located in `lib/calc-engine/src/`. Entry point: `run-calculation.ts` → `scenario-engine.ts` orchestrates all sub-engines per employee per year.

**Salary Engine Order of Operations (CRITICAL):**
1. Step advancement → grid cell lookup
2. Apply base salary increase (CPI formula / fixed % / flat dollar)
3. High-earner threshold override: if pre-increase salary ≥ threshold → add $3,000 flat (replaces step 2)
4. Educational advancement stipend (lane changes: BA+15, MA, MA+15)
5. Round to nearest whole dollar
6. Employer costs calculated on the rounded salary

**Pro-Rating Rules (CRITICAL):**
- `proRateFraction` applies **only** to flat-dollar benefits (health, dental, disability, HSA)
- Salary-based costs (TRS/IMRF, FICA, workers comp, life) are computed on the already-pro-rated salary — no additional fraction applied
- Hourly year-0 hours multiplied by `proRateFraction`

**CPI Formula:** `effective_rate = max(floor, min(cap, cpi_value + adder))`

### Database Schema

Drizzle ORM schemas in `lib/db/src/schema/`. Key tables:
- `districts`, `bargaining_units` — configuration
- `salary_schedules` + `lanes` + `steps` + `schedule_cells` — lane×step salary grid
- `hourly_schedules` + `hourly_categories` — ESP/CM hourly compensation
- `employees` — roster with lane/step placement, insurance election, retirement flags
- `scenarios` + `scenario_year_configs` — per-unit year configs within a scenario
- `employee_year_records` — calculated projection cache (bigint cents)
- `employee_groups`, `compensation_schedules` — flexible multi-group compensation (recently added)

### Monetary Precision

All monetary values in `employee_year_records` stored as **bigint cents** (Drizzle `mode: "number"`):
- Column naming convention: `projectedBaseSalaryCents`, `ficaCostCents`, etc.
- Convert: `toCents = (s) => Math.round(parseFloat(s) * 100)`, `fromCents = (c) => (c / 100).toFixed(2)`
- Salary grid cells and employee base salaries use `NUMERIC(15,2)` — stored as dollar strings in app
- All in-engine math uses `decimal.js` with `precision: 28, rounding: ROUND_HALF_UP`

### Code Generation

`lib/api-spec/openapi.yaml` is the source of truth for the API contract. Running `pnpm run codegen` in `lib/api-spec/` regenerates `lib/api-client-react/` (React Query hooks) and `lib/api-zod/` (Zod schemas) via Orval. Never edit generated files directly.

### Key Business Rules

- **FICA-exempt licensed staff** (TRS members) — only Medicare tax (1.45%)
- **FICA-liable ESP/CM** (IMRF) — full 7.65%, SS wage base cap at $176,100
- **TRS gross-up rate** default: 0.8901% (employer picks up employee TRS contribution)
- **One final scenario per district** — `isFinal` enforced at the application layer
- Scenario status enum: `"draft" | "active" | "final" | "archived"` (Postgres pgEnum)

## Frontend Conventions

- UI colors: Licensed/Blue `#3b82f6`, ESP/Purple `#8b5cf6`, CM/Amber `#f59e0b`
- Dark backgrounds: `#0a0e14` (main), `#111620` (card)
- Typography: JetBrains Mono for all financial numbers (right-aligned), Inter for labels
- Components: shadcn/ui + Radix UI + Tailwind CSS 4
- State: TanStack React Query hooks (from `lib/api-client-react/`)

## Task Status

- **Task #1 (Foundation: DB + Engine + API)**: COMPLETE — 0 TypeScript errors, all endpoints verified
- **Task #2 (Frontend)**: PENDING — scaffold exists in `artifacts/collbar-web/`
- **Task #3 (Reports: PDF + Excel)**: PENDING — jspdf/xlsx deps added, route handler stub exists
