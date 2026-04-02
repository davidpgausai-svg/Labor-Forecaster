import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency, formatNumber } from "@/lib/format";
import { getBadgeColorClass, getStatusBadgeClass } from "@/lib/badges";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ArrowUpRight, Award, History, TrendingUp, Calculator } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type ProjectionRow = {
  contractYear?: number;
  yearLabel?: string;
  totalEmployerCost?: string;
  byUnit?: Array<{ bargainingUnitId: string; bargainingUnitName: string; cost: string }>;
};

const UNIT_COLORS: Record<string, string> = {
  "Licensed Staff": "hsl(217,91%,60%)",
  "Educational Support Personnel": "hsl(258,90%,66%)",
  "Custodial & Maintenance": "hsl(38,92%,50%)",
};

function getUnitColor(name: string, idx: number): string {
  const fallbacks = ["hsl(173,58%,39%)", "hsl(349,89%,60%)", "hsl(221,83%,53%)"];
  return UNIT_COLORS[name] ?? fallbacks[idx % fallbacks.length];
}

function deltaPercent(projected: string, baseline: string): string | null {
  const p = parseFloat(projected);
  const b = parseFloat(baseline);
  if (!isFinite(p) || !isFinite(b) || b === 0) return null;
  const pct = ((p - b) / b) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export default function Dashboard() {
  const { districtId, scenarioId } = useDistrictContext();

  const { data, isLoading, isError } = useGetDashboard(
    { districtId: districtId!, scenarioId: scenarioId || undefined },
    { query: { enabled: !!districtId, queryKey: getGetDashboardQueryKey({ districtId: districtId!, scenarioId: scenarioId || undefined }) } }
  );

  if (!districtId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return <div className="text-destructive">Failed to load dashboard data.</div>;
  }

  const projection = data.fiveYearProjection as ProjectionRow[] | null | undefined;
  const unitNames = projection?.[0]?.byUnit?.map(u => u.bargainingUnitName) ?? [];
  const scenarioName = data.selectedScenarioName;
  const year1Total = data.scenarioYear1TotalCost;
  const year1ByUnit = data.scenarioYear1ByUnit;

  const hasProjections = projection && projection.length > 0;
  const hasYear1 = !!year1Total;

  const delta = hasYear1 ? deltaPercent(year1Total!, data.totalCurrentPayroll) : null;
  const deltaPositive = delta ? !delta.startsWith("-") : false;

  const chartData = projection?.map(row => {
    const point: Record<string, string | number | null | undefined> = { yearLabel: row.yearLabel };
    for (const u of (row.byUnit ?? [])) {
      point[u.bargainingUnitName] = parseFloat(u.cost);
    }
    return point;
  }) ?? [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.district?.name || "District"}</h1>
          <p className="text-muted-foreground mt-1">Financial Cockpit • {data.totalEmployees} Employees</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Payroll — scenario-aware */}
        <Card className={cn("bg-card border-border", hasYear1 && "border-primary/30")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {hasYear1 ? "Year 1 Projected Cost" : "Current Payroll"}
            </CardTitle>
            <DollarSign className={cn("w-4 h-4", hasYear1 ? "text-primary" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-2xl font-bold font-mono">
                {hasYear1 ? formatCurrency(year1Total!) : formatCurrency(data.totalCurrentPayroll)}
              </div>
              {hasYear1 && (
                <Badge variant="outline" className="text-primary border-primary/40 bg-primary/10 text-xs px-1.5 py-0">
                  Projected
                </Badge>
              )}
            </div>
            {hasYear1 && delta && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-xs font-mono font-semibold px-1.5 py-0.5 rounded",
                deltaPositive
                  ? "text-green-400 bg-green-400/10"
                  : "text-red-400 bg-red-400/10"
              )}>
                <TrendingUp className="w-3 h-3" />
                {delta} vs baseline
              </span>
            )}
            {hasYear1 && (
              <div className="text-xs text-muted-foreground font-mono">
                Baseline: {formatCurrency(data.totalCurrentPayroll)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retirement Eligible</CardTitle>
            <History className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatNumber(data.retirementEligibleCount)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Earners</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatNumber(data.highEarnerCount)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">At Top Step</CardTitle>
            <Award className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{formatNumber(data.employeesAtTopStepCount)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>5-Year Cost Projection</CardTitle>
              <CardDescription>
                {scenarioName
                  ? `Scenario: ${scenarioName} — total employer cost by bargaining unit`
                  : "Select a scenario to see projections"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {hasProjections && unitNames.length > 0 ? (
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
                        formatter={(value: number | string) => [formatCurrency(value), ""]}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: "12px", fontFamily: "var(--app-font-sans)", fontSize: "12px" }}
                      />
                      {unitNames.map((name, idx) => (
                        <Bar
                          key={name}
                          dataKey={name}
                          stackId="a"
                          fill={getUnitColor(name, idx)}
                          radius={idx === unitNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          maxBarSize={60}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
                    <Calculator className="w-8 h-8 text-muted-foreground/40" />
                    {scenarioId ? (
                      <>
                        <p className="text-muted-foreground text-sm font-medium">No projection data for this scenario</p>
                        <p className="text-muted-foreground/70 text-xs max-w-[220px]">
                          Open the scenario and click <strong>Calculate</strong> to generate year-by-year projections.
                        </p>
                        <Link
                          href={`/scenarios/${scenarioId}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Go to scenario →
                        </Link>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">Select a scenario to see projections</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle>Units</CardTitle>
              {hasYear1 && (
                <p className="text-xs text-muted-foreground mt-0.5">Year 1 projected employer cost</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {data.employeeCountByUnit.map((unit) => {
                const projUnit = year1ByUnit?.find(u => u.bargainingUnitId === unit.bargainingUnitId);
                const displayPayroll = projUnit?.totalPayroll ?? unit.totalPayroll ?? "0";
                const isProjected = !!projUnit;

                return (
                  <div key={unit.bargainingUnitId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getBadgeColorClass(unit.bargainingUnitName || "")}>
                        {unit.bargainingUnitName}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-medium">{formatNumber(unit.employeeCount)}</div>
                      <div className={cn(
                        "text-xs font-mono",
                        isProjected ? "text-primary" : "text-muted-foreground"
                      )}>
                        {formatCurrency(displayPayroll)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Active Scenarios</CardTitle>
              <Link href="/scenarios" className="text-xs text-primary hover:underline">View all</Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mt-4">
                {data.activeScenarios.slice(0, 4).map(sc => (
                  <div key={sc.id} className="flex items-center justify-between group">
                    <Link href={`/scenarios/${sc.id}`} className="font-medium hover:text-primary transition-colors truncate pr-4">
                      {sc.name}
                    </Link>
                    <Badge variant="outline" className={getStatusBadgeClass(sc.status)}>{sc.status}</Badge>
                  </div>
                ))}
                {data.activeScenarios.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">No active scenarios</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
