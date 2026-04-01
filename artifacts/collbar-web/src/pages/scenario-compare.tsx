import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListScenarios,
  getListScenariosQueryKey,
  useCompareScenarios,
  getCompareScenariosQueryKey,
  ScenarioCalculationResult,
  ScenarioYearSummary,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusBadgeClass } from "@/lib/badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";

const COMPARE_COLORS = [
  "hsl(217,91%,60%)",
  "hsl(258,90%,66%)",
  "hsl(38,92%,50%)",
];

const UNIT_COLORS: Record<string, string> = {
  Licensed: "hsl(217,91%,60%)",
  ESP: "hsl(258,90%,66%)",
  CM: "hsl(38,92%,50%)",
};

function unitColor(name: string | null | undefined): string {
  if (!name) return "hsl(var(--muted-foreground))";
  for (const [key, color] of Object.entries(UNIT_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "hsl(var(--primary))";
}

export default function ScenarioCompare() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: scenarios, isLoading: scenariosLoading } = useListScenarios(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListScenariosQueryKey({ districtId: districtId! }),
      },
    }
  );

  const canCompare = selected.length >= 2;

  const { data: comparison, isLoading: comparing } = useCompareScenarios(
    { ids: selected.join(","), districtId: districtId! },
    {
      query: {
        enabled: canCompare && !!districtId,
        queryKey: getCompareScenariosQueryKey({
          ids: selected.join(","),
          districtId: districtId!,
        }),
      },
    }
  );

  const toggleScenario = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/scenarios")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Compare Scenarios
          </h1>
          <p className="text-muted-foreground text-sm">
            Select 2–3 scenarios for side-by-side cost projection comparison.
          </p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Select Scenarios ({selected.length}/3)
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {scenarios?.map((sc) => (
            <label
              key={sc.id}
              className="flex items-center gap-4 py-3 cursor-pointer hover:bg-muted/20 px-2 rounded transition-colors"
            >
              <Checkbox
                checked={selected.includes(sc.id)}
                onCheckedChange={() => toggleScenario(sc.id)}
                disabled={!selected.includes(sc.id) && selected.length >= 3}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{sc.name}</div>
                {sc.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {sc.description}
                  </div>
                )}
              </div>
              <Badge
                variant="outline"
                className={getStatusBadgeClass(sc.status)}
              >
                {sc.status}
              </Badge>
            </label>
          ))}
        </CardContent>
      </Card>

      {selected.length >= 2 &&
        (comparing ? (
          <Skeleton className="h-96 w-full" />
        ) : comparison ? (
          <ComparisonPanel
            comparison={comparison.scenarios}
            cheapestId={comparison.cheapestScenarioId ?? null}
            maxDelta={comparison.maxDeltaFiveYear ?? null}
          />
        ) : null)}
    </div>
  );
}

function fmt(v: string | number | null | undefined): string {
  if (!v) return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n) || n === 0) return "—";
  return formatCurrency(n);
}

function DeltaBadge({ delta, pct }: { delta: number; pct: number }) {
  if (Math.abs(delta) < 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" /> —
      </span>
    );
  }
  const isPositive = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-mono ${isPositive ? "text-red-400" : "text-green-400"}`}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {isPositive ? "+" : ""}
      {formatCurrency(delta)} ({pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%)
    </span>
  );
}

function YearlyBreakdownTable({
  comparison,
}: {
  comparison: ScenarioCalculationResult[];
}) {
  const allYears =
    comparison[0]?.districtWideSummary?.map(
      (y) => ({ year: y.contractYear!, label: y.yearLabel ?? `Year ${y.contractYear}` })
    ) ?? [];

  const baseline = comparison[0];

  const METRICS: { label: string; key: "totalPayroll" | "totalBenefits" | "totalEmployerCost" }[] = [
    { label: "Total Payroll", key: "totalPayroll" },
    { label: "Benefits", key: "totalBenefits" },
    { label: "Total Employer Cost", key: "totalEmployerCost" },
  ];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-border">
            <TableHead className="w-48">Metric</TableHead>
            {comparison.map((sc, idx) => (
              <TableHead
                key={sc.scenarioId}
                className="text-right text-xs"
                style={{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
              >
                {sc.scenarioName}
              </TableHead>
            ))}
            {comparison.length > 1 &&
              comparison.slice(1).map((sc) => (
                <TableHead
                  key={`delta-${sc.scenarioId}`}
                  className="text-right text-xs text-muted-foreground"
                >
                  Δ vs Baseline
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allYears.map(({ year, label }, yi) => {
            const baseTotal = parseFloat(baseline.districtWideSummary?.[yi]?.totalEmployerCost ?? "0");
            const yearCosts = comparison.map((sc) => parseFloat(sc.districtWideSummary?.[yi]?.totalEmployerCost ?? "0"));
            const maxCost = Math.max(...yearCosts.filter(Boolean));
            const minCost = Math.min(...yearCosts.filter(n => n > 0));

            return (
              <>
                <TableRow key={`year-${year}`} className="border-border bg-muted/20">
                  <TableCell colSpan={comparison.length + comparison.length} className="py-1.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    {label}
                  </TableCell>
                </TableRow>
                {METRICS.map(({ label: metricLabel, key }) => {
                  const isTotalRow = key === "totalEmployerCost";
                  return (
                    <TableRow key={`${year}-${key}`} className={`border-border ${isTotalRow ? "font-semibold" : ""}`}>
                      <TableCell className={`text-sm pl-6 ${isTotalRow ? "" : "text-muted-foreground"}`}>
                        {metricLabel}
                      </TableCell>
                      {comparison.map((sc, idx) => {
                        const raw = sc.districtWideSummary?.[yi]?.[key];
                        const val = parseFloat((raw as string) ?? "0") || 0;
                        const isCheapestYear = isTotalRow && val === minCost && comparison.length > 1;
                        const isMostExpYear = isTotalRow && val === maxCost && comparison.length > 1;
                        return (
                          <TableCell
                            key={sc.scenarioId}
                            className="text-right font-mono text-sm"
                            style={{ color: isTotalRow ? COMPARE_COLORS[idx % COMPARE_COLORS.length] : undefined }}
                          >
                            <span className={isCheapestYear ? "text-green-400" : isMostExpYear ? "text-red-400" : ""}>
                              {fmt(val || null)}
                            </span>
                            {isCheapestYear && <span className="ml-1 text-[10px] text-green-400">▼</span>}
                            {isMostExpYear && <span className="ml-1 text-[10px] text-red-400">▲</span>}
                          </TableCell>
                        );
                      })}
                      {isTotalRow && comparison.slice(1).map((sc) => {
                        const cost = parseFloat(sc.districtWideSummary?.[yi]?.totalEmployerCost ?? "0");
                        const delta = cost - baseTotal;
                        const pct = baseTotal > 0 ? (delta / baseTotal) * 100 : 0;
                        return (
                          <TableCell key={`delta-${sc.scenarioId}-${year}`} className="text-right">
                            <DeltaBadge delta={delta} pct={pct} />
                          </TableCell>
                        );
                      })}
                      {!isTotalRow && comparison.slice(1).map((sc) => (
                        <TableCell key={`delta-${sc.scenarioId}-${year}-${key}`} />
                      ))}
                    </TableRow>
                  );
                })}
              </>
            );
          })}

          <TableRow className="border-t-2 border-border bg-muted/30 font-bold">
            <TableCell className="text-sm">5-Year Total</TableCell>
            {comparison.map((sc, idx) => {
              const total = sc.districtWideSummary?.reduce(
                (s, y) => s + (parseFloat(y.totalEmployerCost ?? "0") || 0),
                0
              ) ?? 0;
              return (
                <TableCell
                  key={sc.scenarioId}
                  className="text-right font-mono text-sm"
                  style={{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
                >
                  {formatCurrency(total)}
                </TableCell>
              );
            })}
            {comparison.slice(1).map((sc) => {
              const baseTotal =
                baseline.districtWideSummary?.reduce(
                  (s, y) => s + (parseFloat(y.totalEmployerCost ?? "0") || 0),
                  0
                ) ?? 0;
              const total =
                sc.districtWideSummary?.reduce(
                  (s, y) => s + (parseFloat(y.totalEmployerCost ?? "0") || 0),
                  0
                ) ?? 0;
              const delta = total - baseTotal;
              const pct = baseTotal > 0 ? (delta / baseTotal) * 100 : 0;
              return (
                <TableCell key={`total-delta-${sc.scenarioId}`} className="text-right">
                  <DeltaBadge delta={delta} pct={pct} />
                </TableCell>
              );
            })}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function UnitBreakdownTable({
  comparison,
}: {
  comparison: ScenarioCalculationResult[];
}) {
  const allYearSummaries = comparison.flatMap(sc => sc.yearSummaries ?? []);
  const unitNames = [...new Set(allYearSummaries.map(s => s.bargainingUnitName).filter(Boolean) as string[])].sort();
  const allYears = [...new Set(allYearSummaries.map(s => s.contractYear))].sort((a, b) => a - b);

  if (unitNames.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No unit breakdown data available. Run scenario calculations first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {allYears.map(year => {
        const yearLabel = comparison[0]?.yearSummaries?.find(s => s.contractYear === year)?.yearLabel ?? `Year ${year}`;
        return (
          <div key={year}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{yearLabel}</h4>
            <div className="overflow-x-auto rounded border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead className="w-40">Bargaining Unit</TableHead>
                    {comparison.map((sc, idx) => (
                      <TableHead key={sc.scenarioId} className="text-right text-xs" style={{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}>
                        {sc.scenarioName}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitNames.map(unitName => {
                    const getUnitYearSummary = (sc: ScenarioCalculationResult): ScenarioYearSummary | undefined =>
                      sc.yearSummaries?.find(s => s.contractYear === year && s.bargainingUnitName === unitName);

                    return (
                      <>
                        <TableRow key={`${year}-${unitName}-header`} className="border-border bg-muted/10">
                          <TableCell className="font-semibold text-sm" colSpan={comparison.length + 1}>
                            <span style={{ color: unitColor(unitName) }}>{unitName}</span>
                          </TableCell>
                        </TableRow>
                        {[
                          { label: "Payroll", key: "totalPayroll" as keyof ScenarioYearSummary },
                          { label: "TRS", key: "totalTRS" as keyof ScenarioYearSummary },
                          { label: "IMRF", key: "totalIMRF" as keyof ScenarioYearSummary },
                          { label: "FICA", key: "totalFICA" as keyof ScenarioYearSummary },
                          { label: "Health Insurance", key: "totalHealthInsurance" as keyof ScenarioYearSummary },
                          { label: "Other Benefits", key: "totalOtherBenefits" as keyof ScenarioYearSummary },
                          { label: "Total Employer Cost", key: "totalEmployerCost" as keyof ScenarioYearSummary },
                        ].map(({ label, key }) => {
                          const isTotalRow = key === "totalEmployerCost";
                          const vals = comparison.map(sc => {
                            const s = getUnitYearSummary(sc);
                            return parseFloat((s?.[key] as string | undefined) ?? "0") || 0;
                          });
                          if (vals.every(v => v === 0) && !isTotalRow) return null;
                          return (
                            <TableRow key={`${year}-${unitName}-${key}`} className={`border-border ${isTotalRow ? "font-semibold" : ""}`}>
                              <TableCell className={`text-sm pl-6 ${isTotalRow ? "" : "text-muted-foreground"}`}>{label}</TableCell>
                              {comparison.map((sc, idx) => {
                                const val = vals[idx];
                                return (
                                  <TableCell
                                    key={sc.scenarioId}
                                    className="text-right font-mono text-sm"
                                    style={{ color: isTotalRow ? COMPARE_COLORS[idx % COMPARE_COLORS.length] : undefined }}
                                  >
                                    {fmt(val || null)}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
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
  const allYears =
    comparison[0]?.districtWideSummary?.map(
      (y) => y.yearLabel ?? `Year ${y.contractYear}`
    ) ?? [];

  const chartData = allYears.map((label, i) => {
    const point: Record<string, string | number | null | undefined> = {
      yearLabel: label,
    };
    for (const sc of comparison) {
      const yearRow = sc.districtWideSummary?.[i];
      point[sc.scenarioName] = yearRow?.totalEmployerCost
        ? parseFloat(yearRow.totalEmployerCost)
        : null;
    }
    return point;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {comparison.map((sc, idx) => {
          const isCheapest = sc.scenarioId === cheapestId;
          const fiveYearTotal = sc.districtWideSummary?.reduce(
            (s, y) => s + (parseFloat(y.totalEmployerCost ?? "0") || 0),
            0
          ) ?? 0;
          return (
            <Card
              key={sc.scenarioId}
              className={`bg-card border ${isCheapest ? "border-green-500/40" : "border-border"}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold truncate">
                    {sc.scenarioName}
                  </CardTitle>
                  {isCheapest && (
                    <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-xs flex-shrink-0">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Lowest
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="text-2xl font-mono font-bold"
                  style={{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }}
                >
                  {formatCurrency(fiveYearTotal)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  5-Year Total Employer Cost
                </div>
                {idx > 0 && (() => {
                  const baseTotal = comparison[0].districtWideSummary?.reduce(
                    (s, y) => s + (parseFloat(y.totalEmployerCost ?? "0") || 0),
                    0
                  ) ?? 0;
                  const delta = fiveYearTotal - baseTotal;
                  const pct = baseTotal > 0 ? (delta / baseTotal) * 100 : 0;
                  return (
                    <div className="mt-2">
                      <DeltaBadge delta={delta} pct={pct} />
                      <span className="text-xs text-muted-foreground ml-1">vs baseline</span>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {maxDelta && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 border border-border rounded-lg px-4 py-3">
          <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
          <span>
            Maximum 5-year cost spread:{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(maxDelta)}
            </span>
          </span>
        </div>
      )}

      {chartData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Year-by-Year Total Employer Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="yearLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 12,
                      fontFamily: "var(--app-font-mono)",
                    }}
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
                  <Legend
                    wrapperStyle={{
                      paddingTop: "16px",
                      fontFamily: "var(--app-font-sans)",
                      fontSize: "13px",
                    }}
                  />
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

      <Tabs defaultValue="district" className="space-y-4">
        <TabsList>
          <TabsTrigger value="district">District-Wide Year-by-Year</TabsTrigger>
          <TabsTrigger value="units">By Bargaining Unit</TabsTrigger>
        </TabsList>

        <TabsContent value="district">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Year-by-Year Cost Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Payroll, benefits, and total employer cost with deltas vs{" "}
                <span className="font-semibold text-foreground">
                  {comparison[0].scenarioName}
                </span>{" "}
                baseline. ▼ = lowest cost year, ▲ = highest.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <YearlyBreakdownTable comparison={comparison} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Per-Unit Cost Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Payroll, TRS, IMRF, FICA, health insurance, and total employer cost per bargaining unit per year.
              </p>
            </CardHeader>
            <CardContent>
              <UnitBreakdownTable comparison={comparison} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
