import { useState, useEffect, useRef } from "react";
import {
  useGetHeatmapData,
  getGetHeatmapDataQueryKey,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
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

export default function HeatmapPage() {
  const { districtId } = useDistrictContext();
  const { data: units, isLoading: unitsLoading } = useListBargainingUnits(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }),
      },
    }
  );

  const salaryUnits = units?.filter((u) => u.compensationType === "salary") || [];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Demographic Heatmap
          </h1>
          <p className="text-muted-foreground text-sm">
            Visualize staff distribution across the salary schedule over 5 contract years.
          </p>
        </div>
      </div>

      {unitsLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : salaryUnits.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No salary bargaining units found.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={salaryUnits[0]?.id} className="w-full">
          <TabsList className="bg-muted border-border">
            {salaryUnits.map((unit) => (
              <TabsTrigger
                key={unit.id}
                value={unit.id}
                className="data-[state=active]:bg-background"
              >
                {unit.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {salaryUnits.map((unit) => (
            <TabsContent key={unit.id} value={unit.id} className="mt-6">
              <HeatmapViewer unitId={unit.id} unitName={unit.name} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function HeatmapViewer({ unitId, unitName }: { unitId: string; unitName: string }) {
  const { scenarioId } = useDistrictContext();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useGetHeatmapData(
    scenarioId!,
    { bargainingUnitId: unitId },
    {
      query: {
        enabled: !!scenarioId && !!unitId,
        queryKey: getGetHeatmapDataQueryKey(scenarioId!, { bargainingUnitId: unitId }),
      },
    }
  );

  const [currentYearIndex, setCurrentYearIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    setCurrentYearIndex(0);
    setIsPlaying(true);
  }, [unitId]);

  useEffect(() => {
    if (!isPlaying || !data || data.years.length === 0) return;
    const timer = setInterval(() => {
      setCurrentYearIndex((prev) => {
        if (prev >= data.years.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying, data]);

  const exportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { backgroundColor: "#111620" });
      const link = document.createElement("a");
      link.download = `heatmap-${unitName}-${yearData?.yearLabel ?? "year"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
    }
  };

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;
  if (!data || data.years.length === 0)
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          No heatmap data found for this unit. Ensure a scenario is selected and
          employees are assigned.
        </CardContent>
      </Card>
    );

  const yearData = data.years[currentYearIndex];
  const maxStep = yearData.maxStep;
  const lanes = yearData.lanes;

  const getCellColor = (count: number) => {
    if (count === 0) return "bg-slate-900/40 border-border/30";
    if (count === 1)
      return "bg-blue-900/40 border-blue-500/20 text-blue-300";
    if (count <= 3)
      return "bg-blue-800/60 border-blue-400/40 text-blue-200";
    if (count <= 5)
      return "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]";
    return "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]";
  };

  const totalCells = maxStep * lanes.length;
  const occupiedCells = yearData.cells.filter((c) => (c.employeeCount ?? 0) > 0).length;
  const concentrationPct = totalCells > 0 ? Math.round((occupiedCells / totalCells) * 100) : 0;

  const occupiedSteps = [...new Set(yearData.cells.filter(c => (c.employeeCount ?? 0) > 0).map(c => c.stepNumber).filter((n): n is number => n !== undefined))];
  const avgStep = occupiedSteps.length > 0
    ? (occupiedSteps.reduce((s: number, n: number) => s + n, 0) / occupiedSteps.length).toFixed(1)
    : "—";

  const topStepPct = yearData.totalEmployees > 0
    ? Math.round((yearData.employeesAtTopStep / yearData.totalEmployees) * 100)
    : 0;

  const legendItems = [
    { label: "0", color: "bg-slate-900/40 border-border/30" },
    { label: "1", color: "bg-blue-900/40 border-blue-500/20" },
    { label: "2–3", color: "bg-blue-800/60 border-blue-400/40" },
    { label: "4–5", color: "bg-blue-600 border-blue-400" },
    { label: "6+", color: "bg-indigo-600 border-indigo-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card border border-border p-3 rounded-lg flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button
            variant={isPlaying ? "secondary" : "default"}
            size="icon"
            onClick={() => {
              if (currentYearIndex === data.years.length - 1)
                setCurrentYearIndex(0);
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentYearIndex((p) => Math.max(0, p - 1))
              }
              disabled={currentYearIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 py-2 bg-muted rounded font-mono font-bold text-center min-w-[120px]">
              {yearData.yearLabel}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCurrentYearIndex((p) =>
                  Math.min(data.years.length - 1, p + 1)
                )
              }
              disabled={currentYearIndex === data.years.length - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="hidden sm:flex gap-1">
            {data.years.map((y, i) => (
              <button
                key={i}
                onClick={() => { setIsPlaying(false); setCurrentYearIndex(i); }}
                className={`w-2 h-2 rounded-full transition-all ${i === currentYearIndex ? "bg-primary w-4" : "bg-muted-foreground/40 hover:bg-muted-foreground/70"}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Total Staff</span>
            <span className="font-mono font-bold text-base">{yearData.totalEmployees}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Median Salary</span>
            <span className="font-mono font-bold text-base">{formatCurrency(yearData.medianSalary)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Avg Step</span>
            <span className="font-mono font-bold text-base text-blue-400">{avgStep}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">At Top Step</span>
            <span className="font-mono font-bold text-base text-amber-500">
              {yearData.employeesAtTopStep}
              <span className="text-xs font-normal text-muted-foreground ml-1">({topStepPct}%)</span>
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground text-xs uppercase tracking-wider">Concentration</span>
            <span className="font-mono font-bold text-base">
              {concentrationPct}%
              <span className="text-xs font-normal text-muted-foreground ml-1">of cells</span>
            </span>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 px-1">
        <span className="text-xs text-muted-foreground mr-1">Legend:</span>
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded border ${item.color}`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto" ref={containerRef}>
        <div className="min-w-max bg-card border border-border rounded-lg p-6">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `60px repeat(${lanes.length}, minmax(80px, 1fr))`,
            }}
          >
            <div className="h-8"></div>
            {lanes.map((lane) => (
              <div
                key={lane.id}
                className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground border-b border-border/50"
              >
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
                    const cellData = yearData.cells.find(
                      (c) =>
                        c.stepNumber === stepNum && c.laneId === lane.id
                    );
                    const count = cellData?.employeeCount || 0;
                    const isTopStep = stepNum === maxStep;
                    return (
                      <Popover key={`${stepNum}-${lane.id}`}>
                        <PopoverTrigger asChild>
                          <div
                            className={`h-10 rounded border transition-all duration-500 flex items-center justify-center font-mono text-sm cursor-pointer ${getCellColor(count)} hover:ring-2 hover:ring-primary/50 relative overflow-hidden ${isTopStep && count > 0 ? "ring-1 ring-amber-500/40" : ""}`}
                          >
                            {count > 0 ? (
                              <motion.div
                                key={`${currentYearIndex}-${count}`}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="z-10"
                              >
                                {count}
                              </motion.div>
                            ) : null}
                          </div>
                        </PopoverTrigger>
                        {count > 0 && (
                          <PopoverContent className="w-64 bg-popover border-border p-0">
                            <div className="px-3 py-2 border-b border-border bg-muted/30">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-semibold">
                                  Step {stepNum} / {lane.name}
                                </div>
                                {isTopStep && (
                                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] py-0">
                                    Top Step
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {count} employee{count !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                              {cellData?.employees?.map((emp, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between px-3 py-1.5 text-sm hover:bg-muted/50"
                                >
                                  <span className="truncate">{emp.name}</span>
                                  <span className="font-mono text-muted-foreground">
                                    {formatCurrency(emp.salary)}
                                  </span>
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
