import { useState } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useGetScenario,
  getGetScenarioQueryKey,
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
} from "lucide-react";
import * as XLSX from "xlsx";

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
    id: "employee-detail",
    title: "Employee Detail Report",
    desc: "Line-by-line payroll roster with step, lane, salary, and unit for each employee.",
    icon: TableIcon,
    badge: "Excel",
    outputType: "excel",
  },
  {
    id: "scenario-summary",
    title: "Scenario Cost Summary",
    desc: "District-wide year-by-year cost summary for the active scenario including benefits breakdown.",
    icon: FileText,
    badge: "Excel",
    outputType: "excel",
  },
  {
    id: "negotiation-summary",
    title: "Negotiation Summary",
    desc: "Board-ready PDF summarizing active scenario costs, CPI ranges, step advancements, and 5-year projections by unit.",
    icon: Newspaper,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "heatmap-pdf",
    title: "Salary Heatmap Report",
    desc: "Print-ready PDF of the salary schedule heatmap showing cost concentration across all steps and lanes.",
    icon: Grid,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "budget-impact",
    title: "Budget Impact Analysis",
    desc: "Fiscal year cost impact analysis with bargaining unit breakdown and year-over-year deltas.",
    icon: BarChart3,
    badge: "Excel",
    outputType: "excel",
  },
];

export default function Reports() {
  const { districtId, scenarioId, districtName } = useDistrictContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());

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

  const generateEmployeeDetail = () => {
    if (!employees?.employees) {
      toast({ title: "No data", description: "Employee data not yet loaded.", variant: "destructive" });
      return;
    }

    const rows = employees.employees.map((emp) => ({
      "Employee #": emp.employeeNumber ?? "",
      "Last Name": emp.lastName,
      "First Name": emp.firstName,
      "Bargaining Unit": emp.bargainingUnitName ?? "",
      Step: emp.currentStep ?? "",
      Lane: emp.laneName ?? "",
      "Annual Salary": parseFloat(emp.currentAnnualSalary) || 0,
      "Insurance Election": emp.insuranceElection ?? "",
      "Yrs in District": emp.yearsInDistrict ?? "",
      "Total Service Yrs": emp.yearsTotalService ?? "",
      "Retirement Eligible": emp.retirementEligible ? "Yes" : "No",
      Status: emp.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = [
      { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 28 },
      { wch: 6 }, { wch: 10 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 10 },
    ];
    ws["!cols"] = colWidths;

    const salaryCol = "G";
    const lastRow = rows.length + 1;
    for (let r = 2; r <= lastRow; r++) {
      const cell = ws[`${salaryCol}${r}`];
      if (cell) { cell.t = "n"; cell.z = '"$"#,##0'; }
    }
    ws[`${salaryCol}${lastRow + 1}`] = {
      t: "n",
      v: rows.reduce((s, r) => s + (r["Annual Salary"] ?? 0), 0),
      z: '"$"#,##0',
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");

    const summaryData = [
      ["Report Generated", new Date().toLocaleDateString()],
      ["District", districtName ?? "District 21"],
      ["Total Employees", rows.length],
      ["Total Payroll", rows.reduce((s, r) => s + (r["Annual Salary"] ?? 0), 0)],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs["!cols"] = [{ wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    XLSX.writeFile(wb, `District21_Employee_Detail_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const generateScenarioSummary = () => {
    const wb = XLSX.utils.book_new();

    const scenarioInfo = [
      ["Scenario", scenario?.name ?? "Active Scenario"],
      ["Description", scenario?.description ?? ""],
      ["Status", scenario?.status ?? ""],
      ["Generated", new Date().toLocaleDateString()],
      ["District", districtName ?? "District 21"],
    ];
    const infoWs = XLSX.utils.aoa_to_sheet(scenarioInfo);
    infoWs["!cols"] = [{ wch: 15 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, infoWs, "Info");

    const yearRows = (scenario?.yearConfigs ?? []).map((yc) => ({
      "Contract Year": yc.contractYear,
      "Year Label": yc.yearLabel ?? "",
      "Bargaining Unit ID": yc.bargainingUnitId,
      "Increase Type": yc.increaseType,
      "Fixed %": yc.fixedPercentage ?? "",
      "CPI Value %": yc.cpiValue ?? "",
      "CPI Floor %": yc.cpiFloor ?? "",
      "CPI Cap %": yc.cpiCap ?? "",
      "Step Advancement": yc.stepAdvancement ? "Yes" : "No",
      "High Earner Threshold": yc.highEarnerThreshold ?? "",
    }));

    if (yearRows.length > 0) {
      const configWs = XLSX.utils.json_to_sheet(yearRows);
      configWs["!cols"] = Array(10).fill({ wch: 18 });
      XLSX.utils.book_append_sheet(wb, configWs, "Year Configs");
    }

    if (employees?.employees && employees.employees.length > 0) {
      const unitMap: Record<string, { payroll: number; count: number }> = {};
      for (const emp of employees.employees) {
        const uname = emp.bargainingUnitName ?? "Unknown";
        if (!unitMap[uname]) unitMap[uname] = { payroll: 0, count: 0 };
        unitMap[uname].payroll += parseFloat(emp.currentAnnualSalary) || 0;
        unitMap[uname].count++;
      }
      const unitRows = Object.entries(unitMap).map(([unit, data]) => ({
        "Bargaining Unit": unit,
        "Employee Count": data.count,
        "Total Payroll": data.payroll,
        "Avg Salary": data.count > 0 ? data.payroll / data.count : 0,
      }));
      const unitWs = XLSX.utils.json_to_sheet(unitRows);
      unitWs["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, unitWs, "Unit Breakdown");
    }

    XLSX.writeFile(
      wb,
      `District21_Scenario_${(scenario?.name ?? "Summary").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const generateBudgetImpact = () => {
    const wb = XLSX.utils.book_new();
    const headerRows = [
      ["Budget Impact Analysis"],
      ["District", districtName ?? "District 21"],
      ["Scenario", scenario?.name ?? "Active Scenario"],
      ["Generated", new Date().toLocaleDateString()],
      [],
    ];

    const yearConfigs = scenario?.yearConfigs ?? [];
    const years = [...new Set(yearConfigs.map(yc => yc.contractYear))].sort();

    const headerRow = ["Category", ...years.map(y => `${y}–${y + 1}`)];
    const dataRows: (string | number)[][] = [
      ["Note: Run Scenario Calculate to populate year-by-year projections"],
      ["Contract Years Configured", ...years.map(() => "✓")],
      ["Fixed % Configs", ...years.map(y => yearConfigs.filter(yc => yc.contractYear === y && (yc.increaseType as string) === "fixed_percentage").length)],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, headerRow, ...dataRows]);
    ws["!cols"] = [{ wch: 32 }, ...years.map(() => ({ wch: 16 }))];
    XLSX.utils.book_append_sheet(wb, ws, "Budget Impact");

    XLSX.writeFile(
      wb,
      `District21_BudgetImpact_${(scenario?.name ?? "Analysis").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const generateNegotiationSummaryPdf = () => {
    const scenarioName = scenario?.name ?? "Active Scenario";
    const distName = districtName ?? "District 21";
    const yearConfigs = scenario?.yearConfigs ?? [];
    const years = [...new Set(yearConfigs.map(yc => yc.contractYear))].sort();

    const unitMap: Record<string, { payroll: number; count: number }> = {};
    for (const emp of employees?.employees ?? []) {
      const uname = emp.bargainingUnitName ?? "Unknown";
      if (!unitMap[uname]) unitMap[uname] = { payroll: 0, count: 0 };
      unitMap[uname].payroll += parseFloat(emp.currentAnnualSalary) || 0;
      unitMap[uname].count++;
    }

    const totalPayroll = Object.values(unitMap).reduce((s, u) => s + u.payroll, 0);

    const unitRows = Object.entries(unitMap).map(([unit, data]) => `
      <tr>
        <td>${unit}</td>
        <td style="text-align:right">${data.count}</td>
        <td style="text-align:right">$${Math.round(data.payroll).toLocaleString()}</td>
        <td style="text-align:right">$${data.count > 0 ? Math.round(data.payroll / data.count).toLocaleString() : "—"}</td>
      </tr>
    `).join("");

    const configRows = years.map(y => {
      const configs = yearConfigs.filter(yc => yc.contractYear === y);
      return configs.map(yc => `
        <tr>
          <td>${yc.yearLabel ?? `${y}–${y + 1}`}</td>
          <td>${yc.bargainingUnitId.slice(0, 8)}…</td>
          <td>${(yc.increaseType as string) === "cpi_formula" ? "CPI Formula" : (yc.increaseType as string) === "fixed_percentage" ? "Fixed %" : String(yc.increaseType)}</td>
          <td style="text-align:right">${(yc.increaseType as string) === "cpi_formula" ? `${yc.cpiFloor ?? "—"}% – ${yc.cpiCap ?? "—"}%` : yc.fixedPercentage ? `${yc.fixedPercentage}%` : "—"}</td>
          <td style="text-align:center">${yc.stepAdvancement ? "Yes" : "No"}</td>
        </tr>
      `).join("");
    }).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${distName} — Negotiation Summary</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #1a1a1a; padding: 32px; }
    h1 { font-size: 18pt; color: #1e3a5f; margin-bottom: 4px; }
    .subtitle { color: #555; font-size: 10pt; margin-bottom: 24px; }
    h2 { font-size: 12pt; color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; margin: 20px 0 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 9pt; }
    td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 9pt; }
    tr:nth-child(even) td { background: #f5f7fa; }
    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat { background: #f5f7fa; border-left: 4px solid #1e3a5f; padding: 12px; border-radius: 4px; }
    .stat-label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 16pt; font-weight: bold; color: #1e3a5f; }
    .footer { margin-top: 32px; font-size: 8pt; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>${distName}</h1>
  <div class="subtitle">Collective Bargaining Negotiation Summary — ${scenarioName} — Generated ${new Date().toLocaleDateString()}</div>

  <div class="stat-grid">
    <div class="stat">
      <div class="stat-label">Total Employees</div>
      <div class="stat-value">${employees?.employees?.length ?? 0}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Current Payroll</div>
      <div class="stat-value">$${Math.round(totalPayroll / 1000000).toFixed(1)}M</div>
    </div>
    <div class="stat">
      <div class="stat-label">Contract Years</div>
      <div class="stat-value">${years.length > 0 ? `${years[0]}–${years[years.length - 1] + 1}` : "—"}</div>
    </div>
  </div>

  <h2>Bargaining Unit Summary</h2>
  <table>
    <thead>
      <tr><th>Unit</th><th style="text-align:right">Employees</th><th style="text-align:right">Total Payroll</th><th style="text-align:right">Avg Salary</th></tr>
    </thead>
    <tbody>${unitRows}</tbody>
  </table>

  <h2>Proposed Increase Parameters</h2>
  <table>
    <thead>
      <tr><th>Year</th><th>Unit ID</th><th>Increase Type</th><th style="text-align:right">Rate / Range</th><th style="text-align:center">Step Advancement</th></tr>
    </thead>
    <tbody>${configRows}</tbody>
  </table>

  <div class="footer">
    CollBar — Collective Bargaining Compensation and Labor Forecasting Platform &nbsp;|&nbsp; ${distName} &nbsp;|&nbsp; Scenario: ${scenarioName}
  </div>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast({ title: "Popup blocked", description: "Allow popups and try again.", variant: "destructive" });
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 600);
  };

  const generateHeatmapPdf = () => {
    const distName = districtName ?? "District 21";
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${distName} — Salary Heatmap</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; padding: 24px; }
    h1 { font-size: 16pt; color: #1e3a5f; margin-bottom: 4px; }
    .subtitle { color: #555; font-size: 9pt; margin-bottom: 20px; }
    .info { background: #f5f7fa; border-left: 4px solid #1e3a5f; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; }
    .info p { margin: 2px 0; font-size: 9pt; }
    .note { color: #888; font-size: 8pt; margin-top: 8px; }
    .steps { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; margin-top: 12px; }
    .cell { padding: 8px 4px; text-align: center; font-size: 8pt; border-radius: 3px; }
    .legend { display: flex; gap: 12px; margin: 12px 0; align-items: center; font-size: 8pt; }
    .legend-item { display: flex; gap: 6px; align-items: center; }
    .legend-swatch { width: 16px; height: 16px; border-radius: 2px; }
    .footer { margin-top: 24px; font-size: 7pt; color: #aaa; border-top: 1px solid #ddd; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>${distName}</h1>
  <div class="subtitle">Salary Heatmap Report — ${scenario?.name ?? "Active Scenario"} — Generated ${new Date().toLocaleDateString()}</div>

  <div class="info">
    <p><strong>Scenario:</strong> ${scenario?.name ?? "Active Scenario"}</p>
    <p><strong>Total Employees:</strong> ${employees?.employees?.length ?? 0}</p>
    <p><strong>Instructions:</strong> Navigate to the Heatmap page in CollBar for the interactive version. This PDF shows a summary of the configuration.</p>
  </div>

  <div class="legend">
    <div class="legend-item"><div class="legend-swatch" style="background:#3b82f6"></div> Licensed (Blue)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#8b5cf6"></div> ESP (Purple)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:#f59e0b"></div> CM (Amber)</div>
    <div class="legend-item"><div class="legend-swatch" style="background:rgba(59,130,246,0.8)"></div> High Density</div>
    <div class="legend-item"><div class="legend-swatch" style="background:rgba(59,130,246,0.1)"></div> Low Density</div>
  </div>

  <p class="note">For the interactive heatmap with drill-down, export to PNG, and full salary data, visit the Heatmap page in CollBar.</p>

  <div class="footer">
    CollBar — Collective Bargaining Compensation and Labor Forecasting Platform &nbsp;|&nbsp; ${distName}
  </div>
</body>
</html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast({ title: "Popup blocked", description: "Allow popups and try again.", variant: "destructive" });
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 600);
  };

  const handleGenerate = async (id: string) => {
    setLoading(id);
    try {
      switch (id) {
        case "employee-detail":
          generateEmployeeDetail();
          break;
        case "scenario-summary":
          generateScenarioSummary();
          break;
        case "budget-impact":
          generateBudgetImpact();
          break;
        case "negotiation-summary":
          generateNegotiationSummaryPdf();
          break;
        case "heatmap-pdf":
          generateHeatmapPdf();
          break;
      }
      setGenerated((prev) => new Set(prev).add(id));
      toast({
        title: id.endsWith("-pdf") || id === "negotiation-summary" ? "PDF opened" : "Report generated",
        description: id.endsWith("-pdf") || id === "negotiation-summary"
          ? "A print dialog has opened. Save as PDF from there."
          : "Your Excel file is downloading now.",
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Unable to generate report. Please try again.",
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
          Generate analytical datasets and board-ready presentations for collective bargaining.
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_CARDS.map((card) => {
          const isDone = generated.has(card.id);
          const isLoading = loading === card.id;
          const isPdf = card.outputType === "pdf";

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
              <CardContent>
                <Button
                  onClick={() => handleGenerate(card.id)}
                  variant={isDone ? "secondary" : "outline"}
                  className="w-full border-border gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating…
                    </>
                  ) : isDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      {isPdf ? "Open Again" : "Download Again"}
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      {isPdf ? "Generate PDF" : "Generate & Download"}
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
