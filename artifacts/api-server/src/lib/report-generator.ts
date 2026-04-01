import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import AdmZip from "adm-zip";

type FreezeSpec = { xSplit: number; ySplit: number };

function injectFreezePanes(xlsxBuf: Buffer, sheetFreeze: Record<string, FreezeSpec>): Buffer {
  const zip = new AdmZip(xlsxBuf);
  const entries = zip.getEntries();
  for (const entry of entries) {
    const match = entry.entryName.match(/^xl\/worksheets\/(sheet\d+)\.xml$/);
    if (!match) continue;
    let xml = zip.readAsText(entry);
    const wsIdx = parseInt(match[1].replace("sheet", ""), 10) - 1;
    const sheetNames = Object.keys(sheetFreeze);
    if (wsIdx >= sheetNames.length) continue;
    const freeze = sheetFreeze[sheetNames[wsIdx]];
    if (!freeze) continue;
    const { xSplit, ySplit } = freeze;
    const topLeftCell = colName(xSplit) + (ySplit + 1);
    const paneXml = `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${xSplit}" ySplit="${ySplit}" topLeftCell="${topLeftCell}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>`;
    if (xml.includes("<sheetViews>")) {
      xml = xml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, paneXml);
    } else if (xml.includes("<sheetData")) {
      xml = xml.replace("<sheetData", paneXml + "<sheetData");
    } else {
      xml = xml.replace("</worksheet>", paneXml + "</worksheet>");
    }
    zip.deleteFile(entry);
    zip.addFile(entry.entryName, Buffer.from(xml, "utf8"));
  }
  return zip.toBuffer();
}

function colName(idx: number): string {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export type UnitYear = {
  contractYear: number;
  yearLabel: string;
  totalPayroll: string;
  totalRetirement: string;
  totalFICA: string;
  totalHealth: string;
  totalOther: string;
  totalEmployerCost: string;
  employeeCount: number;
};

export type UnitSummary = {
  unitId: string;
  unitName: string;
  retirementSystem: string;
  years: UnitYear[];
};

export type EmployeeYearRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  bargainingUnit: string;
  bargainingUnitId: string;
  contractYear: number;
  yearLabel?: string;
  projectedStep: number | null;
  projectedLaneName: string | null;
  projectedSalary: string;
  retirementContribution: string;
  ficaCost: string;
  healthInsuranceCost: string;
  otherBenefitsCost: string;
  totalEmployerCost: string;
};

export type YearConfig = {
  yearLabel: string;
  contractYear: number;
  bargainingUnit: string;
  increaseType: string;
  fixedPercentage: string | null;
  cpiValue: string | null;
  cpiAdder: string | null;
  cpiCap: string | null;
  cpiFloor: string | null;
  highEarnerThreshold: string | null;
  highEarnerFlatIncrease: string | null;
  stepAdvancement: boolean | null;
  healthPremiumIncreaseRate: string | null;
};

export type ScheduleCell = { laneName: string; stepNumber: number; salaryAmount: string };
export type ScheduleData = {
  unitName: string;
  scheduleName: string;
  effectiveYear: number;
  lanes: string[];
  steps: number[];
  cells: ScheduleCell[];
};

export type ReportDetail = {
  scenarioId: string;
  scenarioName: string;
  scenarioDescription?: string | null;
  scenarioStatus: string;
  isFinal: boolean;
  districtName: string | null;
  districtState?: string | null;
  reportGeneratedAt: string;
  yearSet: number[];
  unitSummaries: UnitSummary[];
  employeeDetail: EmployeeYearRow[];
  yearConfigs: YearConfig[];
  schedules?: ScheduleData[];
};

function fmt$(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString("en-US");
}
function fmtPct(v: string | number | null | undefined) {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toFixed(2) + "%";
}
function yl(detail: ReportDetail, yr: number) {
  const yc = detail.yearConfigs.find(c => c.contractYear === yr);
  return yc?.yearLabel ?? `Year ${yr}`;
}

export function generateBoardPdf(detail: ReportDetail): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PAGE_W = 215.9;
  const MARGIN = 18;
  const COL_W = PAGE_W - MARGIN * 2;
  const districtName = detail.districtName ?? "District";
  const scenarioName = detail.scenarioName;
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, PAGE_W, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(districtName, MARGIN, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Board Presentation — Collective Bargaining Compensation Forecast", MARGIN, 21);
  doc.setFontSize(9);
  doc.text(`Scenario: ${scenarioName} · Generated ${now}`, MARGIN, 27);
  doc.setTextColor(30, 30, 30);
  let y = 42;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Multi-Year Employer Cost Summary by Bargaining Unit", MARGIN, y);
  y += 6;

  const yearCols = detail.yearSet.map(yr => yl(detail, yr));
  const unitHead = [["Bargaining Unit", "Retirement", ...yearCols, "5-Yr Total", "YoY Δ"]];
  const unitBody = detail.unitSummaries.map(u => {
    const costs = u.years.map(yy => parseFloat(yy.totalEmployerCost));
    const total = costs.reduce((s, v) => s + v, 0);
    const delta = costs.length > 1 ? costs[costs.length - 1] - costs[0] : 0;
    const deltaPct = costs[0] > 0 ? (delta / costs[0]) * 100 : 0;
    return [
      u.unitName, u.retirementSystem,
      ...costs.map(v => fmt$(v)),
      fmt$(total),
      `${delta >= 0 ? "+" : ""}${fmt$(delta)} (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)`,
    ];
  });

  const totalByYear = detail.yearSet.map(yr =>
    detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === yr);
      return s + parseFloat(yy?.totalEmployerCost ?? "0");
    }, 0)
  );
  const grandTotal = totalByYear.reduce((s, v) => s + v, 0);
  const grandDelta = totalByYear.length > 1 ? totalByYear[totalByYear.length - 1] - totalByYear[0] : 0;
  const grandPct = totalByYear[0] > 0 ? (grandDelta / totalByYear[0]) * 100 : 0;
  unitBody.push(["DISTRICT TOTAL", "", ...totalByYear.map(v => fmt$(v)), fmt$(grandTotal),
    `${grandDelta >= 0 ? "+" : ""}${fmt$(grandDelta)} (${grandPct >= 0 ? "+" : ""}${grandPct.toFixed(1)}%)`]);

  autoTable(doc, {
    startY: y, head: unitHead, body: unitBody, theme: "grid",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: { 0: { fontStyle: "bold" } },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
    didParseCell: (data) => {
      if (data.row.index === unitBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [219, 234, 254];
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Year-over-Year Cost Progression", MARGIN, y);
  y += 5;

  const progressHead = [["Year", "Total Payroll", "Total Benefits", "Total Employer Cost", "YoY $ Change", "YoY % Change", "Employee Count"]];
  const progressBody = detail.yearSet.map((yr, idx) => {
    const payroll = detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalPayroll ?? "0");
    }, 0);
    const benefits = detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === yr);
      return s + parseFloat(yy?.totalRetirement ?? "0") + parseFloat(yy?.totalFICA ?? "0") + parseFloat(yy?.totalHealth ?? "0") + parseFloat(yy?.totalOther ?? "0");
    }, 0);
    const totalCost = payroll + benefits;
    const prev = idx > 0 ? totalByYear[idx - 1] : null;
    const delta = prev != null ? totalByYear[idx] - prev : null;
    const pct = prev != null && prev > 0 ? ((totalByYear[idx] - prev) / prev) * 100 : null;
    const empCount = detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === yr); return s + (yy?.employeeCount ?? 0);
    }, 0);
    return [
      yl(detail, yr), fmt$(payroll), fmt$(benefits), fmt$(totalCost),
      delta != null ? `${delta >= 0 ? "+" : ""}${fmt$(delta)}` : "—",
      pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—",
      String(empCount),
    ];
  });

  autoTable(doc, {
    startY: y, head: progressHead, body: progressBody, theme: "striped",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (y > 180) { doc.addPage(); y = 20; }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Annual Total Employer Cost — Bar Chart", MARGIN, y);
  y += 6;

  {
    const maxCost = Math.max(...totalByYear);
    const chartW = COL_W;
    const barH = 10;
    const gap = 3;
    const barColors: [number, number, number][] = [[59, 130, 246], [99, 102, 241], [168, 85, 247], [236, 72, 153], [245, 158, 11]];
    for (let i = 0; i < detail.yearSet.length; i++) {
      const yr = detail.yearSet[i];
      const cost = totalByYear[i];
      const barW = maxCost > 0 ? (cost / maxCost) * chartW * 0.72 : 0;
      const [r, g, b] = barColors[i % barColors.length];
      doc.setFillColor(r, g, b);
      doc.rect(MARGIN + 35, y, barW, barH, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(yl(detail, yr), MARGIN, y + 7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(fmt$(cost), MARGIN + 35 + barW + 2, y + 7);
      y += barH + gap;
    }
    y += 6;
  }

  if (y > 225) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Cost Component Breakdown (All Units)", MARGIN, y);
  y += 5;

  const compHead = [["Year", "Payroll", "Retirement", "FICA/Medicare", "Health Insurance", "Other Benefits", "Total"]];
  const compBody = detail.yearSet.map(yr => {
    const fields = ["totalPayroll", "totalRetirement", "totalFICA", "totalHealth", "totalOther", "totalEmployerCost"] as const;
    const vals = fields.map(f => detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat((yy as unknown as Record<string, string>)[f] ?? "0");
    }, 0));
    return [yl(detail, yr), ...vals.map(v => fmt$(v))];
  });

  autoTable(doc, {
    startY: y, head: compHead, body: compBody, theme: "grid",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Scenario Configuration", MARGIN, y);
  y += 5;

  const byUnit: Record<string, YearConfig[]> = {};
  for (const yc of detail.yearConfigs) {
    const u = yc.bargainingUnit ?? "Unknown";
    if (!byUnit[u]) byUnit[u] = [];
    byUnit[u].push(yc);
  }
  for (const [unitName, configs] of Object.entries(byUnit)) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(`▸ ${unitName}`, MARGIN, y);
    y += 4;
    const cfgHead = [["Year", "Type", "Rate", "CPI Floor", "CPI Cap", "High Earner", "Step Adv."]];
    const cfgBody = configs.map(yc => [
      yc.yearLabel,
      yc.increaseType === "cpi_formula" ? "CPI Formula" : yc.increaseType === "fixed_percentage" ? "Fixed %" : yc.increaseType === "flat_dollar" ? "Flat $" : yc.increaseType,
      yc.increaseType === "fixed_percentage" ? fmtPct(yc.fixedPercentage) : yc.increaseType === "cpi_formula" ? `CPI+${fmtPct(yc.cpiAdder)}` : yc.fixedPercentage ? fmt$(yc.fixedPercentage) : "—",
      yc.cpiFloor ? fmtPct(yc.cpiFloor) : "—",
      yc.cpiCap ? fmtPct(yc.cpiCap) : "—",
      yc.highEarnerThreshold ? `>${fmt$(yc.highEarnerThreshold)}` : "—",
      yc.stepAdvancement ? "Yes" : "No",
    ]);
    autoTable(doc, {
      startY: y, head: cfgHead, body: cfgBody, theme: "grid",
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`CollBar · ${districtName} · Board Presentation · ${scenarioName} · Page ${i} of ${pageCount}`, PAGE_W / 2, 274, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateNegotiationPdf(detail: ReportDetail): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PAGE_W = 215.9;
  const MARGIN = 15;
  const COL_W = PAGE_W - MARGIN * 2;
  const districtName = detail.districtName ?? "District";
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_W, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(districtName, MARGIN, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Collective Bargaining — Negotiation Summary · ${now}`, MARGIN, 20);
  doc.setFontSize(8);
  doc.text(`Scenario: ${detail.scenarioName} · Status: ${detail.scenarioStatus}`, MARGIN, 27);
  doc.setFont("helvetica", "italic");
  doc.text(`Single-scenario detailed cost analysis. For scenario comparison, use the Scenario Compare view in CollBar.`, MARGIN, 33);
  doc.setTextColor(30, 30, 30);
  let y = 42;

  const byUnit: Record<string, YearConfig[]> = {};
  for (const yc of detail.yearConfigs) {
    const u = yc.bargainingUnit ?? "Unknown";
    if (!byUnit[u]) byUnit[u] = [];
    byUnit[u].push(yc);
  }

  for (const [unitName, configs] of Object.entries(byUnit)) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 95);
    doc.text(`Bargaining Unit: ${unitName}`, MARGIN, y);
    y += 5;

    const head = [["Year", "Increase Type", "Rate / Formula", "CPI Floor", "CPI Cap", "CPI Adder", "High Earner Threshold", "Step Adv.", "Health ∆"]];
    const body = configs.map(yc => [
      yc.yearLabel,
      yc.increaseType === "cpi_formula" ? "CPI Formula" : yc.increaseType === "fixed_percentage" ? "Fixed %" : yc.increaseType === "flat_dollar" ? "Flat Dollar" : yc.increaseType,
      yc.increaseType === "fixed_percentage" ? fmtPct(yc.fixedPercentage) : yc.increaseType === "cpi_formula" ? `CPI + ${fmtPct(yc.cpiAdder)} adder` : yc.fixedPercentage ? fmt$(yc.fixedPercentage) : "—",
      yc.cpiFloor ? fmtPct(yc.cpiFloor) : "—",
      yc.cpiCap ? fmtPct(yc.cpiCap) : "—",
      yc.cpiAdder ? fmtPct(yc.cpiAdder) : "—",
      yc.highEarnerThreshold ? `>${fmt$(yc.highEarnerThreshold)} → ${yc.highEarnerFlatIncrease ? fmt$(yc.highEarnerFlatIncrease) : "flat"}` : "—",
      yc.stepAdvancement ? "Yes" : "No",
      yc.healthPremiumIncreaseRate ? fmtPct(yc.healthPremiumIncreaseRate) : "—",
    ]);
    autoTable(doc, {
      startY: y, head, body, theme: "grid",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

    const unitData = detail.unitSummaries.find(u => u.unitName === unitName);
    if (unitData) {
      const costHead = [["Contract Year", "Payroll", "Retirement", "FICA", "Health", "Other", "Total Employer Cost", "Count"]];
      const costBody = unitData.years.map(yy => [
        yl(detail, yy.contractYear),
        fmt$(yy.totalPayroll), fmt$(yy.totalRetirement), fmt$(yy.totalFICA),
        fmt$(yy.totalHealth), fmt$(yy.totalOther), fmt$(yy.totalEmployerCost),
        String(yy.employeeCount),
      ]);
      const ytotal = unitData.years.reduce((s, yy) => s + parseFloat(yy.totalEmployerCost), 0);
      costBody.push(["5-YR TOTAL", "", "", "", "", "", fmt$(ytotal), ""]);

      autoTable(doc, {
        startY: y, head: costHead, body: costBody, theme: "striped",
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
        didParseCell: (data) => {
          if (data.row.index === costBody.length - 1) data.cell.styles.fontStyle = "bold";
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    }
  }

  if (y > 215) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("District-Wide Cost Summary", MARGIN, y);
  y += 5;

  const distHead = [["Year", "Total Payroll", "Total Retirement", "Total FICA", "Total Health", "Total Other", "Total Employer Cost", "YoY Δ"]];
  const distBody = detail.yearSet.map((yr, idx) => {
    const fields = ["totalPayroll", "totalRetirement", "totalFICA", "totalHealth", "totalOther", "totalEmployerCost"] as const;
    const vals = fields.map(f => detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat((yy as unknown as Record<string, string>)[f] ?? "0");
    }, 0));
    const prev = idx > 0 ? detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === detail.yearSet[idx - 1]); return s + parseFloat(yy?.totalEmployerCost ?? "0");
    }, 0) : null;
    const delta = prev != null ? vals[5] - prev : null;
    const pct = prev != null && prev > 0 ? (delta! / prev) * 100 : null;
    return [yl(detail, yr), ...vals.map(v => fmt$(v)), delta != null ? `${delta >= 0 ? "+" : ""}${fmt$(delta)} (${pct!.toFixed(1)}%)` : "Baseline"];
  });

  autoTable(doc, {
    startY: y, head: distHead, body: distBody, theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`CollBar · Negotiation Summary · ${districtName} · ${detail.scenarioName} · Page ${i} of ${pageCount}`, PAGE_W / 2, 274, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateNegotiationComparisonPdf(details: ReportDetail[]): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const PAGE_W = 279.4;
  const MARGIN = 15;
  const COL_W = PAGE_W - MARGIN * 2;
  const districtName = details[0]?.districtName ?? "District";
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_W, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(districtName, MARGIN, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Collective Bargaining — Multi-Scenario Comparison Report · ${now}`, MARGIN, 20);
  doc.setFontSize(8);
  doc.text(`Scenarios: ${details.map(d => d.scenarioName).join(" | ")} (${details.length} compared)`, MARGIN, 28);
  doc.setTextColor(30, 30, 30);
  let y = 40;

  const scenarioColors: [number, number, number][] = [[59, 130, 246], [168, 85, 247], [245, 158, 11], [16, 185, 129]];

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("5-Year Total Employer Cost — Scenario Comparison", MARGIN, y);
  y += 5;

  const summaryHead = [["Scenario", "Status", ...details[0].yearSet.map(yr => yl(details[0], yr)), "5-Yr Total", "vs Lowest"]];
  const fiveYrTotals = details.map(d =>
    d.yearSet.reduce((total, yr) =>
      total + d.unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalEmployerCost ?? "0"); }, 0)
    , 0)
  );
  const minTotal = Math.min(...fiveYrTotals);
  const summaryBody = details.map((d, di) => {
    const yearCosts = d.yearSet.map(yr =>
      d.unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalEmployerCost ?? "0"); }, 0)
    );
    const total = fiveYrTotals[di];
    const delta = total - minTotal;
    return [
      d.scenarioName, d.scenarioStatus,
      ...yearCosts.map(v => fmt$(v)),
      fmt$(total),
      delta === 0 ? "LOWEST" : `+${fmt$(delta)}`,
    ];
  });
  autoTable(doc, {
    startY: y, head: summaryHead, body: summaryBody, theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
    didParseCell: (data) => {
      if (data.section === "body") {
        const cells = Object.values(data.row.cells);
        const lastCol = cells[cells.length - 1];
        if (lastCol?.text?.[0] === "LOWEST") { data.cell.styles.textColor = [16, 122, 87]; data.cell.styles.fontStyle = "bold"; }
        const [r, g, b] = scenarioColors[data.row.index % scenarioColors.length];
        if (data.column.index === 0) data.cell.styles.textColor = [r, g, b];
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const allUnits = [...new Set(details.flatMap(d => d.unitSummaries.map(u => u.unitName)))];
  for (const unitName of allUnits) {
    if (y > 150) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 95);
    doc.text(`Bargaining Unit: ${unitName}`, MARGIN, y);
    y += 4;

    const yearLabels = details[0].yearSet.map(yr => yl(details[0], yr));
    const unitHead = [["Metric", ...details.map(d => d.scenarioName.slice(0, 20))]];
    const unitBody: string[][] = [];

    for (const yr of details[0].yearSet) {
      const yrLabel = yl(details[0], yr);
      const payrolls = details.map(d => { const u = d.unitSummaries.find(u => u.unitName === unitName); const yy = u?.years.find(y => y.contractYear === yr); return parseFloat(yy?.totalPayroll ?? "0"); });
      const costs = details.map(d => { const u = d.unitSummaries.find(u => u.unitName === unitName); const yy = u?.years.find(y => y.contractYear === yr); return parseFloat(yy?.totalEmployerCost ?? "0"); });
      const rateInfo = details.map(d => { const yc = d.yearConfigs.find(c => c.contractYear === yr && c.bargainingUnit === unitName); return yc ? (yc.increaseType === "fixed_percentage" ? fmtPct(yc.fixedPercentage) : yc.increaseType === "cpi_formula" ? `CPI+${fmtPct(yc.cpiAdder)}` : "flat $") : "—"; });
      unitBody.push([`${yrLabel} Payroll`, ...payrolls.map(v => fmt$(v))]);
      unitBody.push([`${yrLabel} Rate`, ...rateInfo]);
      unitBody.push([`${yrLabel} Total Cost`, ...costs.map(v => fmt$(v))]);
    }

    const unit5yrCosts = details.map(d => { const u = d.unitSummaries.find(u => u.unitName === unitName); return u?.years.reduce((s, yy) => s + parseFloat(yy.totalEmployerCost), 0) ?? 0; });
    const minUnit = Math.min(...unit5yrCosts);
    unitBody.push(["5-Yr Total", ...unit5yrCosts.map((v, i) => v === minUnit && details.length > 1 ? `${fmt$(v)} ★` : fmt$(v))]);

    autoTable(doc, {
      startY: y, head: unitHead, body: unitBody, theme: "striped",
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
      didParseCell: (data) => {
        if (data.section === "body" && data.row.index === unitBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [219, 234, 254];
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (y > 160) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Scenario Assumptions Comparison", MARGIN, y);
  y += 4;

  for (const yr of details[0].yearSet) {
    if (y > 175) { doc.addPage(); y = 20; }
    const yrLabel = yl(details[0], yr);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    doc.text(`Contract Year: ${yrLabel}`, MARGIN, y);
    y += 3;
    const assHead = [["Unit", ...details.map(d => d.scenarioName.slice(0, 18))]];
    const unitsForYr = [...new Set(details.flatMap(d => d.yearConfigs.filter(yc => yc.contractYear === yr).map(yc => yc.bargainingUnit ?? "")))];
    const assBody = unitsForYr.map(unit => {
      const rates = details.map(d => {
        const yc = d.yearConfigs.find(c => c.contractYear === yr && c.bargainingUnit === unit);
        if (!yc) return "—";
        if (yc.increaseType === "fixed_percentage") return `Fixed ${fmtPct(yc.fixedPercentage)}${yc.stepAdvancement ? " + Step" : ""}`;
        if (yc.increaseType === "cpi_formula") return `CPI+${fmtPct(yc.cpiAdder)} [${fmtPct(yc.cpiFloor)}–${fmtPct(yc.cpiCap)}]`;
        if (yc.increaseType === "flat_dollar") return `Flat ${fmt$(yc.fixedPercentage ?? 0)}`;
        return yc.increaseType;
      });
      return [unit, ...rates];
    });
    autoTable(doc, {
      startY: y, head: assHead, body: assBody, theme: "grid",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7, fontStyle: "bold" },
      bodyStyles: { fontSize: 7 },
      margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`CollBar · Negotiation Comparison · ${districtName} · ${details.map(d => d.scenarioName).join(" vs ")} · Page ${i} of ${pageCount}`, PAGE_W / 2, 200, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateBudgetImpactPdf(detail: ReportDetail): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const PAGE_W = 279.4;
  const MARGIN = 15;
  const COL_W = PAGE_W - MARGIN * 2;
  const districtName = detail.districtName ?? "District";
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(16, 122, 87);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(`${districtName} — Budget Impact Analysis`, MARGIN, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Scenario: ${detail.scenarioName} · Status: ${detail.scenarioStatus} · Generated ${now}`, MARGIN, 19);
  doc.setTextColor(30, 30, 30);
  let y = 34;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87);
  doc.text("Year-over-Year Cost Impact by Component", MARGIN, y);
  y += 5;

  const yearCols = detail.yearSet.map(yr => yl(detail, yr));
  const fields = ["totalPayroll", "totalRetirement", "totalFICA", "totalHealth", "totalOther", "totalEmployerCost"] as const;
  const labels = ["Total Payroll", "Retirement (TRS/IMRF)", "FICA / Medicare", "Health Insurance", "Dental/Life/Other", "TOTAL EMPLOYER COST"];

  const getTotals = (f: typeof fields[number]) =>
    detail.yearSet.map(yr => detail.unitSummaries.reduce((s, u) => {
      const yy = u.years.find(y => y.contractYear === yr);
      return s + parseFloat((yy as unknown as Record<string, string>)[f] ?? "0");
    }, 0));

  const allTotals = fields.map(f => getTotals(f));
  const fiveYrTotals = allTotals.map(row => row.reduce((s, v) => s + v, 0));

  const compHead = [["Category", ...yearCols, "5-Year Total"]];
  const compBody = labels.map((label, fi) => {
    const row = allTotals[fi];
    return [label, ...row.map(v => fmt$(v)), fmt$(fiveYrTotals[fi])];
  });

  autoTable(doc, {
    startY: y, head: compHead, body: compBody, theme: "grid",
    headStyles: { fillColor: [16, 122, 87], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
    didParseCell: (data) => {
      if (data.row.index === compBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [209, 250, 229];
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87);
  doc.text("Year-over-Year Delta (Total Employer Cost)", MARGIN, y);
  y += 4;

  const deltaHead = [["Transition", "$ Change", "% Change", "Notes"]];
  const totalCosts = allTotals[5];
  const deltaBody = detail.yearSet.slice(1).map((yr, idx) => {
    const from = yl(detail, detail.yearSet[idx]);
    const to = yl(detail, yr);
    const delta = totalCosts[idx + 1] - totalCosts[idx];
    const pct = totalCosts[idx] > 0 ? (delta / totalCosts[idx]) * 100 : 0;
    const yr_cfg = detail.yearConfigs.find(yc => yc.contractYear === yr);
    const note = yr_cfg ? (yr_cfg.increaseType === "cpi_formula" ? `CPI formula (floor ${fmtPct(yr_cfg.cpiFloor)}, cap ${fmtPct(yr_cfg.cpiCap)})` : yr_cfg.increaseType === "fixed_percentage" ? `Fixed ${fmtPct(yr_cfg.fixedPercentage)}` : yr_cfg.increaseType) : "—";
    return [
      `${from} → ${to}`,
      `${delta >= 0 ? "+" : ""}${fmt$(delta)}`,
      `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
      note,
    ];
  });

  autoTable(doc, {
    startY: y, head: deltaHead, body: deltaBody, theme: "striped",
    headStyles: { fillColor: [16, 122, 87], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  if (y > 130) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87);
  doc.text("Cost Driver Attribution (Year-Over-Year Payroll Δ)", MARGIN, y);
  y += 4;

  {
    const driverHead = [["Transition", "Base Rate Increase", "Step Advancement Effect", "Benefit Changes", "Headcount Change", "Total Δ"]];
    const driverBody: string[][] = [];
    const payrollByYear = detail.yearSet.map(yr =>
      detail.unitSummaries.reduce((s, u) => {
        const yy = u.years.find(y => y.contractYear === yr);
        return s + parseFloat(yy?.totalPayroll ?? "0");
      }, 0)
    );
    const benefitsByYear = detail.yearSet.map(yr =>
      detail.unitSummaries.reduce((s, u) => {
        const yy = u.years.find(y => y.contractYear === yr);
        return s + parseFloat(yy?.totalRetirement ?? "0") + parseFloat(yy?.totalFICA ?? "0") + parseFloat(yy?.totalHealth ?? "0") + parseFloat(yy?.totalOther ?? "0");
      }, 0)
    );
    const countByYear = detail.yearSet.map(yr =>
      detail.unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + (yy?.employeeCount ?? 0); }, 0)
    );
    for (let i = 1; i < detail.yearSet.length; i++) {
      const yr = detail.yearSet[i];
      const prevYr = detail.yearSet[i - 1];
      const payrollDelta = payrollByYear[i] - payrollByYear[i - 1];
      const benefitDelta = benefitsByYear[i] - benefitsByYear[i - 1];
      const countDelta = countByYear[i] - countByYear[i - 1];
      const yrCfg = detail.yearConfigs.find(yc => yc.contractYear === yr);
      const stepAdvUnits = detail.yearConfigs.filter(yc => yc.contractYear === yr && yc.stepAdvancement);
      const stepPct = stepAdvUnits.length > 0 ? 0.04 : 0;
      const stepEffect = payrollByYear[i - 1] * stepPct;
      const baseRateEffect = payrollDelta - stepEffect;
      const note = countDelta !== 0 ? `${countDelta > 0 ? "+" : ""}${countDelta} FTE` : "stable";
      driverBody.push([
        `${yl(detail, prevYr)} → ${yl(detail, yr)}`,
        `${baseRateEffect >= 0 ? "+" : ""}${fmt$(baseRateEffect)} (${yrCfg ? (yrCfg.increaseType === "fixed_percentage" ? fmtPct(yrCfg.fixedPercentage) : yrCfg.increaseType === "cpi_formula" ? "CPI" : "flat $") : "—"})`,
        `${stepEffect >= 0 ? "+" : ""}${fmt$(stepEffect)} (${stepAdvUnits.length} units)`,
        `${benefitDelta >= 0 ? "+" : ""}${fmt$(benefitDelta)}`,
        note,
        `${payrollDelta + benefitDelta >= 0 ? "+" : ""}${fmt$(payrollDelta + benefitDelta)}`,
      ]);
    }
    autoTable(doc, {
      startY: y, head: driverHead, body: driverBody, theme: "grid",
      headStyles: { fillColor: [16, 122, 87], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  if (y > 165) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87);
  doc.text("Per-Unit Cost Breakdown", MARGIN, y);
  y += 4;

  const unitBreakHead = [["Unit", "Year", "Payroll", "Retirement", "FICA", "Health", "Other", "Total Employer Cost", "Count"]];
  const unitBreakBody: string[][] = [];
  for (const u of detail.unitSummaries) {
    for (const yy of u.years) {
      unitBreakBody.push([
        u.unitName, yl(detail, yy.contractYear),
        fmt$(yy.totalPayroll), fmt$(yy.totalRetirement), fmt$(yy.totalFICA),
        fmt$(yy.totalHealth), fmt$(yy.totalOther), fmt$(yy.totalEmployerCost),
        String(yy.employeeCount),
      ]);
    }
  }

  autoTable(doc, {
    startY: y, head: unitBreakHead, body: unitBreakBody, theme: "striped",
    headStyles: { fillColor: [16, 122, 87], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: COL_W,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`CollBar · Budget Impact Analysis · ${districtName} · ${detail.scenarioName} · Page ${i} of ${pageCount}`, PAGE_W / 2, 197, { align: "center" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateHeatmapPdf(detail: ReportDetail, heatmapPngBase64?: string): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PAGE_W = 215.9;
  const MARGIN = 18;
  const districtName = detail.districtName ?? "District";
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, PAGE_W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${districtName} — Salary Heatmap Report`, MARGIN, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Scenario: ${detail.scenarioName} · Generated ${now}`, MARGIN, 22);
  doc.setTextColor(30, 30, 30);
  let y = 38;

  if (heatmapPngBase64) {
    doc.addImage(heatmapPngBase64, "PNG", MARGIN, y, PAGE_W - MARGIN * 2, 80, undefined, "FAST");
    y += 85;
  } else {
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 30, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Heatmap snapshot not included. Open the interactive heatmap in CollBar and use", MARGIN + 5, y + 10);
    doc.text("'Export PNG' on the Heatmap page to capture the live grid for embedding in presentations.", MARGIN + 5, y + 16);
    y += 36;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 33, 182);
  doc.text("Bargaining Units Overview", MARGIN, y);
  y += 5;

  const unitHead = [["Bargaining Unit", "Type", "Retirement", "Employees (Yr 1)", "5-Yr Total Cost", "Avg Salary (Yr 1)"]];
  const unitBody = detail.unitSummaries.map(u => {
    const yr1 = u.years[0];
    const total = u.years.reduce((s, yy) => s + parseFloat(yy.totalEmployerCost), 0);
    const avgSalary = yr1 && yr1.employeeCount > 0
      ? fmt$(parseFloat(yr1.totalPayroll) / yr1.employeeCount)
      : "—";
    return [u.unitName, "Salary Schedule", u.retirementSystem, String(yr1?.employeeCount ?? 0), fmt$(total), avgSalary];
  });

  autoTable(doc, {
    startY: y, head: unitHead, body: unitBody, theme: "grid",
    headStyles: { fillColor: [91, 33, 182], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: PAGE_W - MARGIN * 2,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 33, 182);
  doc.text("Color Legend — Step/Lane Density", MARGIN, y);
  y += 5;

  const legendItems: Array<{ label: string; rgb: [number, number, number] }> = [
    { label: "Empty (0 employees at this step/lane)", rgb: [30, 35, 45] },
    { label: "Low (1 employee)", rgb: [30, 58, 138] },
    { label: "Medium-Low (2 employees)", rgb: [37, 99, 235] },
    { label: "Medium (3–4 employees)", rgb: [59, 130, 246] },
    { label: "High (5–7 employees)", rgb: [147, 197, 253] },
    { label: "Very High (8+ employees)", rgb: [219, 234, 254] },
  ];
  for (const item of legendItems) {
    doc.setFillColor(...item.rgb);
    doc.rect(MARGIN, y, 10, 5, "F");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(item.label, MARGIN + 14, y + 3.5);
    y += 7;
  }

  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 33, 182);
  doc.text("Bargaining Unit Colors (Heatmap Page)", MARGIN, y);
  y += 5;

  const colorLegend: Array<{ label: string; rgb: [number, number, number] }> = [
    { label: "Licensed Staff (Teachers / Certified)", rgb: [59, 130, 246] },
    { label: "ESP (Education Support Professionals)", rgb: [139, 92, 246] },
    { label: "CM / Custodial / Maintenance", rgb: [245, 158, 11] },
  ];
  for (const item of colorLegend) {
    doc.setFillColor(...item.rgb);
    doc.rect(MARGIN, y, 10, 5, "F");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(item.label, MARGIN + 14, y + 3.5);
    y += 7;
  }

  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`CollBar · Salary Heatmap Report · ${districtName} · ${detail.scenarioName}`, PAGE_W / 2, 274, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

export function generateEmployeeExcel(detail: ReportDetail): Buffer {
  const wb = XLSX.utils.book_new();
  const INT_CURR = '"$"#,##0';
  const DEC_CURR = '"$"#,##0.00';

  function applyCurrencyFmt(ws: XLSX.WorkSheet, cols: string[], startRow: number, endRow: number, fmt = INT_CURR) {
    for (let r = startRow; r <= endRow; r++) {
      for (const col of cols) {
        const ref = `${col}${r}`;
        if (ws[ref]) { ws[ref].t = "n"; ws[ref].z = fmt; }
      }
    }
  }

  const yearSet = detail.yearSet;
  const unitSummaries = detail.unitSummaries;
  const yearConfigs = detail.yearConfigs;
  const employeeDetail = detail.employeeDetail;

  const yearLabel = (yr: number) => {
    const yc = yearConfigs.find(c => c.contractYear === yr);
    return yc?.yearLabel ?? `Year ${yr}`;
  };

  const allYearTotals = yearSet.map(yr => {
    const payroll = unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalPayroll ?? "0"); }, 0);
    const ret = unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalRetirement ?? "0"); }, 0);
    const fica = unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalFICA ?? "0"); }, 0);
    const health = unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalHealth ?? "0"); }, 0);
    const other = unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalOther ?? "0"); }, 0);
    const total = unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + parseFloat(yy?.totalEmployerCost ?? "0"); }, 0);
    const count = unitSummaries.reduce((s, u) => { const yy = u.years.find(y => y.contractYear === yr); return s + (yy?.employeeCount ?? 0); }, 0);
    return { yearLabel: yearLabel(yr), payroll, ret, fica, health, other, total, count };
  });

  const summaryRows: (string | number)[][] = [
    ["DISTRICT", detail.districtName ?? ""],
    ["SCENARIO", detail.scenarioName],
    ["STATUS", detail.scenarioStatus],
    ["GENERATED", new Date().toLocaleDateString()],
    [],
    ["5-YEAR EMPLOYER COST SUMMARY"],
    [],
    ["Contract Year", "Total Payroll", "Retirement", "FICA/Medicare", "Health Insurance", "Other Benefits", "Total Employer Cost", "Employee Count"],
  ];
  for (const yt of allYearTotals) {
    summaryRows.push([yt.yearLabel, yt.payroll, yt.ret, yt.fica, yt.health, yt.other, yt.total, yt.count]);
  }
  const grandTotal = allYearTotals.reduce((s, v) => s + v.total, 0);
  summaryRows.push([
    "5-YEAR TOTAL",
    allYearTotals.reduce((s, v) => s + v.payroll, 0),
    allYearTotals.reduce((s, v) => s + v.ret, 0),
    allYearTotals.reduce((s, v) => s + v.fica, 0),
    allYearTotals.reduce((s, v) => s + v.health, 0),
    allYearTotals.reduce((s, v) => s + v.other, 0),
    grandTotal,
    "",
  ]);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 16 }];
  const sumDataStart = 9;
  const sumDataEnd = sumDataStart + allYearTotals.length;
  applyCurrencyFmt(summaryWs, ["B", "C", "D", "E", "F", "G"], sumDataStart, sumDataEnd, INT_CURR);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  for (const u of unitSummaries) {
    const unitEmpDetail = employeeDetail.filter(e => e.bargainingUnitId === u.unitId);
    const uniqueEmps = [...new Set(unitEmpDetail.map(e => e.employeeId))];

    const empRows: (string | number)[][] = [
      [u.unitName, "Retirement:", u.retirementSystem],
      [`${uniqueEmps.length} employees`, `${yearSet.length} contract years`],
      [],
    ];

    const FIELDS_PER_YEAR = 9;
    const empYearHeader = ["Employee #", "Employee Name", ...yearSet.flatMap(yr => [
      `${yearLabel(yr)} Step`, `${yearLabel(yr)} Lane`, `${yearLabel(yr)} Salary`, `${yearLabel(yr)} Retirement`, `${yearLabel(yr)} FICA`,
      `${yearLabel(yr)} Health`, `${yearLabel(yr)} Other`, `${yearLabel(yr)} Total Cost`, `${yearLabel(yr)} Emp Cost`,
    ])];
    empRows.push(empYearHeader);

    const empMap: Record<string, EmployeeYearRow[]> = {};
    for (const row of unitEmpDetail) {
      if (!empMap[row.employeeId]) empMap[row.employeeId] = [];
      empMap[row.employeeId].push(row);
    }

    for (const empId of uniqueEmps) {
      const empRecords = (empMap[empId] ?? []).sort((a, b) => a.contractYear - b.contractYear);
      const empName = empRecords[0]?.employeeName ?? "";
      const empNum = empRecords[0]?.employeeNumber ?? "";
      const row: (string | number)[] = [empNum, empName];
      for (const yr of yearSet) {
        const rec = empRecords.find(r => r.contractYear === yr);
        if (rec) {
          const salary = parseFloat(rec.projectedSalary) || 0;
          const retirement = parseFloat(rec.retirementContribution) || 0;
          const fica = parseFloat(rec.ficaCost) || 0;
          const health = parseFloat(rec.healthInsuranceCost) || 0;
          const other = parseFloat(rec.otherBenefitsCost) || 0;
          const totalCost = parseFloat(rec.totalEmployerCost) || 0;
          const empCost = salary + retirement + fica + health + other;
          row.push(
            rec.projectedStep ?? "",
            rec.projectedLaneName ?? "",
            salary,
            retirement,
            fica,
            health,
            other,
            totalCost,
            empCost,
          );
        } else {
          row.push("", "", "", "", "", "", "", "", "");
        }
      }
      empRows.push(row);
    }

    const unitWs = XLSX.utils.aoa_to_sheet(empRows);
    const cols: XLSX.ColInfo[] = [{ wch: 12 }, { wch: 26 }];
    for (let i = 0; i < yearSet.length; i++) {
      cols.push({ wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 15 }, { wch: 15 });
    }
    unitWs["!cols"] = cols;

    const dataRowStart = 5;
    const dataRowEnd = dataRowStart + uniqueEmps.length - 1;
    if (uniqueEmps.length > 0) {
      const totalCols = yearSet.length * FIELDS_PER_YEAR;
      const currencyCols: string[] = [];
      for (let i = 0; i < totalCols; i++) {
        const colIdx = 2 + i;
        const fieldIdx = i % FIELDS_PER_YEAR;
        if (fieldIdx === 0 || fieldIdx === 1) continue;
        if (colIdx < 26) currencyCols.push(String.fromCharCode(65 + colIdx));
        else currencyCols.push(String.fromCharCode(64 + Math.floor(colIdx / 26)) + String.fromCharCode(65 + (colIdx % 26)));
      }
      applyCurrencyFmt(unitWs, currencyCols, dataRowStart, dataRowEnd, INT_CURR);
    }

    const sheetName = u.unitName.replace(/[/\\?*[\]:]/g, "_").slice(0, 29);
    XLSX.utils.book_append_sheet(wb, unitWs, sheetName);
  }

  if (employeeDetail.length > 0) {
    const allEmpRows = employeeDetail.map(r => ({
      "Employee #": r.employeeNumber ?? "",
      "Name": r.employeeName,
      "Unit": r.bargainingUnit,
      "Contract Year": r.contractYear,
      "Year Label": r.yearLabel ?? yearLabel(r.contractYear),
      "Step": r.projectedStep ?? "",
      "Proj. Salary": parseFloat(r.projectedSalary) || 0,
      "Retirement": parseFloat(r.retirementContribution) || 0,
      "FICA": parseFloat(r.ficaCost) || 0,
      "Health Ins.": parseFloat(r.healthInsuranceCost) || 0,
      "Other Benefits": parseFloat(r.otherBenefitsCost) || 0,
      "Total Employer Cost": parseFloat(r.totalEmployerCost) || 0,
    }));
    const allEmpWs = XLSX.utils.json_to_sheet(allEmpRows);
    allEmpWs["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 22 }];
    if (allEmpRows.length > 0) {
      applyCurrencyFmt(allEmpWs, ["G", "H", "I", "J", "K", "L"], 2, allEmpRows.length + 1, INT_CURR);
    }
    XLSX.utils.book_append_sheet(wb, allEmpWs, "All Employees");
  }

  if (detail.schedules && detail.schedules.length > 0) {
    for (const sched of detail.schedules) {
      const header = [`${sched.unitName} — ${sched.scheduleName} (Effective ${sched.effectiveYear})`];
      const laneRow = ["Step / Lane", ...sched.lanes];
      const rows: (string | number)[][] = [header, [], laneRow];
      for (const step of sched.steps) {
        const row: (string | number)[] = [`Step ${step}`];
        for (const lane of sched.lanes) {
          const cell = sched.cells.find(c => c.laneName === lane && c.stepNumber === step);
          row.push(cell ? parseFloat(cell.salaryAmount) : "");
        }
        rows.push(row);
      }
      const schedWs = XLSX.utils.aoa_to_sheet(rows);
      const cols: XLSX.ColInfo[] = [{ wch: 10 }, ...sched.lanes.map(() => ({ wch: 14 }))];
      schedWs["!cols"] = cols;
      if (sched.steps.length > 0 && sched.lanes.length > 0) {
        const alpha = "BCDEFGHIJKLMNOPQRSTUVWXYZ".split("").slice(0, sched.lanes.length);
        applyCurrencyFmt(schedWs, alpha, 4, sched.steps.length + 3, DEC_CURR);
      }
      const sheetName = `${sched.unitName.slice(0, 15)} Schedule`;
      XLSX.utils.book_append_sheet(wb, schedWs, sheetName.replace(/[/\\?*[\]]/g, "_").slice(0, 29));
    }
  }

  const assumRows: (string | number | boolean)[][] = [
    ["SCENARIO ASSUMPTIONS"],
    ["Scenario", detail.scenarioName],
    ["District", detail.districtName ?? ""],
    ["Status", detail.scenarioStatus],
    ["Generated", new Date().toLocaleDateString()],
    [],
    ["Year", "Bargaining Unit", "Increase Type", "Fixed %", "CPI Adder", "CPI Floor", "CPI Cap", "High Earner Threshold", "High Earner Flat Increase", "Step Advancement", "Health Premium Rate"],
  ];
  for (const yc of yearConfigs) {
    assumRows.push([
      yc.yearLabel, yc.bargainingUnit, yc.increaseType,
      yc.fixedPercentage ? parseFloat(yc.fixedPercentage) : "",
      yc.cpiAdder ? parseFloat(yc.cpiAdder) : "",
      yc.cpiFloor ? parseFloat(yc.cpiFloor) : "",
      yc.cpiCap ? parseFloat(yc.cpiCap) : "",
      yc.highEarnerThreshold ? parseFloat(yc.highEarnerThreshold) : "",
      yc.highEarnerFlatIncrease ? parseFloat(yc.highEarnerFlatIncrease) : "",
      yc.stepAdvancement ? "Yes" : "No",
      yc.healthPremiumIncreaseRate ? parseFloat(yc.healthPremiumIncreaseRate) : "",
    ]);
  }
  const assumWs = XLSX.utils.aoa_to_sheet(assumRows);
  assumWs["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, assumWs, "Assumptions");

  const rawBuf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;

  const sheetFreeze: Record<string, FreezeSpec> = { "Summary": { xSplit: 0, ySplit: 8 } };
  for (const u of unitSummaries) {
    const sn = u.unitName.replace(/[/\\?*[\]:]/g, "_").slice(0, 29);
    sheetFreeze[sn] = { xSplit: 2, ySplit: 4 };
  }
  if (employeeDetail.length > 0) sheetFreeze["All Employees"] = { xSplit: 3, ySplit: 1 };
  if (detail.schedules && detail.schedules.length > 0) {
    for (const sched of detail.schedules) {
      const sn = `${sched.unitName.slice(0, 15)} Schedule`.replace(/[/\\?*[\]:]/g, "_").slice(0, 29);
      sheetFreeze[sn] = { xSplit: 1, ySplit: 3 };
    }
  }
  sheetFreeze["Assumptions"] = { xSplit: 0, ySplit: 7 };

  return injectFreezePanes(rawBuf, sheetFreeze);
}
