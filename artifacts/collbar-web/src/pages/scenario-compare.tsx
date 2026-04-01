import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListScenarios,
  getListScenariosQueryKey,
  useCompareScenarios,
  getCompareScenariosQueryKey,
  ScenarioCalculationResult,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusBadgeClass } from "@/lib/badges";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

const COMPARE_COLORS = ["hsl(217,91%,60%)", "hsl(258,90%,66%)", "hsl(38,92%,50%)"];

export default function ScenarioCompare() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: scenarios, isLoading: scenariosLoading } = useListScenarios(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListScenariosQueryKey({ districtId: districtId! }) } }
  );

  const canCompare = selected.length >= 2;

  const { data: comparison, isLoading: comparing } = useCompareScenarios(
    { ids: selected.join(","), districtId: districtId! },
    { query: { enabled: canCompare && !!districtId, queryKey: getCompareScenariosQueryKey({ ids: selected.join(","), districtId: districtId! }) } }
  );

  const toggleScenario = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  if (scenariosLoading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/scenarios")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compare Scenarios</h1>
          <p className="text-muted-foreground text-sm">Select 2–3 scenarios to compare their 5-year cost projections.</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Select Scenarios</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {scenarios?.map(sc => (
            <label key={sc.id} className="flex items-center gap-4 py-3 cursor-pointer hover:bg-muted/20 px-2 rounded transition-colors">
              <Checkbox
                checked={selected.includes(sc.id)}
                onCheckedChange={() => toggleScenario(sc.id)}
                disabled={!selected.includes(sc.id) && selected.length >= 3}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{sc.name}</div>
                {sc.description && (
                  <div className="text-xs text-muted-foreground truncate">{sc.description}</div>
                )}
              </div>
              <Badge variant="outline" className={getStatusBadgeClass(sc.status)}>{sc.status}</Badge>
            </label>
          ))}
        </CardContent>
      </Card>

      {selected.length >= 2 && (
        comparing ? (
          <Skeleton className="h-96 w-full" />
        ) : comparison ? (
          <ComparisonPanel comparison={comparison.scenarios} cheapestId={comparison.cheapestScenarioId ?? null} maxDelta={comparison.maxDeltaFiveYear ?? null} />
        ) : null
      )}
    </div>
  );
}

function ComparisonPanel({
  comparison,
  cheapestId,
  maxDelta,
}: {
  comparison: ScenarioCalculationResult[];
  cheapestId: string | null;
  maxDelta: string | null;
}) {
  const allYears = comparison[0]?.districtWideSummary?.map(y => y.yearLabel ?? `Year ${y.contractYear}`) ?? [];

  const chartData = allYears.map((label, i) => {
    const point: Record<string, string | number | null | undefined> = { yearLabel: label };
    for (const sc of comparison) {
      const yearRow = sc.districtWideSummary?.[i];
      point[sc.scenarioName] = yearRow?.totalEmployerCost ? parseFloat(yearRow.totalEmployerCost) : null;
    }
    return point;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {comparison.map((sc, idx) => {
          const isCheapest = sc.scenarioId === cheapestId;
          return (
            <Card
              key={sc.scenarioId}
              className={`bg-card border ${isCheapest ? "border-green-500/40" : "border-border"}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold truncate">{sc.scenarioName}</CardTitle>
                  {isCheapest && (
                    <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-xs flex-shrink-0">
                      <TrendingDown className="w-3 h-3 mr-1" />Lowest Cost
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">5-Year Total</div>
                    <div
                      className="text-2xl font-mono font-bold"
                      style={{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
                    >
                      {sc.totalFiveYearCost ? formatCurrency(sc.totalFiveYearCost) : "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                    {sc.districtWideSummary?.slice(0, 5).map(yr => (
                      <div key={yr.contractYear} className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground text-xs">{yr.yearLabel}</span>
                        <span className="font-mono text-xs">{yr.totalEmployerCost ? formatCurrency(yr.totalEmployerCost) : "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {maxDelta && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 border border-border rounded-lg px-4 py-3">
          <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Maximum 5-year cost spread across selected scenarios: <span className="font-mono font-semibold text-foreground">{formatCurrency(maxDelta)}</span></span>
        </div>
      )}

      {chartData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>5-Year Cost Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="yearLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "var(--app-font-mono)" }}
                    tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--popover-foreground))",
                      borderRadius: "8px",
                      fontFamily: "var(--app-font-mono)",
                    }}
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                  <Legend wrapperStyle={{ paddingTop: "16px", fontFamily: "var(--app-font-sans)", fontSize: "13px" }} />
                  {comparison.map((sc, idx) => (
                    <Bar
                      key={sc.scenarioId}
                      dataKey={sc.scenarioName}
                      fill={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
