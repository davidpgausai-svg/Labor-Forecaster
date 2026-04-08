import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useGetHeatmapData,
  getGetHeatmapDataQueryKey,
  useListEmployeeGroups,
  getListEmployeeGroupsQueryKey,
  type EmployeeGroupWithSchedules,
  type HeatmapYearData,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
  FileText,
  BarChart2,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Schedule type helpers ───────────────────────────────────────────────────

const GRID_TYPES = ["direct_import_grid", "index_based_grid"];
const HOURLY_TYPE = "hourly";

function scheduleLabel(scheduleType: string | null | undefined): string {
  if (!scheduleType) return "Unknown";
  return scheduleType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Top-level page ──────────────────────────────────────────────────────────

export default function HeatmapPage() {
  const { districtId, contractYears, yearLabelMap } = useDistrictContext();

  const { data: employeeGroups, isLoading: groupsLoading } = useListEmployeeGroups(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }) } }
  );

  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Auto-select first group when data loads
  useEffect(() => {
    if (!selectedGroupId && employeeGroups && employeeGroups.length > 0) {
      setSelectedGroupId(employeeGroups[0].id);
    }
  }, [employeeGroups, selectedGroupId]);

  // Global year navigation — drives all schedule viewers simultaneously
  const [currentYearIndex, setCurrentYearIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying || contractYears.length === 0) return;
    const timer = setInterval(() => {
      setCurrentYearIndex((prev) => {
        if (prev >= contractYears.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying, contractYears]);

  const selectedGroup = employeeGroups?.find((g) => g.id === selectedGroupId);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Demographic Heatmap</h1>
          <p className="text-muted-foreground text-sm">
            Staff distribution across compensation schedules by employee group.
          </p>
        </div>

        {/* Group picker */}
        {groupsLoading ? (
          <Skeleton className="h-9 w-64" />
        ) : (
          <Select value={selectedGroupId} onValueChange={(v) => { setSelectedGroupId(v); setCurrentYearIndex(0); setIsPlaying(false); }}>
            <SelectTrigger className="w-64 bg-muted border-border">
              <SelectValue placeholder="Select employee group…" />
            </SelectTrigger>
            <SelectContent>
              {(employeeGroups ?? []).map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                  {Boolean((g as unknown as Record<string, unknown>).isUnionized) && (
                    <span className="ml-1.5 text-xs text-muted-foreground">· unionized</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedGroup ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            {groupsLoading ? <Skeleton className="h-4 w-40 mx-auto" /> : "No employee groups found."}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Global year navigator */}
          {contractYears.length > 0 && (
            <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2 w-fit">
              <Button
                variant={isPlaying ? "secondary" : "default"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (currentYearIndex === contractYears.length - 1) setCurrentYearIndex(0);
                  setIsPlaying((p) => !p);
                }}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentYearIndex((p) => Math.max(0, p - 1))}
                disabled={currentYearIndex === 0}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <div className="px-3 py-1 bg-muted rounded font-mono font-bold text-sm min-w-[100px] text-center">
                {yearLabelMap.get(contractYears[currentYearIndex]) ?? `Year ${contractYears[currentYearIndex]}`}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentYearIndex((p) => Math.min(contractYears.length - 1, p + 1))}
                disabled={currentYearIndex === contractYears.length - 1}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <div className="flex gap-1 pl-1">
                {contractYears.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setIsPlaying(false); setCurrentYearIndex(i); }}
                    className={`h-2 rounded-full transition-all ${i === currentYearIndex ? "bg-primary w-4" : "bg-muted-foreground/40 hover:bg-muted-foreground/70 w-2"}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Schedule tabs for the selected group */}
          <GroupSchedulePanel
            group={selectedGroup}
            currentYearIndex={currentYearIndex}
          />
        </>
      )}
    </div>
  );
}

// ── Per-group schedule tabs ─────────────────────────────────────────────────

function GroupSchedulePanel({
  group,
  currentYearIndex,
}: {
  group: EmployeeGroupWithSchedules;
  currentYearIndex: number;
}) {
  const schedules = group.compensationSchedules ?? [];
  const [activeScheduleId, setActiveScheduleId] = useState<string>(schedules[0]?.id ?? "");

  // Reset tab when group changes
  useEffect(() => {
    setActiveScheduleId(schedules[0]?.id ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  if (schedules.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No compensation schedules configured for this group. Add schedules in Settings.
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs value={activeScheduleId} onValueChange={setActiveScheduleId} className="w-full">
      <TabsList className="bg-muted border-border flex-wrap h-auto gap-1 p-1">
        {schedules.map((sched) => (
          <TabsTrigger
            key={sched.id}
            value={sched.id}
            className="data-[state=active]:bg-background text-xs gap-1.5"
          >
            {sched.name}
            <span className="text-muted-foreground font-normal">
              ({scheduleLabel(sched.scheduleType)})
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {schedules.map((sched) => (
        <TabsContent key={sched.id} value={sched.id} className="mt-6">
          <ScheduleViewer
            groupId={group.id}
            groupName={group.name}
            scheduleId={sched.id}
            scheduleName={sched.name}
            scheduleType={sched.scheduleType}
            currentYearIndex={currentYearIndex}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ── Per-schedule data fetcher + renderer ────────────────────────────────────

function ScheduleViewer({
  groupId,
  groupName,
  scheduleId,
  scheduleName,
  scheduleType,
  currentYearIndex,
}: {
  groupId: string;
  groupName: string;
  scheduleId: string;
  scheduleName: string;
  scheduleType: string;
  currentYearIndex: number;
}) {
  const { scenarioId } = useDistrictContext();

  const params = { employeeGroupId: groupId, compensationScheduleId: scheduleId };
  const { data, isLoading } = useGetHeatmapData(scenarioId!, params, {
    query: {
      enabled: !!scenarioId,
      queryKey: getGetHeatmapDataQueryKey(scenarioId!, params),
    },
  });

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;

  if (!data || data.years.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No projection data for this schedule. Run scenario calculation first.
        </CardContent>
      </Card>
    );
  }

  const yearData = data.years[currentYearIndex] ?? data.years[0];
  const isSummaryOnly = !!(data as unknown as Record<string, unknown>).isSummaryOnly;

  if (isSummaryOnly) {
    if (scheduleType === HOURLY_TYPE) {
      return <HourlyStepChart data={data} yearData={yearData} scheduleName={scheduleName} />;
    }
    return <SalarySummaryCard yearData={yearData} scheduleType={scheduleType} scheduleName={scheduleName} />;
  }

  return (
    <GridHeatmapViewer
      data={data}
      yearData={yearData}
      groupName={groupName}
      scheduleName={scheduleName}
    />
  );
}

// ── Grid heatmap viewer ─────────────────────────────────────────────────────

function GridHeatmapViewer({
  data,
  yearData,
  groupName,
  scheduleName,
}: {
  data: { years: HeatmapYearData[] };
  yearData: HeatmapYearData;
  groupName: string;
  scheduleName: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { scenarioId } = useDistrictContext();

  const maxStep = yearData.maxStep;
  const lanes = yearData.lanes;

  const getCellColor = (count: number) => {
    if (count === 0) return "bg-slate-900/40 border-border/30";
    if (count === 1) return "bg-blue-900/40 border-blue-500/20 text-blue-300";
    if (count <= 3) return "bg-blue-800/60 border-blue-400/40 text-blue-200";
    if (count <= 5) return "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]";
    return "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]";
  };

  const legendItems = [
    { label: "0", color: "bg-slate-900/40 border-border/30" },
    { label: "1", color: "bg-blue-900/40 border-blue-500/20" },
    { label: "2–3", color: "bg-blue-800/60 border-blue-400/40" },
    { label: "4–5", color: "bg-blue-600 border-blue-400" },
    { label: "6+", color: "bg-indigo-600 border-indigo-400" },
  ];

  const exportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { backgroundColor: "#111620" });
      const link = document.createElement("a");
      link.download = `heatmap-${groupName}-${scheduleName}-${yearData.yearLabel}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "PNG saved" });
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "PNG capture failed.", variant: "destructive" });
    }
  };

  const exportPdf = async () => {
    if (!containerRef.current || !scenarioId) return;
    try {
      const dataUrl = await toPng(containerRef.current, { backgroundColor: "#111620" });
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      const BASE_URL = import.meta.env.BASE_URL ?? "/collbar-web/";
      const res = await fetch(`${BASE_URL}api/reports/${scenarioId}/download/heatmap-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heatmapPng: base64 }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      link.download = cd.match(/filename="([^"]+)"/)?.[1] ?? `Heatmap_${groupName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({ title: "PDF saved" });
    } catch (err) {
      toast({ title: "Export failed", description: err instanceof Error ? err.message : "PDF failed.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between bg-card border border-border p-3 rounded-lg flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <StatPill label="Total Staff" value={String(yearData.totalEmployees)} />
          <StatPill label="Median Salary" value={formatCurrency(yearData.medianSalary ?? "0")} />
          <StatPill label="Avg Step" value={yearData.avgStep != null ? String(yearData.avgStep) : "—"} color="text-blue-400" />
          <StatPill label="Modal Lane" value={yearData.avgLane ?? "—"} color="text-purple-400" truncate />
          <StatPill
            label="Top-3 Steps"
            value={yearData.top3StepsPct != null ? `${yearData.top3StepsPct}%` : "—"}
            color="text-amber-500"
            suffix="of staff"
          />
          <StatPill
            label="Bot-3 Steps"
            value={yearData.bottom3StepsPct != null ? `${yearData.bottom3StepsPct}%` : "—"}
            color="text-green-400"
            suffix="of staff"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="border-border gap-2 h-9">
              <Download className="w-4 h-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={exportPng} className="gap-2 cursor-pointer">
              <ImageIcon className="w-4 h-4" /> Export as PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportPdf} className="gap-2 cursor-pointer">
              <FileText className="w-4 h-4" /> Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-1">
        <span className="text-xs text-muted-foreground mr-1">Legend:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded border ${item.color}`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto" ref={containerRef}>
        <div className="min-w-max bg-card border border-border rounded-lg p-6">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `60px repeat(${lanes.length}, minmax(80px, 1fr))` }}
          >
            <div className="h-8" />
            {lanes.map((lane) => (
              <div key={lane.id} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground border-b border-border/50">
                {lane.name}
              </div>
            ))}
            {Array.from({ length: maxStep }).map((_, stepIdx) => {
              const stepNum = stepIdx + 1;
              return (
                <div key={stepNum} className="contents">
                  <div className="flex items-center justify-end pr-3 text-xs font-mono text-muted-foreground border-r border-border/50">
                    {stepNum}
                  </div>
                  {lanes.map((lane) => {
                    const cellData = yearData.cells.find((c) => c.stepNumber === stepNum && c.laneId === lane.id);
                    const count = cellData?.employeeCount || 0;
                    const isTopStep = stepNum === maxStep;
                    return (
                      <Popover key={`${stepNum}-${lane.id}`}>
                        <PopoverTrigger asChild>
                          <div
                            className={`h-10 rounded border transition-all duration-500 flex items-center justify-center font-mono text-sm cursor-pointer ${getCellColor(count)} hover:ring-2 hover:ring-primary/50 relative overflow-hidden ${isTopStep && count > 0 ? "ring-1 ring-amber-500/40" : ""}`}
                          >
                            {count > 0 && (
                              <motion.div
                                key={count}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="z-10"
                              >
                                {count}
                              </motion.div>
                            )}
                          </div>
                        </PopoverTrigger>
                        {count > 0 && (
                          <PopoverContent className="w-64 bg-popover border-border p-0">
                            <div className="px-3 py-2 border-b border-border bg-muted/30">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">Step {stepNum} / {lane.name}</span>
                                {isTopStep && (
                                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] py-0">Top Step</Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{count} employee{count !== 1 ? "s" : ""}</div>
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                              {cellData?.employees?.map((emp, i) => (
                                <div key={i} className="flex justify-between px-3 py-1.5 text-sm hover:bg-muted/50">
                                  <span className="truncate">{emp.name}</span>
                                  <span className="font-mono text-muted-foreground">{formatCurrency(emp.salary)}</span>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Salary summary card for non-grid schedules ──────────────────────────────

function SalarySummaryCard({
  yearData,
  scheduleType,
  scheduleName,
}: {
  yearData: HeatmapYearData & { totalPayroll?: string | null; avgSalary?: string | null; minSalary?: string | null; maxSalary?: string | null };
  scheduleType: string;
  scheduleName: string;
}) {
  const yr = yearData as unknown as Record<string, unknown>;
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          {scheduleName}
          <Badge variant="outline" className="text-xs bg-muted/40 text-muted-foreground border-border font-normal">
            {scheduleLabel(scheduleType)}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Summary view — this schedule type does not use a lane/step grid.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryStatBox label="Headcount" value={String(yearData.totalEmployees)} />
          <SummaryStatBox label="Total Payroll" value={formatCurrency(String(yr.totalPayroll ?? "0"))} />
          <SummaryStatBox label="Avg Salary" value={formatCurrency(String(yr.avgSalary ?? "0"))} />
          <SummaryStatBox label="Median Salary" value={formatCurrency(yearData.medianSalary ?? "0")} />
          <SummaryStatBox label="Min Salary" value={formatCurrency(String(yr.minSalary ?? "0"))} />
          <SummaryStatBox label="Max Salary" value={formatCurrency(String(yr.maxSalary ?? "0"))} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Hourly step bar chart ───────────────────────────────────────────────────

function HourlyStepChart({
  data,
  yearData,
  scheduleName,
}: {
  data: { years: HeatmapYearData[] };
  yearData: HeatmapYearData;
  scheduleName: string;
}) {
  const yr = yearData as unknown as Record<string, unknown>;
  const stepCountMap: Record<number, number> = {};
  yearData.cells.forEach((cell) => {
    const s = cell.stepNumber ?? 0;
    stepCountMap[s] = (stepCountMap[s] ?? 0) + (cell.employeeCount ?? 0);
  });
  const chartData = Object.entries(stepCountMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([step, count]) => ({ step: `Step ${step}`, count }));

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            {scheduleName} — Step Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <SummaryStatBox label="Headcount" value={String(yearData.totalEmployees)} />
            <SummaryStatBox label="Total Payroll" value={formatCurrency(String(yr.totalPayroll ?? "0"))} />
            <SummaryStatBox label="Avg Salary" value={formatCurrency(String(yr.avgSalary ?? "0"))} />
            <SummaryStatBox label="Median Salary" value={formatCurrency(yearData.medianSalary ?? "0")} />
          </div>

          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No step data. Run scenario calculation to populate.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="step" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(258,90%,66%)" radius={[3, 3, 0, 0]} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Small display helpers ───────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
  suffix,
  truncate,
}: {
  label: string;
  value: string;
  color?: string;
  suffix?: string;
  truncate?: boolean;
}) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className={`font-mono font-bold text-base ${color ?? ""} ${truncate ? "truncate max-w-[80px]" : ""}`} title={value}>
        {value}
        {suffix && <span className="text-xs font-normal text-muted-foreground ml-1">{suffix}</span>}
      </span>
    </div>
  );
}

function SummaryStatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-mono font-semibold text-sm">{value}</p>
    </div>
  );
}
