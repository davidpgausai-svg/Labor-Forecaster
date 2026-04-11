# Bargaining Power AI — Skill Files

## What These Files Are
These are the domain knowledge and output specification files that power Bargaining Power AI's CBA cost modeling engine. They teach Claude how to read collective bargaining agreements, calculate total cost of employment, and produce professional Excel workbooks with employer and employee impact analysis.

## File Inventory

| File | Purpose | Size |
|---|---|---|
| `SKILL.md` | Master router — workflow orchestration, input classification, critical rules | ~4KB |
| `DOMAIN-CBA-INTERPRETATION.md` | How to read and extract data from a CBA: salary schedules, benefits provisions, calendar days, increase methodology, stipends, red flags | ~8KB |
| `DOMAIN-RETIREMENT-SYSTEMS.md` | State-by-state pension contribution rates, SS exemptions, employer pickup rules, grossing-up calculations | ~8KB |
| `DOMAIN-BENEFITS-MODELING.md` | Health/dental/vision/life/LTD premium ranges, sharing models, tier distributions, trend factors, workers comp rates | ~7KB |
| `DOMAIN-PAYROLL-TAXES.md` | Medicare, SS, FUTA, SUTA rates by state, federal/state income tax effective rates, wage bases | ~6KB |
| `OUTPUT-EXCEL-SPEC.md` | Exact workbook structure, tab layouts, column definitions, formatting standards, formula requirements, color coding | ~9KB |
| `OUTPUT-INCREMENTAL-COST.md` | Five cost drivers, step advancement logic, schedule increase calculations, benefits trend, multi-year projection tables, presentation rules | ~7KB |

## How to Use

### Option A: Claude Project (Manual / Prototyping)
1. Create a new Claude Project
2. Upload ALL seven .md files into Project Knowledge
3. Start a conversation in the project
4. Upload a CBA PDF and/or employee roster
5. Prompt: "Build the full cost model — employer and employee impact, current year and incremental through end of contract"

### Option B: Anthropic API (Production / Bargaining Power AI App)
1. Concatenate the .md files into your system prompt (or use them as context documents)
2. Send the CBA text and roster data as the user message
3. Claude returns Python code that generates the Excel workbook
4. Execute the Python in your backend sandbox
5. Return the .xlsx to the user

### Option C: Hybrid
Use Claude Project for initial analysis and refinement, then wire the same skill files into the API for production delivery.

## Target Markets
- Illinois (TRS) — primary, ASBO conference target
- Ohio (STRS) — high contribution rates make cost modeling critical
- Michigan (MPSERS) — complex multi-tier system
- Minnesota (TRA) — active union negotiation market
- Wisconsin (WRS) — post-Act 10 landscape
- New Jersey (TPAF) — state-funded pension creates unique modeling needs
- Connecticut (CTRB) — state-funded pension, high premium market
- Massachusetts (MTRS) — high contribution rates
- Pennsylvania (PSERS) — 35%+ employer contribution rate drives budget crisis

## Maintenance Notes
- Retirement contribution rates change annually — verify at start of each fiscal year
- State income tax rates may change with legislation
- SUTA wage bases update annually
- Health insurance trend factors should be adjusted based on current market data
- CPI-U estimates for schedule increases should reflect current economic conditions

## IP Notice
These skill files are proprietary. They encode domain expertise in public-sector compensation modeling. Do not share with clients or competitors. The skill files stay behind your wall — only the Excel output is delivered to clients.
