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
  Presentation,
  Table as TableIcon,
  FileText,
  FileDown,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import * as XLSX from "xlsx";

type ReportCard = {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  badge?: string;
};

const REPORT_CARDS: ReportCard[] = [
  {
    id: "employee-detail",
    title: "Employee Detail Report",
    desc: "Line-by-line payroll roster with step, lane, salary, and unit for each employee.",
    icon: TableIcon,
    badge: "Excel",
  },
  {
    id: "scenario-summary",
    title: "Scenario Summary",
    desc: "District-wide year-by-year cost summary for the active scenario.",
    icon: FileText,
    badge: "Excel",
  },
  {
    id: "board-presentation",
    title: "Board Presentation",
    desc: "High-level summary of current payroll and 5-year projection suitable for board review.",
    icon: Presentation,
    badge: "Coming Soon",
  },
  {
    id: "budget-impact",
    title: "Budget Impact Analysis",
    desc: "Fiscal year cost impact for the district budget with unit breakdown.",
    icon: FileDown,
    badge: "Coming Soon",
  },
];

export default function Reports() {
  const { districtId, scenarioId } = useDistrictContext();
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
      { wch: 12 },
      { wch: 18 },
      { wch: 16 },
      { wch: 28 },
      { wch: 6 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 10 },
    ];
    ws["!cols"] = colWidths;

    const salaryCol = "G";
    const lastRow = rows.length + 1;
    for (let r = 2; r <= lastRow; r++) {
      const cell = ws[`${salaryCol}${r}`];
      if (cell) {
        cell.t = "n";
        cell.z = '"$"#,##0';
      }
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
      ["District", "District 21"],
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

    XLSX.writeFile(
      wb,
      `District21_Scenario_${(scenario?.name ?? "Summary").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleGenerate = async (id: string) => {
    if (id === "board-presentation" || id === "budget-impact") {
      toast({
        title: "Coming Soon",
        description: "PDF generation will be available in a future release.",
      });
      return;
    }

    setLoading(id);
    try {
      if (id === "employee-detail") generateEmployeeDetail();
      else if (id === "scenario-summary") generateScenarioSummary();

      setGenerated((prev) => new Set(prev).add(id));
      toast({
        title: "Report generated",
        description: "Your Excel file is downloading now.",
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
          Generate analytical datasets and board-ready presentations.
        </p>
      </div>

      {scenario && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border border-border rounded-lg text-sm">
          <span className="text-muted-foreground">Active Scenario:</span>
          <span className="font-semibold text-foreground">{scenario.name}</span>
          <Badge variant="outline" className="ml-1 text-xs">{scenario.status}</Badge>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_CARDS.map((card) => {
          const isComingSoon = card.badge === "Coming Soon";
          const isDone = generated.has(card.id);
          const isLoading = loading === card.id;
          return (
            <Card
              key={card.id}
              className={`bg-card border-border transition-colors ${!isComingSoon ? "hover:border-primary/40" : "opacity-70"}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <card.icon className="w-4 h-4 text-primary flex-shrink-0" />
                    {card.title}
                  </CardTitle>
                  {card.badge && (
                    <Badge
                      variant="outline"
                      className={
                        isComingSoon
                          ? "text-muted-foreground border-muted text-xs"
                          : "text-green-400 border-green-500/30 bg-green-500/10 text-xs"
                      }
                    >
                      {card.badge}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-sm">{card.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleGenerate(card.id)}
                  variant={isComingSoon ? "ghost" : isDone ? "secondary" : "outline"}
                  className="w-full border-border gap-2"
                  disabled={isLoading || isComingSoon}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                    </>
                  ) : isDone ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" /> Generated — Download Again
                    </>
                  ) : isComingSoon ? (
                    "Coming Soon"
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" /> Generate & Download
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
