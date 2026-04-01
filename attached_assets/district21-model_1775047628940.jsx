import { useState, useMemo, useCallback } from "react";

// ============================================================
// DISTRICT 21 COMPENSATION MODEL — FULL CBA PROTOTYPE
// ============================================================

// --- CONSTANTS FROM CBA ---
const CPI_FLOOR = 2.0;
const CPI_CAP = 3.75;
const CPI_ADDER = 1.5; // CPI + 1.5%
const HIGH_EARNER_THRESHOLD = 125000;
const HIGH_EARNER_FLAT_INCREASE = 3000;
const TRS_RATE = 0.09;
const TRS_GROSS_UP = 0.008901;
const IMRF_RATE = 0.045;
const IMRF_GROSS_UP = 0.00212;
const RETIREMENT_INCENTIVE_RATE = 0.055;

// Educational advancement bumps (Licensed)
const ED_ADVANCE = {
  "BA+15": 2500,
  "MA": 3500,
  "MA+15": 2500,
};

// --- LANE DEFINITIONS BY UNIT ---
const LICENSED_LANES = [
  { key: "BA", label: "BA", base: 1.0 },
  { key: "BA15", label: "BA+15", base: 1.052 },
  { key: "MA", label: "MA", base: 1.125 },
  { key: "MA15", label: "MA+15", base: 1.177 },
  { key: "MA30", label: "MA+30", base: 1.23 },
  { key: "MA45", label: "MA+45", base: 1.28 },
  { key: "DOC", label: "DOC", base: 1.36 },
];

const ESP_CATEGORIES = [
  { key: "secretary_ec", label: "EC Secretary", hourlyBase: 22.50, hoursYear: 1522.5 },
  { key: "secretary_elem", label: "Elem Secretary", hourlyBase: 21.00, hoursYear: 1435.0 },
  { key: "secretary_ms", label: "MS Secretary", hourlyBase: 23.00, hoursYear: 1522.5 },
  { key: "lmc_asst", label: "LMC Assistant", hourlyBase: 19.50, hoursYear: 1350.0 },
  { key: "health_asst", label: "Health Asst", hourlyBase: 20.00, hoursYear: 1267.0 },
  { key: "teacher_asst", label: "Teacher Asst", hourlyBase: 18.75, hoursYear: 1239.0 },
];

const CM_CATEGORIES = [
  { key: "head_cust", label: "Head Custodian", hourlyBase: 26.50, hoursYear: 2080 },
  { key: "night_cust", label: "Night Custodian", hourlyBase: 23.00, hoursYear: 2080 },
  { key: "mid_cust", label: "Mid-Day Custodian", hourlyBase: 24.00, hoursYear: 2080 },
  { key: "maintenance", label: "Maintenance", hourlyBase: 28.00, hoursYear: 2080 },
];

const STEP_INCREMENT = 0.025;
const MAX_STEPS_LICENSED = 20;

// --- YEAR CONFIGS (from CBA Article 208/306/405) ---
const YEAR_CONFIGS = [
  { label: "2022-23", type: "fixed", rate: 4.5 },
  { label: "2023-24", type: "fixed", rate: 5.0 },
  { label: "2024-25", type: "cpi", cpiActual: 6.5 },
  { label: "2025-26", type: "cpi", cpiActual: 3.4 },
  { label: "2026-27", type: "cpi", cpiActual: 2.8 },
];

function calcCPIIncrease(cpiRaw) {
  const combined = cpiRaw + CPI_ADDER;
  return Math.max(CPI_FLOOR, Math.min(CPI_CAP, combined));
}

function fmt(n) {
  return "$" + Math.round(n).toLocaleString();
}
function fmtM(n) {
  return "$" + (n / 1000000).toFixed(3) + "M";
}
function fmtPct(n) {
  return n.toFixed(1) + "%";
}

// --- GENERATE LICENSED STAFF ---
function genLicensed(count) {
  const names = ["Adams","Baker","Clark","Davis","Evans","Foster","Garcia","Harris","Irwin","Jones","Kim","Lopez","Martin","Nelson","Olsen","Patel","Quinn","Reyes","Smith","Taylor","Upton","Valdez","Williams","Xu","Young","Zhang","Allen","Brown","Chen","Diaz","Ellis","Flores","Green","Hill","Ito","Jackson","Kelly","Lee","Moore","Nguyen","Owen","Park","Reed","Scott","Thomas","Vega","Wang","White","Yang","Zimmerman","Murphy"];
  const firsts = ["Sarah","James","Maria","David","Emily","Michael","Lisa","Robert","Amy","John","Karen","Daniel","Jennifer","William","Laura","Chris","Angela","Kevin","Susan","Brian","Nicole","Jason","Rachel","Thomas","Megan","Andrew","Ashley","Mark","Jessica","Eric","Heather","Ryan","Michelle","Sean","Amanda","Paul","Stephanie","Jeffrey","Brittany","Patrick","Robin","Alex","Taylor","Jordan","Morgan","Riley","Casey","Avery","Dakota","Skyler"];
  const staff = [];
  for (let i = 0; i < count; i++) {
    const step = Math.min(Math.floor(Math.random() * MAX_STEPS_LICENSED), MAX_STEPS_LICENSED - 1);
    let laneIdx = Math.floor(Math.random() * LICENSED_LANES.length);
    laneIdx = Math.min(laneIdx, Math.floor(Math.random() * LICENSED_LANES.length));
    const yearsInDistrict = Math.max(step, Math.floor(Math.random() * 25));
    const age = 25 + yearsInDistrict + Math.floor(Math.random() * 10);
    const retireEligible = age >= 55 && yearsInDistrict >= 10;
    const baseSalary = 48000 + Math.floor(Math.random() * 2000);
    staff.push({
      id: i + 1,
      name: `${firsts[i % firsts.length]} ${names[i % names.length]}`,
      unit: "licensed",
      step,
      laneIdx,
      lane: LICENSED_LANES[laneIdx].key,
      yearsInDistrict,
      age,
      retireEligible,
      baseSalary,
      retirementPlan: null,
      trsYears: yearsInDistrict + Math.floor(Math.random() * 5),
    });
  }
  return staff;
}

// --- GENERATE ESP STAFF ---
function genESP(count) {
  const names = ["Rivera","Cooper","Bell","Ward","Ross","Perry","Long","Hughes","Butler","Sanders","Price","Bennett","Wood","Barnes","Henderson","Coleman","Jenkins","Powell","Sullivan","Russell"];
  const firsts = ["Mary","Patricia","Linda","Barbara","Elizabeth","Nancy","Margaret","Sandra","Dorothy","Ruth","Sharon","Donna","Carol","Janet","Catherine","Frances","Ann","Joyce","Diane","Martha"];
  const staff = [];
  for (let i = 0; i < count; i++) {
    const catIdx = Math.floor(Math.random() * ESP_CATEGORIES.length);
    const yearsInDistrict = Math.floor(Math.random() * 20);
    const age = 28 + yearsInDistrict + Math.floor(Math.random() * 12);
    const cat = ESP_CATEGORIES[catIdx];
    staff.push({
      id: 100 + i + 1,
      name: `${firsts[i % firsts.length]} ${names[i % names.length]}`,
      unit: "esp",
      category: cat.key,
      categoryLabel: cat.label,
      hourlyBase: cat.hourlyBase,
      hoursYear: cat.hoursYear,
      yearsInDistrict,
      age,
      retireEligible: age >= 55 && yearsInDistrict >= 10,
      retirementPlan: null,
    });
  }
  return staff;
}

// --- GENERATE CM STAFF ---
function genCM(count) {
  const names = ["Gonzalez","Martinez","Anderson","Wilson","Thompson","Rodriguez","Lewis","Walker","Hall","Robinson","Young","King","Wright","Green","Carter","Mitchell","Turner","Phillips","Campbell","Parker"];
  const firsts = ["Robert","William","Richard","Joseph","Thomas","Charles","Christopher","Steven","Edward","Kenneth","George","Donald","Ronald","Timothy","Larry","Jeffrey","Frank","Raymond","Gary","Gerald"];
  const staff = [];
  for (let i = 0; i < count; i++) {
    const catIdx = Math.floor(Math.random() * CM_CATEGORIES.length);
    const yearsInDistrict = Math.floor(Math.random() * 22);
    const age = 25 + yearsInDistrict + Math.floor(Math.random() * 15);
    const cat = CM_CATEGORIES[catIdx];
    staff.push({
      id: 200 + i + 1,
      name: `${firsts[i % firsts.length]} ${names[i % names.length]}`,
      unit: "cm",
      category: cat.key,
      categoryLabel: cat.label,
      hourlyBase: cat.hourlyBase,
      hoursYear: cat.hoursYear,
      yearsInDistrict,
      age,
      retireEligible: age >= 55 && yearsInDistrict >= 10,
      retirementPlan: null,
      vacationDays: yearsInDistrict < 5 ? 10 : yearsInDistrict < 10 ? 15 : yearsInDistrict < 20 ? 20 : 25,
    });
  }
  return staff;
}

// --- SALARY CALCULATIONS ---
function calcLicensedSalary(person, yearIdx, baseIncreasePct, schedule) {
  let salary = person.baseSalary * LICENSED_LANES[person.laneIdx].base * (1 + STEP_INCREMENT * Math.min(person.step + yearIdx, MAX_STEPS_LICENSED - 1));

  // Apply cumulative yearly increases
  for (let y = 0; y < yearIdx; y++) {
    const cfg = YEAR_CONFIGS[y];
    if (!cfg) break;
    if (salary < HIGH_EARNER_THRESHOLD) {
      let rate;
      if (cfg.type === "fixed") {
        rate = cfg.rate / 100;
      } else {
        rate = calcCPIIncrease(cfg.cpiActual) / 100;
      }
      salary *= (1 + rate);
    } else {
      salary += HIGH_EARNER_FLAT_INCREASE;
    }
  }
  return Math.round(salary);
}

function calcHourlySalary(person, yearIdx) {
  let hourly = person.hourlyBase;
  for (let y = 0; y < yearIdx; y++) {
    const cfg = YEAR_CONFIGS[y];
    if (!cfg) break;
    const annualSalary = hourly * person.hoursYear;
    if (annualSalary < HIGH_EARNER_THRESHOLD) {
      let rate;
      if (cfg.type === "fixed") {
        rate = cfg.rate / 100;
      } else {
        rate = calcCPIIncrease(cfg.cpiActual) / 100;
      }
      hourly *= (1 + rate);
    } else {
      hourly += HIGH_EARNER_FLAT_INCREASE / person.hoursYear;
    }
    // Step-based seniority increase
    hourly *= 1.012;
  }
  return { hourly: Math.round(hourly * 100) / 100, annual: Math.round(hourly * person.hoursYear) };
}

function calcRetirementIncentive(person, yearIdx) {
  if (!person.retireEligible) return { eligible: false, bonus: 0 };
  const longevity = Math.min(person.yearsInDistrict + yearIdx, 35) * 275;
  return { eligible: true, longevityBonus: longevity, fourYearRate: RETIREMENT_INCENTIVE_RATE };
}

// --- SCENARIO ENGINE ---
function runScenario(licensed, esp, cm, overrides) {
  const years = [];
  for (let y = 0; y <= 4; y++) {
    const cfg = YEAR_CONFIGS[y] || YEAR_CONFIGS[4];
    const appliedCPI = overrides?.cpiOverride?.[y] ?? cfg.cpiActual;
    const effectiveRate = cfg.type === "fixed" ? cfg.rate : calcCPIIncrease(appliedCPI);

    let licensedTotal = 0, licensedTRS = 0;
    let espTotal = 0, espIMRF = 0;
    let cmTotal = 0, cmIMRF = 0;
    let highEarnerCount = 0;
    let retireEligibleCount = 0;

    const licensedDetail = licensed.map(p => {
      const salary = calcLicensedSalary(p, y);
      const trs = salary * TRS_RATE;
      licensedTotal += salary;
      licensedTRS += trs;
      if (salary >= HIGH_EARNER_THRESHOLD) highEarnerCount++;
      if (p.age + y >= 55 && p.yearsInDistrict + y >= 10) retireEligibleCount++;
      return { ...p, projectedSalary: salary, trs, step: Math.min(p.step + y, MAX_STEPS_LICENSED - 1) };
    });

    const espDetail = esp.map(p => {
      const { hourly, annual } = calcHourlySalary(p, y);
      const imrf = annual * IMRF_RATE;
      espTotal += annual;
      espIMRF += imrf;
      if (annual >= HIGH_EARNER_THRESHOLD) highEarnerCount++;
      return { ...p, projectedHourly: hourly, projectedSalary: annual, imrf };
    });

    const cmDetail = cm.map(p => {
      const { hourly, annual } = calcHourlySalary(p, y);
      const imrf = annual * IMRF_RATE;
      cmTotal += annual;
      cmIMRF += imrf;
      if (annual >= HIGH_EARNER_THRESHOLD) highEarnerCount++;
      return { ...p, projectedHourly: hourly, projectedSalary: annual, imrf };
    });

    const totalPayroll = licensedTotal + espTotal + cmTotal;
    const totalBenefitsCost = licensedTRS + espIMRF + cmIMRF;

    years.push({
      year: y,
      label: YEAR_CONFIGS[y]?.label || `Year ${y}`,
      effectiveRate,
      appliedCPI,
      licensedTotal,
      licensedTRS,
      espTotal,
      espIMRF,
      cmTotal,
      cmIMRF,
      totalPayroll,
      totalBenefitsCost,
      totalCost: totalPayroll + totalBenefitsCost,
      highEarnerCount,
      retireEligibleCount,
      licensedDetail,
      espDetail,
      cmDetail,
      avgLicensed: Math.round(licensedTotal / licensed.length),
      avgESP: Math.round(espTotal / esp.length),
      avgCM: Math.round(cmTotal / cm.length),
    });
  }
  return years;
}

// ============================================================
// UI COMPONENTS
// ============================================================

const th = {
  padding: "8px 10px",
  textAlign: "right",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.8,
  borderBottom: "1px solid #1e2736",
  textTransform: "uppercase",
  color: "#6b7a8d",
  whiteSpace: "nowrap",
};

const td = {
  padding: "7px 10px",
  textAlign: "right",
  borderBottom: "1px solid #111620",
  color: "#8b95a8",
  fontSize: 12,
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
};

function Card({ title, children, action }) {
  return (
    <div style={{
      background: "#111620",
      border: "1px solid #1a2030",
      borderRadius: 8,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid #1a2030",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: "#6b7a8d", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Metric({ label, value, sub, color, small }) {
  return (
    <div style={{ minWidth: small ? 100 : 130 }}>
      <div style={{ fontSize: 9, color: "#4a5568", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 16 : 20, fontWeight: 700, color: color || "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#3b4658", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function UnitBreakdownBar({ licensed, esp, cm, total }) {
  const lPct = (licensed / total) * 100;
  const ePct = (esp / total) * 100;
  const cPct = (cm / total) * 100;
  return (
    <div>
      <div style={{ display: "flex", height: 24, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ width: `${lPct}%`, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{fmtPct(lPct)}</span>
        </div>
        <div style={{ width: `${ePct}%`, background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{fmtPct(ePct)}</span>
        </div>
        <div style={{ width: `${cPct}%`, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{fmtPct(cPct)}</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#6b7a8d" }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#3b82f6", borderRadius: 2, marginRight: 4 }}/>Licensed {fmt(licensed)}</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#8b5cf6", borderRadius: 2, marginRight: 4 }}/>ESP {fmt(esp)}</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#f59e0b", borderRadius: 2, marginRight: 4 }}/>CM {fmt(cm)}</span>
      </div>
    </div>
  );
}

function CBAFormulaDisplay({ cfg, effectiveRate }) {
  if (!cfg) return null;
  if (cfg.type === "fixed") {
    return (
      <div style={{ fontSize: 11, color: "#6b7a8d", fontFamily: "monospace", background: "#0a0e14", padding: "8px 12px", borderRadius: 4, border: "1px solid #1a2030" }}>
        <span style={{ color: "#3b82f6" }}>Fixed Rate:</span> {cfg.rate}% increase applied to all staff
      </div>
    );
  }
  const rawCPI = cfg.cpiActual;
  const combined = rawCPI + CPI_ADDER;
  const capped = Math.max(CPI_FLOOR, Math.min(CPI_CAP, combined));
  const hitCap = combined > CPI_CAP;
  const hitFloor = combined < CPI_FLOOR;
  return (
    <div style={{ fontSize: 11, color: "#6b7a8d", fontFamily: "monospace", background: "#0a0e14", padding: "8px 12px", borderRadius: 4, border: "1px solid #1a2030", lineHeight: 1.8 }}>
      <span style={{ color: "#3b82f6" }}>CPI Formula (Art. 208.2):</span><br/>
      CPI-U: {rawCPI}% + Adder: {CPI_ADDER}% = {combined.toFixed(1)}%
      {hitCap && <span style={{ color: "#f59e0b" }}> → Capped at {CPI_CAP}%</span>}
      {hitFloor && <span style={{ color: "#f59e0b" }}> → Floor at {CPI_FLOOR}%</span>}
      {!hitCap && !hitFloor && <span style={{ color: "#34d399" }}> → Applied: {capped.toFixed(1)}%</span>}
      <br/>
      <span style={{ color: "#8b95a8" }}>Employees ≥ ${HIGH_EARNER_THRESHOLD.toLocaleString()}: flat ${HIGH_EARNER_FLAT_INCREASE.toLocaleString()} increase</span>
    </div>
  );
}

function RetirementPanel({ data }) {
  const eligible = data.licensedDetail.filter(p => p.projectedSalary > 0 && (p.age + data.year) >= 55 && (p.yearsInDistrict + data.year) >= 10);
  if (eligible.length === 0) return <div style={{ fontSize: 12, color: "#4a5568" }}>No retirement-eligible staff this year.</div>;

  return (
    <div style={{ maxHeight: 200, overflowY: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Name</th>
            <th style={th}>Age</th>
            <th style={th}>D21 Yrs</th>
            <th style={th}>TRS Yrs</th>
            <th style={th}>Salary</th>
            <th style={th}>Longevity $275/yr</th>
            <th style={th}>4-Yr Incentive</th>
          </tr>
        </thead>
        <tbody>
          {eligible.slice(0, 15).map((p, i) => {
            const longevity = Math.min(p.yearsInDistrict + data.year, 35) * 275;
            return (
              <tr key={p.id} style={{ background: i % 2 === 0 ? "#0a0e14" : "#111620" }}>
                <td style={{ ...td, textAlign: "left", color: "#c4cdd9" }}>{p.name}</td>
                <td style={td}>{p.age + data.year}</td>
                <td style={td}>{p.yearsInDistrict + data.year}</td>
                <td style={td}>{p.trsYears + data.year}</td>
                <td style={{ ...td, color: "#e2e8f0", fontWeight: 600 }}>{fmt(p.projectedSalary)}</td>
                <td style={{ ...td, color: "#34d399" }}>{fmt(longevity)}</td>
                <td style={{ ...td, color: "#f59e0b" }}>5.5% × 4yr</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {eligible.length > 15 && <div style={{ fontSize: 10, color: "#4a5568", padding: 8 }}>+{eligible.length - 15} more eligible</div>}
    </div>
  );
}

// ============================================================
// MAIN APPLICATION
// ============================================================

export default function District21Model() {
  const [selectedYear, setSelectedYear] = useState(0);
  const [activeUnit, setActiveUnit] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [cpiOverrides, setCpiOverrides] = useState({});

  const [licensed] = useState(() => genLicensed(65));
  const [esp] = useState(() => genESP(25));
  const [cm] = useState(() => genCM(15));

  const scenario = useMemo(() => {
    return runScenario(licensed, esp, cm, { cpiOverride: cpiOverrides });
  }, [licensed, esp, cm, cpiOverrides]);

  const current = scenario[selectedYear];
  const baseline = scenario[0];
  const deltaPct = selectedYear > 0 ? ((current.totalCost - baseline.totalCost) / baseline.totalCost * 100).toFixed(1) : null;
  const maxCost = Math.max(...scenario.map(s => s.totalCost));

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "licensed", label: "Licensed Staff" },
    { key: "esp", label: "ESP" },
    { key: "cm", label: "Custodial/Maint" },
    { key: "retirement", label: "Retirement" },
    { key: "scenarios", label: "CPI Scenarios" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#080c12", color: "#e2e8f0", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* HEADER */}
      <div style={{ borderBottom: "1px solid #1a2030", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 24, borderRadius: 3, background: "linear-gradient(180deg, #3b82f6, #8b5cf6)" }} />
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>
              Community Consolidated School District 21
            </h1>
          </div>
          <p style={{ margin: "2px 0 0 14px", fontSize: 11, color: "#4a5568" }}>
            Collective Bargaining Agreement 2022–2027 · Compensation Model · {licensed.length + esp.length + cm.length} Staff
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#4a5568" }}>
          <span style={{ padding: "3px 8px", background: "#1a2030", borderRadius: 4, color: "#3b82f6" }}>Licensed: {licensed.length}</span>
          <span style={{ padding: "3px 8px", background: "#1a2030", borderRadius: 4, color: "#8b5cf6" }}>ESP: {esp.length}</span>
          <span style={{ padding: "3px 8px", background: "#1a2030", borderRadius: 4, color: "#f59e0b" }}>CM: {cm.length}</span>
        </div>
      </div>

      {/* YEAR SELECTOR */}
      <div style={{ borderBottom: "1px solid #1a2030", padding: "12px 24px", display: "flex", gap: 4, overflowX: "auto" }}>
        {scenario.map((s, i) => (
          <button key={i} onClick={() => setSelectedYear(i)} style={{
            padding: "6px 16px",
            borderRadius: 5,
            border: selectedYear === i ? "1px solid #3b82f6" : "1px solid #1a2030",
            background: selectedYear === i ? "rgba(59,130,246,0.12)" : "transparent",
            color: selectedYear === i ? "#60a5fa" : "#4a5568",
            fontSize: 12,
            fontWeight: selectedYear === i ? 700 : 400,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}>
            {s.label}
            <span style={{ display: "block", fontSize: 9, color: selectedYear === i ? "#3b82f6" : "#2d3748", marginTop: 1 }}>
              {fmtPct(s.effectiveRate)}
            </span>
          </button>
        ))}
      </div>

      {/* TAB NAV */}
      <div style={{ borderBottom: "1px solid #1a2030", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: "10px 16px",
            border: "none",
            borderBottom: activeTab === t.key ? "2px solid #3b82f6" : "2px solid transparent",
            background: "transparent",
            color: activeTab === t.key ? "#e2e8f0" : "#4a5568",
            fontSize: 12,
            fontWeight: activeTab === t.key ? 600 : 400,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px", maxWidth: 1280, margin: "0 auto" }}>

        {/* ============ OVERVIEW TAB ============ */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Metrics Row */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 140 }}>
                <Metric label="Total Compensation" value={fmtM(current.totalCost)} sub={deltaPct ? `${deltaPct > 0 ? "+" : ""}${deltaPct}% vs baseline` : "Baseline year"} />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 140 }}>
                <Metric label="Total Payroll" value={fmtM(current.totalPayroll)} sub="Salaries only" color="#c4cdd9" />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 140 }}>
                <Metric label="Benefits (TRS+IMRF)" value={fmt(current.totalBenefitsCost)} sub={`TRS: ${fmt(current.licensedTRS)} · IMRF: ${fmt(current.espIMRF + current.cmIMRF)}`} color="#8b5cf6" />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px", flex: 1, minWidth: 140 }}>
                <Metric label="High Earners (≥$125K)" value={current.highEarnerCount} sub={`Flat $${HIGH_EARNER_FLAT_INCREASE.toLocaleString()} increase`} color="#f59e0b" />
              </div>
            </div>

            {/* CBA Formula */}
            <CBAFormulaDisplay cfg={YEAR_CONFIGS[selectedYear]} effectiveRate={current.effectiveRate} />

            {/* Payroll Bar Chart */}
            <Card title="5-Year Total Compensation Projection">
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 140 }}>
                {scenario.map((s, i) => {
                  const pct = (s.totalCost / (maxCost * 1.08)) * 100;
                  const isSelected = i === selectedYear;
                  return (
                    <div key={i} onClick={() => setSelectedYear(i)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <div style={{ fontSize: 9, color: "#4a5568", fontFamily: "monospace" }}>{fmtM(s.totalCost)}</div>
                      <div style={{
                        width: "100%",
                        height: `${pct}%`,
                        background: isSelected ? "linear-gradient(180deg, #3b82f6, #1e40af)" : "linear-gradient(180deg, #1e2736, #151c28)",
                        borderRadius: "3px 3px 0 0",
                        border: isSelected ? "1px solid #3b82f6" : "1px solid #1a2030",
                        minHeight: 8,
                        transition: "all 0.3s",
                      }} />
                      <div style={{ fontSize: 10, color: isSelected ? "#e2e8f0" : "#4a5568", fontWeight: isSelected ? 700 : 400 }}>{s.label}</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Unit Breakdown */}
            <Card title={`Payroll by Bargaining Unit — ${current.label}`}>
              <UnitBreakdownBar licensed={current.licensedTotal} esp={current.espTotal} cm={current.cmTotal} total={current.totalPayroll} />
            </Card>

            {/* YoY Table */}
            <Card title="Year-over-Year Detail">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Year</th>
                      <th style={th}>Rate</th>
                      <th style={th}>Licensed</th>
                      <th style={th}>ESP</th>
                      <th style={th}>CM</th>
                      <th style={th}>TRS</th>
                      <th style={th}>IMRF</th>
                      <th style={th}>Total Cost</th>
                      <th style={th}>Δ YoY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.map((s, i) => {
                      const yoy = i > 0 ? ((s.totalCost - scenario[i-1].totalCost) / scenario[i-1].totalCost * 100).toFixed(1) : "—";
                      const sel = i === selectedYear;
                      return (
                        <tr key={i} onClick={() => setSelectedYear(i)} style={{
                          background: sel ? "rgba(59,130,246,0.08)" : i % 2 === 0 ? "#080c12" : "#111620",
                          cursor: "pointer",
                          borderLeft: sel ? "3px solid #3b82f6" : "3px solid transparent",
                        }}>
                          <td style={{ ...td, color: sel ? "#60a5fa" : "#8b95a8", fontWeight: 600 }}>{s.label}</td>
                          <td style={{ ...td, color: "#34d399" }}>{fmtPct(s.effectiveRate)}</td>
                          <td style={{ ...td, color: "#3b82f6" }}>{fmtM(s.licensedTotal)}</td>
                          <td style={{ ...td, color: "#8b5cf6" }}>{fmtM(s.espTotal)}</td>
                          <td style={{ ...td, color: "#f59e0b" }}>{fmtM(s.cmTotal)}</td>
                          <td style={td}>{fmt(s.licensedTRS)}</td>
                          <td style={td}>{fmt(s.espIMRF + s.cmIMRF)}</td>
                          <td style={{ ...td, color: "#e2e8f0", fontWeight: 700 }}>{fmtM(s.totalCost)}</td>
                          <td style={{ ...td, color: yoy !== "—" ? "#f59e0b" : "#2d3748" }}>{yoy !== "—" ? `+${yoy}%` : yoy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ============ LICENSED TAB ============ */}
        {activeTab === "licensed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="Licensed Payroll" value={fmtM(current.licensedTotal)} color="#3b82f6" small />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="Avg Salary" value={fmt(current.avgLicensed)} color="#60a5fa" small />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="TRS Cost (9%)" value={fmt(current.licensedTRS)} color="#8b5cf6" small />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="Retire Eligible" value={current.retireEligibleCount} sub="Age ≥55, D21 ≥10yr" color="#f59e0b" small />
              </div>
            </div>
            <Card title={`Licensed Staff Roster — ${current.label}`}>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left" }}>Name</th>
                      <th style={th}>Lane</th>
                      <th style={th}>Step</th>
                      <th style={th}>D21 Yrs</th>
                      <th style={th}>Age</th>
                      <th style={th}>Salary</th>
                      <th style={th}>TRS (9%)</th>
                      <th style={th}>Total Comp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.licensedDetail.sort((a, b) => b.projectedSalary - a.projectedSalary).map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "#080c12" : "#111620" }}>
                        <td style={{ ...td, textAlign: "left", color: "#c4cdd9" }}>{p.name}</td>
                        <td style={{ ...td, color: "#60a5fa", textAlign: "center" }}>{LICENSED_LANES[p.laneIdx].label}</td>
                        <td style={{ ...td, textAlign: "center" }}>{p.step + 1}</td>
                        <td style={{ ...td, textAlign: "center" }}>{p.yearsInDistrict + current.year}</td>
                        <td style={{ ...td, textAlign: "center", color: (p.age + current.year >= 55) ? "#f59e0b" : "#4a5568" }}>{p.age + current.year}</td>
                        <td style={{ ...td, color: p.projectedSalary >= HIGH_EARNER_THRESHOLD ? "#f59e0b" : "#e2e8f0", fontWeight: 600 }}>{fmt(p.projectedSalary)}</td>
                        <td style={td}>{fmt(p.trs)}</td>
                        <td style={{ ...td, color: "#e2e8f0" }}>{fmt(p.projectedSalary + p.trs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ============ ESP TAB ============ */}
        {activeTab === "esp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="ESP Payroll" value={fmtM(current.espTotal)} color="#8b5cf6" small />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="Avg Salary" value={fmt(current.avgESP)} color="#a78bfa" small />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="IMRF Cost (4.5%)" value={fmt(current.espIMRF)} color="#6b7a8d" small />
              </div>
            </div>
            <Card title={`Educational Support Personnel — ${current.label}`}>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left" }}>Name</th>
                      <th style={th}>Category</th>
                      <th style={th}>D21 Yrs</th>
                      <th style={th}>Hourly</th>
                      <th style={th}>Hrs/Year</th>
                      <th style={th}>Annual</th>
                      <th style={th}>IMRF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.espDetail.sort((a, b) => b.projectedSalary - a.projectedSalary).map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "#080c12" : "#111620" }}>
                        <td style={{ ...td, textAlign: "left", color: "#c4cdd9" }}>{p.name}</td>
                        <td style={{ ...td, color: "#a78bfa", textAlign: "center", fontSize: 10 }}>{p.categoryLabel}</td>
                        <td style={{ ...td, textAlign: "center" }}>{p.yearsInDistrict + current.year}</td>
                        <td style={{ ...td, color: "#e2e8f0" }}>${p.projectedHourly.toFixed(2)}</td>
                        <td style={td}>{p.hoursYear.toLocaleString()}</td>
                        <td style={{ ...td, color: "#e2e8f0", fontWeight: 600 }}>{fmt(p.projectedSalary)}</td>
                        <td style={td}>{fmt(p.imrf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ============ CM TAB ============ */}
        {activeTab === "cm" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="CM Payroll" value={fmtM(current.cmTotal)} color="#f59e0b" small />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="Avg Salary" value={fmt(current.avgCM)} color="#fbbf24" small />
              </div>
              <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
                <Metric label="IMRF Cost (4.5%)" value={fmt(current.cmIMRF)} color="#6b7a8d" small />
              </div>
            </div>
            <Card title={`Custodial & Maintenance Staff — ${current.label}`}>
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left" }}>Name</th>
                      <th style={th}>Position</th>
                      <th style={th}>D21 Yrs</th>
                      <th style={th}>Hourly</th>
                      <th style={th}>Annual</th>
                      <th style={th}>IMRF</th>
                      <th style={th}>Vacation Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.cmDetail.sort((a, b) => b.projectedSalary - a.projectedSalary).map((p, i) => (
                      <tr key={p.id} style={{ background: i % 2 === 0 ? "#080c12" : "#111620" }}>
                        <td style={{ ...td, textAlign: "left", color: "#c4cdd9" }}>{p.name}</td>
                        <td style={{ ...td, color: "#fbbf24", textAlign: "center", fontSize: 10 }}>{p.categoryLabel}</td>
                        <td style={{ ...td, textAlign: "center" }}>{p.yearsInDistrict + current.year}</td>
                        <td style={{ ...td, color: "#e2e8f0" }}>${p.projectedHourly.toFixed(2)}</td>
                        <td style={{ ...td, color: "#e2e8f0", fontWeight: 600 }}>{fmt(p.projectedSalary)}</td>
                        <td style={td}>{fmt(p.imrf)}</td>
                        <td style={{ ...td, textAlign: "center" }}>{p.vacationDays || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ============ RETIREMENT TAB ============ */}
        {activeTab === "retirement" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#111620", border: "1px solid #1a2030", borderRadius: 8, padding: "14px 18px" }}>
              <Metric label="Retirement-Eligible Licensed Staff" value={current.retireEligibleCount} sub="Age ≥55, D21 service ≥10 years (Art. 209)" color="#f59e0b" />
            </div>
            <Card title="Retirement Incentive Options (Article 209)">
              <div style={{ fontSize: 12, color: "#8b95a8", lineHeight: 1.8, marginBottom: 12, fontFamily: "monospace", background: "#080c12", padding: 12, borderRadius: 4, border: "1px solid #1a2030" }}>
                <div><span style={{ color: "#3b82f6", fontWeight: 700 }}>Option 1:</span> 4-year notification → 5.5% salary increase each of 4 years before retirement</div>
                <div><span style={{ color: "#8b5cf6", fontWeight: 700 }}>Option 2:</span> 2-year notification → 5.5% × 2 years + $275/yr D21 service + $1,000/yr TRS service + $2,500/yr × 4yr insurance</div>
                <div><span style={{ color: "#f59e0b", fontWeight: 700 }}>Option 3:</span> Longevity only → $275/yr × D21 service (max 35 years) = up to $9,625</div>
                <div style={{ marginTop: 6, color: "#4a5568" }}>TRS 6% salary increase cap applies · Must not cause excess salary payment to TRS</div>
              </div>
            </Card>
            <Card title={`Eligible Staff — ${current.label}`}>
              <RetirementPanel data={current} />
            </Card>
          </div>
        )}

        {/* ============ CPI SCENARIOS TAB ============ */}
        {activeTab === "scenarios" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card title="CPI Scenario Modeling (Articles 208.2, 306.1, 405.1)">
              <div style={{ fontSize: 12, color: "#8b95a8", marginBottom: 16, lineHeight: 1.6 }}>
                Adjust CPI-U values for years 3–5 to model different economic scenarios. The formula applies CPI + 1.5%, capped at 3.75% with a 2.0% floor. Employees earning ≥$125K receive a flat $3,000 increase instead.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {YEAR_CONFIGS.map((cfg, i) => {
                  if (cfg.type === "fixed") {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "#080c12", borderRadius: 4, border: "1px solid #1a2030" }}>
                        <span style={{ width: 80, fontSize: 12, color: "#6b7a8d", fontWeight: 600 }}>{cfg.label}</span>
                        <span style={{ fontSize: 12, color: "#4a5568" }}>Fixed rate: {cfg.rate}%</span>
                        <span style={{ marginLeft: "auto", fontSize: 12, color: "#34d399", fontFamily: "monospace", fontWeight: 700 }}>→ {cfg.rate}%</span>
                      </div>
                    );
                  }
                  const cpiVal = cpiOverrides[i] ?? cfg.cpiActual;
                  const effective = calcCPIIncrease(cpiVal);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "#080c12", borderRadius: 4, border: "1px solid #1a2030", flexWrap: "wrap" }}>
                      <span style={{ width: 80, fontSize: 12, color: "#6b7a8d", fontWeight: 600 }}>{cfg.label}</span>
                      <span style={{ fontSize: 11, color: "#4a5568" }}>CPI-U:</span>
                      <input
                        type="range" min={0} max={10} step={0.1} value={cpiVal}
                        onChange={(e) => setCpiOverrides(prev => ({ ...prev, [i]: parseFloat(e.target.value) }))}
                        style={{ width: 120, accentColor: "#3b82f6" }}
                      />
                      <span style={{ fontSize: 13, fontFamily: "monospace", color: "#e2e8f0", fontWeight: 700, minWidth: 45 }}>{cpiVal.toFixed(1)}%</span>
                      <span style={{ fontSize: 11, color: "#4a5568" }}>+ {CPI_ADDER}% = {(cpiVal + CPI_ADDER).toFixed(1)}%</span>
                      {(cpiVal + CPI_ADDER) > CPI_CAP && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>CAPPED</span>}
                      {(cpiVal + CPI_ADDER) < CPI_FLOOR && <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>FLOOR</span>}
                      <span style={{ marginLeft: "auto", fontSize: 13, color: "#34d399", fontFamily: "monospace", fontWeight: 700 }}>→ {fmtPct(effective)}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Scenario Impact on Total Compensation">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Year</th>
                      <th style={th}>Effective Rate</th>
                      <th style={th}>Total Payroll</th>
                      <th style={th}>Total w/ Benefits</th>
                      <th style={th}>Δ vs Baseline</th>
                      <th style={th}>5-Yr Cumulative Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.map((s, i) => {
                      const cumulative = scenario.slice(0, i + 1).reduce((sum, y) => sum + y.totalCost, 0);
                      const vsBase = i > 0 ? ((s.totalCost - baseline.totalCost) / baseline.totalCost * 100).toFixed(1) : "—";
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#080c12" : "#111620" }}>
                          <td style={{ ...td, fontWeight: 600, color: "#8b95a8" }}>{s.label}</td>
                          <td style={{ ...td, color: "#34d399" }}>{fmtPct(s.effectiveRate)}</td>
                          <td style={{ ...td, color: "#c4cdd9" }}>{fmtM(s.totalPayroll)}</td>
                          <td style={{ ...td, color: "#e2e8f0", fontWeight: 700 }}>{fmtM(s.totalCost)}</td>
                          <td style={{ ...td, color: vsBase !== "—" ? "#f59e0b" : "#2d3748" }}>{vsBase !== "—" ? `+${vsBase}%` : vsBase}</td>
                          <td style={{ ...td, color: "#8b5cf6", fontWeight: 600 }}>{fmtM(cumulative)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "24px 0 8px", fontSize: 10, color: "#1e2736" }}>
          District 21 CBA Compensation Model · Prototype · davidgaus.com
        </div>
      </div>
    </div>
  );
}
