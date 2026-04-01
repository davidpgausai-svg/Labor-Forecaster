import { useState } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useGetScenario,
  getGetScenarioQueryKey,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  FileDown,
  Loader2,
  CheckCircle2,
  Newspaper,
  BarChart3,
  Table as TableIcon,
  Grid,
  AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BASE_URL = import.meta.env.BASE_URL ?? "/collbar-web/";

async function fetchReportDetail(scenarioId: string) {
  const res = await fetch(`${BASE_URL}api/reports/${scenarioId}/detail`);
  if (!res.ok) throw new Error("Failed to load report data");
  return res.json();
}

async function fetchReportSummary(scenarioId: string) {
  const res = await fetch(`${BASE_URL}api/reports/${scenarioId}`);
  if (!res.ok) throw new Error("Failed to load report summary");
  return res.json();
}

type ReportCard = {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  badge: string;
  outputType: "excel" | "pdf";
};

const REPORT_CARDS: ReportCard[] = [
  {
    id: "board-presentation",
    title: "Board Presentation PDF",
    desc: "Board-ready multi-year cost projection with per-unit breakdown, increase methodology, and 5-year fiscal impact. Formatted for printing.",
    icon: FileText,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "negotiation-summary",
    title: "Negotiation Summary PDF",
    desc: "Bargaining-table PDF with side-by-side scenario configuration, CPI ranges, step parameters, and unit-by-unit breakdown.",
    icon: Newspaper,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "budget-impact",
    title: "Budget Impact Analysis PDF",
    desc: "Year-over-year cost impact with employer cost breakdown by component: payroll, retirement, FICA, health insurance, and other benefits.",
    icon: BarChart3,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "heatmap-pdf",
    title: "Salary Heatmap Report PDF",
    desc: "Print-ready heatmap summary with legend, scenario configuration reference, and bargaining unit cost concentration notes.",
    icon: Grid,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "employee-detail",
    title: "Employee Detail Workbook",
    desc: "Multi-tab Excel: Summary, per-unit cost tabs (payroll + benefits per year), per-employee projection detail, and scenario assumptions.",
    icon: TableIcon,
    badge: "Excel",
    outputType: "excel",
  },
];

function fmt$(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "$0";
  return "$" + Math.round(n).toLocaleString();
}
function fmt$d(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "$0.00";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(v: number | string | null | undefined) {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toFixed(2) + "%";
}

function generateBoardPdf(detail: Record<string, unknown>, districtName: string, scenarioName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PAGE_W = 215.9;
  const MARGIN = 18;
  const COL_W = PAGE_W - MARGIN * 2;
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

  const unitSummaries = (detail.unitSummaries as Record<string, unknown>[]) ?? [];
  const yearSet = (detail.yearSet as number[]) ?? [];
  const yearConfigs = (detail.yearConfigs as Record<string, unknown>[]) ?? [];

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Bargaining Unit Summary", MARGIN, y);
  y += 6;

  const unitHead = [["Bargaining Unit", "Retirement", ...yearSet.map(yr => {
    const yc = yearConfigs.find((c: Record<string, unknown>) => c.contractYear === yr);
    return (yc?.yearLabel as string) ?? `Year ${yr}`;
  }), "Total Cost"]];

  const unitBody = unitSummaries.map((u: Record<string, unknown>) => {
    const years = (u.years as Record<string, unknown>[]) ?? [];
    const total = years.reduce((s, yy) => s + parseFloat((yy.totalEmployerCost as string) ?? "0"), 0);
    return [
      u.unitName as string,
      u.retirementSystem as string,
      ...years.map((yy) => fmt$(yy.totalEmployerCost as string)),
      fmt$(total),
    ];
  });

  const totalCostByYear = yearSet.map(yr =>
    unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.totalEmployerCost as string) ?? "0");
    }, 0)
  );
  const grandTotal = totalCostByYear.reduce((s, v) => s + v, 0);
  unitBody.push(["TOTAL", "", ...totalCostByYear.map(v => fmt$(v)), fmt$(grandTotal)]);

  autoTable(doc, {
    startY: y,
    head: unitHead,
    body: unitBody,
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    columnStyles: { 0: { fontStyle: "bold" } },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: COL_W,
    didParseCell: (data) => {
      if (data.row.index === unitBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [219, 234, 254];
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Year-by-Year Employer Cost Breakdown", MARGIN, y);
  y += 6;

  const breakdownHead = [["Year", "Unit", "Payroll", "Retirement", "FICA", "Health Ins.", "Other", "Total Employer Cost"]];
  const breakdownBody: string[][] = [];
  for (const u of unitSummaries) {
    for (const yy of (u.years as Record<string, unknown>[])) {
      breakdownBody.push([
        (yy.yearLabel as string) ?? `Year ${yy.contractYear}`,
        u.unitName as string,
        fmt$(yy.totalPayroll as string),
        fmt$(yy.totalRetirement as string),
        fmt$(yy.totalFICA as string),
        fmt$(yy.totalHealth as string),
        fmt$(yy.totalOther as string),
        fmt$(yy.totalEmployerCost as string),
      ]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: breakdownHead,
    body: breakdownBody,
    theme: "striped",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: COL_W,
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("Scenario Configuration", MARGIN, y);
  y += 6;

  const configHead = [["Year Label", "Unit", "Increase Type", "Rate / Range", "Step Advancement"]];
  const configBody = yearConfigs.map((yc: Record<string, unknown>) => {
    const typeStr = yc.increaseType === "cpi_formula" ? "CPI Formula"
      : yc.increaseType === "fixed_percentage" ? "Fixed %"
      : yc.increaseType === "flat_dollar" ? "Flat Dollar"
      : String(yc.increaseType ?? "—");
    const rateStr = yc.increaseType === "cpi_formula"
      ? `${fmtPct(yc.cpiFloor as string)} – ${fmtPct(yc.cpiCap as string)} cap`
      : yc.increaseType === "fixed_percentage" ? fmtPct(yc.fixedPercentage as string)
      : yc.increaseType === "flat_dollar" ? fmt$(yc.fixedPercentage as string)
      : "—";
    return [
      (yc.yearLabel as string) ?? `Year ${yc.contractYear}`,
      yc.bargainingUnit as string ?? "—",
      typeStr,
      rateStr,
      yc.stepAdvancement ? "Yes" : "No",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: configHead,
    body: configBody,
    theme: "grid",
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: COL_W,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `CollBar — Collective Bargaining Compensation & Labor Forecasting Platform · ${districtName} · Page ${i} of ${pageCount}`,
      PAGE_W / 2, 274, { align: "center" }
    );
  }

  doc.save(`${districtName.replace(/\s+/g, "_")}_Board_Presentation_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function generateNegotiationPdf(detail: Record<string, unknown>, districtName: string, scenarioName: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PAGE_W = 215.9;
  const MARGIN = 18;
  const COL_W = PAGE_W - MARGIN * 2;
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(districtName, MARGIN, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Collective Bargaining — Negotiation Summary · ${now}`, MARGIN, 19);
  doc.setFontSize(9);
  doc.text(`Scenario: ${scenarioName}`, MARGIN, 25);

  doc.setTextColor(30, 30, 30);
  let y = 38;

  const unitSummaries = (detail.unitSummaries as Record<string, unknown>[]) ?? [];
  const yearConfigs = (detail.yearConfigs as Record<string, unknown>[]) ?? [];

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Proposed Compensation Parameters", MARGIN, y);
  y += 5;

  const byUnit: Record<string, Record<string, unknown>[]> = {};
  for (const yc of yearConfigs) {
    const unit = yc.bargainingUnit as string ?? "Unknown";
    if (!byUnit[unit]) byUnit[unit] = [];
    byUnit[unit].push(yc);
  }

  for (const [unit, configs] of Object.entries(byUnit)) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(unit, MARGIN, y + 2);
    y += 5;

    const head = [["Year", "Type", "Rate/Range", "CPI Floor", "CPI Cap", "High Earner", "Step Adv."]];
    const body = configs.map((yc: Record<string, unknown>) => {
      const typeStr = yc.increaseType === "cpi_formula" ? "CPI Formula"
        : yc.increaseType === "fixed_percentage" ? "Fixed %"
        : yc.increaseType === "flat_dollar" ? "Flat $"
        : String(yc.increaseType ?? "—");
      const rate = yc.increaseType === "fixed_percentage" ? fmtPct(yc.fixedPercentage as string)
        : yc.increaseType === "cpi_formula" ? `CPI+${fmtPct(yc.cpiAdder as string)}`
        : yc.fixedPercentage ? fmt$(yc.fixedPercentage as string) : "—";
      return [
        (yc.yearLabel as string) ?? `Year ${yc.contractYear}`,
        typeStr,
        rate,
        yc.cpiFloor ? fmtPct(yc.cpiFloor as string) : "—",
        yc.cpiCap ? fmtPct(yc.cpiCap as string) : "—",
        yc.highEarnerThreshold ? fmt$(yc.highEarnerThreshold as string) + " threshold" : "—",
        yc.stepAdvancement ? "Yes" : "No",
      ];
    });

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: COL_W,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  doc.text("Projected Employer Costs by Unit", MARGIN, y);
  y += 5;

  const unitHead = [["Bargaining Unit", "Contract Year", "Payroll", "Retirement", "FICA", "Health", "Other", "Total"]];
  const unitBody: string[][] = [];
  for (const u of unitSummaries) {
    for (const yy of (u.years as Record<string, unknown>[])) {
      unitBody.push([
        u.unitName as string,
        (yy.yearLabel as string) ?? `Year ${yy.contractYear}`,
        fmt$(yy.totalPayroll as string),
        fmt$(yy.totalRetirement as string),
        fmt$(yy.totalFICA as string),
        fmt$(yy.totalHealth as string),
        fmt$(yy.totalOther as string),
        fmt$(yy.totalEmployerCost as string),
      ]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: unitHead,
    body: unitBody,
    theme: "striped",
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: COL_W,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `CollBar — Negotiation Summary · ${districtName} · ${scenarioName} · Page ${i} of ${pageCount}`,
      PAGE_W / 2, 274, { align: "center" }
    );
  }

  doc.save(`${districtName.replace(/\s+/g, "_")}_Negotiation_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function generateBudgetImpactPdf(detail: Record<string, unknown>, districtName: string, scenarioName: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const PAGE_W = 279.4;
  const MARGIN = 15;
  const COL_W = PAGE_W - MARGIN * 2;
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(16, 122, 87);
  doc.rect(0, 0, PAGE_W, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(districtName + " — Budget Impact Analysis", MARGIN, 11);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Scenario: ${scenarioName} · Generated ${now}`, MARGIN, 18);

  doc.setTextColor(30, 30, 30);
  let y = 34;

  const unitSummaries = (detail.unitSummaries as Record<string, unknown>[]) ?? [];
  const yearSet = (detail.yearSet as number[]) ?? [];
  const yearConfigs = (detail.yearConfigs as Record<string, unknown>[]) ?? [];

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87);
  doc.text("Year-over-Year Cost Impact by Component", MARGIN, y);
  y += 5;

  const cols = ["Category", ...yearSet.map(yr => {
    const yc = yearConfigs.find((c: Record<string, unknown>) => c.contractYear === yr);
    return (yc?.yearLabel as string) ?? `Year ${yr}`;
  }), "5-Year Total"];

  const costRows: string[][] = [];

  const getTotalForComponent = (component: string) => yearSet.map(yr =>
    unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.[component] as string) ?? "0");
    }, 0)
  );

  const payrollByYear = getTotalForComponent("totalPayroll");
  const retByYear = getTotalForComponent("totalRetirement");
  const ficaByYear = getTotalForComponent("totalFICA");
  const healthByYear = getTotalForComponent("totalHealth");
  const otherByYear = getTotalForComponent("totalOther");
  const totalByYear = getTotalForComponent("totalEmployerCost");

  costRows.push(["Total Payroll", ...payrollByYear.map(fmt$), fmt$(payrollByYear.reduce((s, v) => s + v, 0))]);
  costRows.push(["Retirement (TRS/IMRF)", ...retByYear.map(fmt$), fmt$(retByYear.reduce((s, v) => s + v, 0))]);
  costRows.push(["FICA / Medicare", ...ficaByYear.map(fmt$), fmt$(ficaByYear.reduce((s, v) => s + v, 0))]);
  costRows.push(["Health Insurance", ...healthByYear.map(fmt$), fmt$(healthByYear.reduce((s, v) => s + v, 0))]);
  costRows.push(["Dental / Life / Other", ...otherByYear.map(fmt$), fmt$(otherByYear.reduce((s, v) => s + v, 0))]);
  costRows.push(["TOTAL EMPLOYER COST", ...totalByYear.map(fmt$), fmt$(totalByYear.reduce((s, v) => s + v, 0))]);

  const deltaRows: string[][] = [];
  for (let i = 1; i < totalByYear.length; i++) {
    const delta = totalByYear[i] - totalByYear[i - 1];
    const pct = totalByYear[i - 1] > 0 ? (delta / totalByYear[i - 1]) * 100 : 0;
    deltaRows.push([
      `Δ vs Prior Year`,
      ...yearSet.map((_, idx) => {
        if (idx === 0) return "—";
        const d = totalByYear[idx] - totalByYear[idx - 1];
        const p = totalByYear[idx - 1] > 0 ? (d / totalByYear[idx - 1]) * 100 : 0;
        return idx === i ? `${fmt$(d)} (${p >= 0 ? "+" : ""}${p.toFixed(1)}%)` : "—";
      }),
      `${fmt$(delta)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [cols],
    body: [...costRows],
    theme: "grid",
    headStyles: { fillColor: [16, 122, 87], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: COL_W,
    didParseCell: (data) => {
      if (data.row.index === costRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [209, 250, 229];
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 122, 87);
  doc.text("Per-Unit Cost Breakdown", MARGIN, y);
  y += 5;

  const unitBreakHead = [["Unit", "Year", "Payroll", "Retirement", "FICA", "Health", "Other", "Total", "Emp Count"]];
  const unitBreakBody: string[][] = [];
  for (const u of unitSummaries) {
    for (const yy of (u.years as Record<string, unknown>[])) {
      unitBreakBody.push([
        u.unitName as string,
        (yy.yearLabel as string) ?? `Year ${yy.contractYear}`,
        fmt$(yy.totalPayroll as string),
        fmt$(yy.totalRetirement as string),
        fmt$(yy.totalFICA as string),
        fmt$(yy.totalHealth as string),
        fmt$(yy.totalOther as string),
        fmt$(yy.totalEmployerCost as string),
        String(yy.employeeCount ?? "—"),
      ]);
    }
  }

  autoTable(doc, {
    startY: y,
    head: unitBreakHead,
    body: unitBreakBody,
    theme: "striped",
    headStyles: { fillColor: [16, 122, 87], textColor: 255, fontSize: 7.5, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5 },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: COL_W,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `CollBar — Budget Impact · ${districtName} · ${scenarioName} · Page ${i} of ${pageCount}`,
      PAGE_W / 2, 197, { align: "center" }
    );
  }

  doc.save(`${districtName.replace(/\s+/g, "_")}_Budget_Impact_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function generateHeatmapPdf(districtName: string, scenarioName: string, units: Array<{ name: string; compensationType: string }>) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PAGE_W = 215.9;
  const MARGIN = 18;
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  doc.setFillColor(91, 33, 182);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(districtName + " — Salary Heatmap Report", MARGIN, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Scenario: ${scenarioName} · Generated ${now}`, MARGIN, 21);

  doc.setTextColor(30, 30, 30);
  let y = 38;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 33, 182);
  doc.text("Bargaining Units", MARGIN, y);
  y += 5;

  const unitBody = units.map(u => [u.name, u.compensationType === "salary" ? "Salary (step/lane)" : "Hourly (rate-based)"]);
  autoTable(doc, {
    startY: y,
    head: [["Bargaining Unit", "Compensation Type"]],
    body: unitBody,
    theme: "grid",
    headStyles: { fillColor: [91, 33, 182], textColor: 255, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: 100,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 33, 182);
  doc.text("Color Legend — Step/Lane Density", MARGIN, y);
  y += 5;

  const legendItems = [
    { label: "Empty (0 employees)", rgb: [230, 230, 240] as [number, number, number] },
    { label: "Low (1 employee)", rgb: [219, 234, 254] as [number, number, number] },
    { label: "Medium (2–3 employees)", rgb: [147, 197, 253] as [number, number, number] },
    { label: "High (4–5 employees)", rgb: [59, 130, 246] as [number, number, number] },
    { label: "Very High (6+ employees)", rgb: [29, 78, 216] as [number, number, number] },
  ];
  for (const item of legendItems) {
    doc.setFillColor(...item.rgb);
    doc.rect(MARGIN, y, 10, 5, "F");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(item.label, MARGIN + 13, y + 3.5);
    y += 7;
  }

  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(91, 33, 182);
  doc.text("Bargaining Unit Colors", MARGIN, y);
  y += 5;

  const colorLegend = [
    { label: "Licensed Staff", rgb: [59, 130, 246] as [number, number, number] },
    { label: "ESP", rgb: [139, 92, 246] as [number, number, number] },
    { label: "CM / Custodial", rgb: [245, 158, 11] as [number, number, number] },
  ];
  for (const item of colorLegend) {
    doc.setFillColor(...item.rgb);
    doc.rect(MARGIN, y, 10, 5, "F");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);
    doc.text(item.label, MARGIN + 13, y + 3.5);
    y += 7;
  }

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 22, 2, 2, "F");
  doc.setTextColor(60);
  doc.setFont("helvetica", "bold");
  doc.text("Interactive Heatmap", MARGIN + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "The full interactive heatmap with animated year transitions, drill-down employee lists,",
    MARGIN + 5, y + 11
  );
  doc.text(
    "and cell-level salary data is available in CollBar under the Heatmap section.",
    MARGIN + 5, y + 16
  );
  doc.text("Use 'Export Heatmap PNG' on the Heatmap page to capture the live view for PowerPoint.", MARGIN + 5, y + 21);

  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    `CollBar — Salary Heatmap Report · ${districtName} · ${scenarioName}`,
    PAGE_W / 2, 274, { align: "center" }
  );

  doc.save(`${districtName.replace(/\s+/g, "_")}_Heatmap_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function generateEmployeeDetailExcel(
  detail: Record<string, unknown>,
  employees: { employees?: Array<Record<string, unknown>> } | undefined,
  districtName: string,
  scenarioName: string
) {
  const wb = XLSX.utils.book_new();
  const unitSummaries = (detail.unitSummaries as Record<string, unknown>[]) ?? [];
  const yearSet = (detail.yearSet as number[]) ?? [];
  const yearConfigs = (detail.yearConfigs as Record<string, unknown>[]) ?? [];
  const employeeDetail = (detail.employeeDetail as Record<string, unknown>[]) ?? [];

  const CURRENCY_FMT = '"$"#,##0.00';
  const INT_CURRENCY_FMT = '"$"#,##0';

  function setCurrencyCol(ws: XLSX.WorkSheet, col: string, startRow: number, endRow: number, fmt = CURRENCY_FMT) {
    for (let r = startRow; r <= endRow; r++) {
      const cellRef = `${col}${r}`;
      if (ws[cellRef]) { ws[cellRef].t = "n"; ws[cellRef].z = fmt; }
    }
  }

  const summaryData: (string | number)[][] = [
    ["DISTRICT", districtName],
    ["SCENARIO", scenarioName],
    ["STATUS", (detail.scenarioStatus as string) ?? ""],
    ["GENERATED", new Date().toLocaleDateString()],
    [],
    ["5-YEAR EMPLOYER COST SUMMARY"],
    [],
    ["Year", "Total Payroll", "Retirement", "FICA", "Health Insurance", "Other Benefits", "Total Employer Cost", "Employee Count"],
  ];

  const allYearTotals = yearSet.map(yr => {
    const payroll = unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.totalPayroll as string) ?? "0");
    }, 0);
    const ret = unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.totalRetirement as string) ?? "0");
    }, 0);
    const fica = unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.totalFICA as string) ?? "0");
    }, 0);
    const health = unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.totalHealth as string) ?? "0");
    }, 0);
    const other = unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.totalOther as string) ?? "0");
    }, 0);
    const total = unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + parseFloat((yy?.totalEmployerCost as string) ?? "0");
    }, 0);
    const count = unitSummaries.reduce((s, u) => {
      const yy = ((u.years as Record<string, unknown>[]) ?? []).find((y: Record<string, unknown>) => y.contractYear === yr);
      return s + ((yy?.employeeCount as number) ?? 0);
    }, 0);
    const yc = yearConfigs.find((c: Record<string, unknown>) => c.contractYear === yr);
    return { yearLabel: (yc?.yearLabel as string) ?? `Year ${yr}`, payroll, ret, fica, health, other, total, count };
  });

  for (const yt of allYearTotals) {
    summaryData.push([yt.yearLabel, yt.payroll, yt.ret, yt.fica, yt.health, yt.other, yt.total, yt.count]);
  }
  const grandPayroll = allYearTotals.reduce((s, v) => s + v.payroll, 0);
  const grandRet = allYearTotals.reduce((s, v) => s + v.ret, 0);
  const grandFica = allYearTotals.reduce((s, v) => s + v.fica, 0);
  const grandHealth = allYearTotals.reduce((s, v) => s + v.health, 0);
  const grandOther = allYearTotals.reduce((s, v) => s + v.other, 0);
  const grandTotal = allYearTotals.reduce((s, v) => s + v.total, 0);
  summaryData.push(["5-YEAR TOTAL", grandPayroll, grandRet, grandFica, grandHealth, grandOther, grandTotal, ""]);

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 14 }];
  const summaryDataStart = 9;
  for (let r = summaryDataStart; r < summaryDataStart + allYearTotals.length + 1; r++) {
    ["B", "C", "D", "E", "F", "G"].forEach(col => setCurrencyCol(summaryWs, col, r, r, INT_CURRENCY_FMT));
  }
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  for (const u of unitSummaries) {
    const unitName = (u.unitName as string).slice(0, 29);
    const unitData: (string | number)[][] = [
      [u.unitName as string, "Retirement:", u.retirementSystem as string],
      [],
      ["Contract Year", "Payroll", "Retirement", "FICA", "Health Insurance", "Other Benefits", "Total Employer Cost", "Employees"],
    ];
    for (const yy of (u.years as Record<string, unknown>[])) {
      unitData.push([
        (yy.yearLabel as string) ?? `Year ${yy.contractYear}`,
        parseFloat((yy.totalPayroll as string) ?? "0"),
        parseFloat((yy.totalRetirement as string) ?? "0"),
        parseFloat((yy.totalFICA as string) ?? "0"),
        parseFloat((yy.totalHealth as string) ?? "0"),
        parseFloat((yy.totalOther as string) ?? "0"),
        parseFloat((yy.totalEmployerCost as string) ?? "0"),
        (yy.employeeCount as number) ?? 0,
      ]);
    }
    const unitWs = XLSX.utils.aoa_to_sheet(unitData);
    unitWs["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 10 }];
    const uDataStart = 4;
    const uDataEnd = uDataStart + (u.years as Record<string, unknown>[]).length - 1;
    ["B", "C", "D", "E", "F", "G"].forEach(col => setCurrencyCol(unitWs, col, uDataStart, uDataEnd, INT_CURRENCY_FMT));
    XLSX.utils.book_append_sheet(wb, unitWs, unitName);
  }

  if (employeeDetail.length > 0) {
    const empRows = employeeDetail.map((r) => ({
      "Employee #": r.employeeNumber ?? "",
      "Name": r.employeeName,
      "Unit": r.bargainingUnit,
      "Contract Year": r.contractYear,
      "Projected Step": r.projectedStep ?? "",
      "Projected Salary ($)": parseFloat(r.projectedSalary as string) || 0,
      "Retirement ($)": parseFloat(r.retirementContribution as string) || 0,
      "FICA ($)": parseFloat(r.ficaCost as string) || 0,
      "Health Ins. ($)": parseFloat(r.healthInsuranceCost as string) || 0,
      "Other Benefits ($)": parseFloat(r.otherBenefitsCost as string) || 0,
      "Total Employer Cost ($)": parseFloat(r.totalEmployerCost as string) || 0,
    }));
    const empWs = XLSX.utils.json_to_sheet(empRows);
    empWs["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 }];
    if (empRows.length > 0) {
      ["F", "G", "H", "I", "J", "K"].forEach(col => setCurrencyCol(empWs, col, 2, empRows.length + 1, INT_CURRENCY_FMT));
    }
    XLSX.utils.book_append_sheet(wb, empWs, "Employee Detail");
  } else if (employees?.employees && employees.employees.length > 0) {
    const empRows = employees.employees.map((emp) => ({
      "Employee #": emp.employeeNumber ?? "",
      "Last Name": emp.lastName,
      "First Name": emp.firstName,
      "Bargaining Unit": emp.bargainingUnitName ?? "",
      "Step": emp.currentStep ?? "",
      "Lane": emp.laneName ?? "",
      "Annual Salary ($)": parseFloat(emp.currentAnnualSalary as string) || 0,
      "Insurance": emp.insuranceElection ?? "",
      "Ret. Eligible": emp.retirementEligible ? "Yes" : "No",
      "Status": emp.status,
    }));
    const empWs = XLSX.utils.json_to_sheet(empRows);
    empWs["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 10 }];
    setCurrencyCol(empWs, "G", 2, empRows.length + 1, INT_CURRENCY_FMT);
    XLSX.utils.book_append_sheet(wb, empWs, "Employees (Roster)");
  }

  const assumptionsData: (string | number | boolean)[][] = [
    ["SCENARIO ASSUMPTIONS"],
    ["Scenario", scenarioName],
    ["District", districtName],
    ["Status", (detail.scenarioStatus as string) ?? ""],
    ["Generated", new Date().toLocaleDateString()],
    [],
    ["Year Label", "Bargaining Unit", "Increase Type", "Fixed %", "CPI Value", "CPI Adder", "CPI Floor", "CPI Cap", "High Earner Threshold", "Step Advancement", "Health Premium Rate"],
  ];
  for (const yc of yearConfigs) {
    assumptionsData.push([
      (yc.yearLabel as string) ?? "",
      (yc.bargainingUnit as string) ?? "",
      (yc.increaseType as string) ?? "",
      yc.fixedPercentage ? parseFloat(yc.fixedPercentage as string) : "",
      yc.cpiValue ? parseFloat(yc.cpiValue as string) : "",
      yc.cpiAdder ? parseFloat(yc.cpiAdder as string) : "",
      yc.cpiFloor ? parseFloat(yc.cpiFloor as string) : "",
      yc.cpiCap ? parseFloat(yc.cpiCap as string) : "",
      yc.highEarnerThreshold ? parseFloat(yc.highEarnerThreshold as string) : "",
      yc.stepAdvancement ? "Yes" : "No",
      yc.healthPremiumIncreaseRate ? parseFloat(yc.healthPremiumIncreaseRate as string) : "",
    ]);
  }
  const assumptionsWs = XLSX.utils.aoa_to_sheet(assumptionsData);
  assumptionsWs["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, assumptionsWs, "Assumptions");

  const safeScenario = (detail.scenarioName as string ?? scenarioName).replace(/[/\\?*[\]]/g, "_").slice(0, 20);
  XLSX.writeFile(wb, `${districtName.replace(/\s+/g, "_")}_${safeScenario}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function Reports() {
  const { districtId, scenarioId, districtName } = useDistrictContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: employees } = useListEmployees(
    { districtId: districtId!, pageSize: 500 },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListEmployeesQueryKey({ districtId: districtId!, pageSize: 500 }),
      },
    }
  );

  const { data: scenario } = useGetScenario(scenarioId!, {
    query: { enabled: !!scenarioId, queryKey: getGetScenarioQueryKey(scenarioId!) },
  });

  const { data: units } = useListBargainingUnits(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }),
      },
    }
  );

  const distName = districtName ?? "District";
  const scenarioName = scenario?.name ?? "Active Scenario";

  const handleGenerate = async (id: string) => {
    if (!scenarioId) {
      toast({ title: "No scenario selected", description: "Select a scenario first.", variant: "destructive" });
      return;
    }
    setLoading(id);
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      switch (id) {
        case "board-presentation": {
          const detail = await fetchReportDetail(scenarioId);
          generateBoardPdf(detail, distName, scenarioName);
          break;
        }
        case "negotiation-summary": {
          const detail = await fetchReportDetail(scenarioId);
          generateNegotiationPdf(detail, distName, scenarioName);
          break;
        }
        case "budget-impact": {
          const detail = await fetchReportDetail(scenarioId);
          generateBudgetImpactPdf(detail, distName, scenarioName);
          break;
        }
        case "heatmap-pdf": {
          generateHeatmapPdf(distName, scenarioName, units ?? []);
          break;
        }
        case "employee-detail": {
          let detail: Record<string, unknown> = { unitSummaries: [], yearSet: [], yearConfigs: [], employeeDetail: [] };
          try { detail = await fetchReportDetail(scenarioId); } catch { }
          generateEmployeeDetailExcel(detail, employees as { employees?: Array<Record<string, unknown>> } | undefined, distName, scenarioName);
          break;
        }
      }
      setGenerated((prev) => new Set(prev).add(id));
      const isPdf = REPORT_CARDS.find(c => c.id === id)?.outputType === "pdf";
      toast({
        title: isPdf ? "PDF downloaded" : "Excel downloaded",
        description: isPdf ? "Your PDF has been saved." : "Your Excel workbook has been saved.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed. Try again.";
      setErrors(prev => ({ ...prev, [id]: msg }));
      toast({
        title: "Export failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Generate board-ready PDFs and analytical Excel workbooks for collective bargaining.
        </p>
      </div>

      {scenario && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border border-border rounded-lg text-sm">
          <span className="text-muted-foreground">Active Scenario:</span>
          <span className="font-semibold text-foreground">{scenario.name}</span>
          <Badge variant="outline" className="ml-1 text-xs">{scenario.status}</Badge>
          {districtName && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground text-xs">{districtName}</span>
            </>
          )}
        </div>
      )}

      {!scenarioId && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Select a scenario from the header to enable report generation.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_CARDS.map((card) => {
          const isDone = generated.has(card.id);
          const isLoading = loading === card.id;
          const isPdf = card.outputType === "pdf";
          const err = errors[card.id];

          return (
            <Card
              key={card.id}
              className="bg-card border-border hover:border-primary/40 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <card.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    {card.title}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      isPdf
                        ? "text-rose-400 border-rose-500/30 bg-rose-500/10 text-xs"
                        : "text-green-400 border-green-500/30 bg-green-500/10 text-xs"
                    }
                  >
                    {card.badge}
                  </Badge>
                </div>
                <CardDescription className="text-sm">{card.desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {err && (
                  <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {err.includes("No calculated") ? "Run Scenario Calculate first to get year-by-year data." : err}
                  </div>
                )}
                <Button
                  onClick={() => handleGenerate(card.id)}
                  variant={isDone ? "secondary" : "outline"}
                  className="w-full border-border gap-2"
                  disabled={isLoading || !scenarioId}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                    </>
                  ) : isDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      {isPdf ? "Download Again" : "Download Again"}
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      {isPdf ? "Download PDF" : "Download Excel"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
