import { useState, useEffect } from "react";
import { useGetHeatmapData, getGetHeatmapDataQueryKey, useListBargainingUnits, getListBargainingUnitsQueryKey } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Play, Pause, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";

export default function HeatmapPage() {
  const { districtId } = useDistrictContext();
  const { data: units, isLoading: unitsLoading } = useListBargainingUnits(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }) } }
  );

  const salaryUnits = units?.filter(u => u.compensationType === "salary") || [];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Demographic Heatmap</h1>
          <p className="text-muted-foreground text-sm">Visualize staff distribution across the schedule over 5 years.</p>
        </div>
        <Button variant="outline" className="border-border">
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>

      {unitsLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : salaryUnits.length === 0 ? (
        <Card className="bg-card border-border"><CardContent className="py-12 text-center text-muted-foreground">No salary units found.</CardContent></Card>
      ) : (
        <Tabs defaultValue={salaryUnits[0]?.id} className="w-full">
          <TabsList className="bg-muted border-border">
            {salaryUnits.map(unit => (
              <TabsTrigger key={unit.id} value={unit.id} className="data-[state=active]:bg-background">
                {unit.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {salaryUnits.map(unit => (
            <TabsContent key={unit.id} value={unit.id} className="mt-6">
              <HeatmapViewer unitId={unit.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function HeatmapViewer({ unitId }: { unitId: string }) {
  const { scenarioId } = useDistrictContext();
  const { data, isLoading } = useGetHeatmapData(
    scenarioId!,
    { bargainingUnitId: unitId },
    { query: { enabled: !!scenarioId && !!unitId, queryKey: getGetHeatmapDataQueryKey(scenarioId!, { bargainingUnitId: unitId }) } }
  );

  const [currentYearIndex, setCurrentYearIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying || !data || data.years.length === 0) return;
    const timer = setInterval(() => {
      setCurrentYearIndex(prev => {
        if (prev >= data.years.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying, data]);

  if (isLoading) return <Skeleton className="h-[500px] w-full" />;
  if (!data || data.years.length === 0) return <Card className="bg-card border-border"><CardContent className="py-12 text-center text-muted-foreground">No heatmap data found.</CardContent></Card>;

  const yearData = data.years[currentYearIndex];
  const maxStep = yearData.maxStep;
  const lanes = yearData.lanes;
  
  const getCellColor = (count: number) => {
    if (count === 0) return "bg-slate-900/40 border-border/30";
    if (count === 1) return "bg-blue-900/40 border-blue-500/20 text-blue-300";
    if (count <= 3) return "bg-blue-800/60 border-blue-400/40 text-blue-200";
    if (count <= 5) return "bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]";
    return "bg-indigo-600 border-indigo-400 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-card border border-border p-3 rounded-lg">
        <div className="flex items-center gap-4">
          <Button variant={isPlaying ? "secondary" : "default"} size="icon" onClick={() => {
            if (currentYearIndex === data.years.length - 1) setCurrentYearIndex(0);
            setIsPlaying(!isPlaying);
          }}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentYearIndex(p => Math.max(0, p - 1))} disabled={currentYearIndex === 0}><ChevronLeft className="w-4 h-4" /></Button>
            <div className="px-4 py-2 bg-muted rounded font-mono font-bold text-center min-w-[120px]">
              {yearData.yearLabel}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCurrentYearIndex(p => Math.min(data.years.length - 1, p + 1))} disabled={currentYearIndex === data.years.length - 1}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs uppercase tracking-wider">Total Staff</span><span className="font-mono font-bold text-base">{yearData.totalEmployees}</span></div>
          <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs uppercase tracking-wider">Median Salary</span><span className="font-mono font-bold text-base">{formatCurrency(yearData.medianSalary)}</span></div>
          <div className="flex flex-col items-end"><span className="text-muted-foreground text-xs uppercase tracking-wider">Top Step</span><span className="font-mono font-bold text-base text-amber-500">{yearData.employeesAtTopStep}</span></div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max bg-card border border-border rounded-lg p-6">
          <div className="grid gap-1" style={{ gridTemplateColumns: `60px repeat(${lanes.length}, minmax(80px, 1fr))` }}>
            <div className="h-8"></div>
            {lanes.map(lane => (
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
                  {lanes.map(lane => {
                    const cellData = yearData.cells.find(c => c.stepNumber === stepNum && c.laneId === lane.id);
                    const count = cellData?.employeeCount || 0;
                    return (
                      <Popover key={`${stepNum}-${lane.id}`}>
                        <PopoverTrigger asChild>
                          <div className={`h-10 rounded border transition-all duration-500 flex items-center justify-center font-mono text-sm cursor-pointer ${getCellColor(count)} hover:ring-2 hover:ring-primary/50 relative overflow-hidden`}>
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
                              <div className="text-xs font-semibold">Step {stepNum} / {lane.name}</div>
                              <div className="text-[10px] text-muted-foreground">{count} employee{count !== 1 ? 's' : ''}</div>
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
