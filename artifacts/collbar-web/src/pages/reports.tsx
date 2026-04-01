import { useState } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useGetScenario, getGetScenarioQueryKey } from "@workspace/api-client-react";
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

const BASE_URL = import.meta.env.BASE_URL ?? "/collbar-web/";

async function downloadFromServer(url: string, method: "GET" | "POST" = "GET", body?: Record<string, unknown>): Promise<string> {
  const opts: RequestInit = { method };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `Server error ${res.status}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "download";
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
  return filename;
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
    desc: "Board-ready multi-year cost projection with per-unit breakdown, YoY delta columns, cost components, and scenario configuration. Formatted for printing.",
    icon: FileText,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "negotiation-summary",
    title: "Negotiation Summary PDF",
    desc: "Bargaining-table PDF with per-unit CPI parameters, step advancement, high-earner thresholds, and unit cost breakdown with 5-year totals.",
    icon: Newspaper,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "budget-impact",
    title: "Budget Impact Analysis PDF",
    desc: "Landscape layout with year-over-year cost impact by component (payroll, retirement, FICA, health), delta/% change rows, and per-unit breakdown.",
    icon: BarChart3,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "heatmap-pdf",
    title: "Salary Heatmap Report PDF",
    desc: "Unit overview, color density legend, bargaining unit color key, and a reference note for the interactive heatmap. For heatmap snapshots, use the Export button on the Heatmap page.",
    icon: Grid,
    badge: "PDF",
    outputType: "pdf",
  },
  {
    id: "employee-detail",
    title: "Employee Detail Workbook",
    desc: "Multi-tab Excel: Summary, per-unit employee-by-year cost tabs (every employee × every year), All Employees tab, salary schedule step×lane matrix tabs, and Assumptions tab.",
    icon: TableIcon,
    badge: "Excel",
    outputType: "excel",
  },
];

export default function Reports() {
  const { scenarioId, districtName } = useDistrictContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: scenario } = useGetScenario(scenarioId!, {
    query: { enabled: !!scenarioId, queryKey: getGetScenarioQueryKey(scenarioId!) },
  });

  const handleGenerate = async (id: string) => {
    if (!scenarioId) {
      toast({ title: "No scenario selected", description: "Select a scenario first.", variant: "destructive" });
      return;
    }
    setLoading(id);
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
    try {
      let filename = "";
      switch (id) {
        case "board-presentation":
          filename = await downloadFromServer(`${BASE_URL}api/reports/${scenarioId}/download/board-pdf`);
          break;
        case "negotiation-summary":
          filename = await downloadFromServer(`${BASE_URL}api/reports/${scenarioId}/download/negotiation-pdf`);
          break;
        case "budget-impact":
          filename = await downloadFromServer(`${BASE_URL}api/reports/${scenarioId}/download/budget-pdf`);
          break;
        case "heatmap-pdf":
          filename = await downloadFromServer(`${BASE_URL}api/reports/${scenarioId}/download/heatmap-pdf`, "POST", {});
          break;
        case "employee-detail":
          filename = await downloadFromServer(`${BASE_URL}api/reports/${scenarioId}/download/employee-excel`);
          break;
      }
      setGenerated((prev) => new Set(prev).add(id));
      const isPdf = REPORT_CARDS.find(c => c.id === id)?.outputType === "pdf";
      toast({
        title: isPdf ? "PDF downloaded" : "Excel downloaded",
        description: filename ? `Saved as: ${filename}` : (isPdf ? "PDF saved to your downloads." : "Excel workbook saved."),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed. Try again.";
      setErrors(prev => ({ ...prev, [id]: msg }));
      toast({ title: "Export failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Generate board-ready PDFs and analytical Excel workbooks for collective bargaining. All files are generated server-side with calculated data.
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
            <Card key={card.id} className="bg-card border-border hover:border-primary/40 transition-colors">
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
                    {err.includes("No calculated") ? "Run 'Calculate' on this scenario first to get year-by-year data." : err}
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
                      <CheckCircle2 className="w-4 h-4 text-green-400" /> Download Again
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

      <div className="px-4 py-3 bg-blue-500/5 border border-blue-500/15 rounded-lg text-xs text-blue-300/80">
        <strong className="font-semibold">Tip:</strong> To capture the live heatmap as a PNG or PDF with your current year/unit selection, go to the <span className="font-semibold">Heatmap</span> page and use the Export dropdown. The Salary Heatmap Report PDF above includes the unit overview and legend.
      </div>
    </div>
  );
}
