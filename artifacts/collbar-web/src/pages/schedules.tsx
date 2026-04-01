import { useState, useMemo } from "react";
import {
  useListSalarySchedules,
  getListSalarySchedulesQueryKey,
  useListHourlySchedules,
  getListHourlySchedulesQueryKey,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  SalaryScheduleWithGrid,
  Lane,
  Step,
  ScheduleCell,
  HourlyScheduleWithCategories,
  BargainingUnit,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getBadgeColorClass } from "@/lib/badges";
import { LayoutGrid, SplitSquareHorizontal, Clock, DollarSign, AlertTriangle, ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewMode = "single" | "compare";

export default function Schedules() {
  const { districtId } = useDistrictContext();
  const [viewMode, setViewMode] = useState<ViewMode>("single");

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
  const hourlyUnits = units?.filter((u) => u.compensationType === "hourly") || [];

  const allUnitTabs = units || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Schedules</h1>
          <p className="text-muted-foreground text-sm">
            View step/lane salary grids and hourly rate schedules per bargaining unit.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          <Button
            size="sm"
            variant={viewMode === "single" ? "default" : "ghost"}
            onClick={() => setViewMode("single")}
            className="h-8 gap-1.5"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Single
          </Button>
          <Button
            size="sm"
            variant={viewMode === "compare" ? "default" : "ghost"}
            onClick={() => setViewMode("compare")}
            className="h-8 gap-1.5"
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" /> Side by Side
          </Button>
        </div>
      </div>

      {unitsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : allUnitTabs.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No bargaining units found.
          </CardContent>
        </Card>
      ) : viewMode === "single" ? (
        <Tabs defaultValue={allUnitTabs[0]?.id} className="w-full">
          <TabsList className="bg-muted border-border flex-wrap h-auto">
            {allUnitTabs.map((unit) => (
              <TabsTrigger
                key={unit.id}
                value={unit.id}
                className="data-[state=active]:bg-background gap-1.5"
              >
                {unit.compensationType === "hourly" ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <DollarSign className="w-3 h-3" />
                )}
                {unit.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {allUnitTabs.map((unit) => (
            <TabsContent key={unit.id} value={unit.id} className="mt-6">
              <UnitHeader unit={unit} />
              {unit.compensationType === "hourly" ? (
                <HourlyScheduleGrid unitId={unit.id} />
              ) : (
                <ScheduleGrid unitId={unit.id} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <SideBySideView salaryUnits={salaryUnits} hourlyUnits={hourlyUnits} />
      )}
    </div>
  );
}

function UnitHeader({ unit }: { unit: BargainingUnit }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Badge variant="outline" className={getBadgeColorClass(unit.name)}>
        {unit.code}
      </Badge>
      <span className="text-sm text-muted-foreground capitalize">
        {unit.compensationType} compensation
      </span>
      <span className="text-muted-foreground text-sm">&bull;</span>
      <span className="text-sm text-muted-foreground">{unit.retirementSystem} retirement</span>
    </div>
  );
}

function OffScheduleIndicator({
  unitId,
  cells,
}: {
  unitId: string;
  cells: ScheduleCell[];
}) {
  const { districtId } = useDistrictContext();
  const { data: empData } = useListEmployees(
    { districtId: districtId!, bargainingUnitId: unitId, pageSize: 500 },
    {
      query: {
        enabled: !!districtId && !!unitId,
        queryKey: getListEmployeesQueryKey({ districtId: districtId!, bargainingUnitId: unitId, pageSize: 500 }),
      },
    }
  );

  const offScheduleCount = useMemo(() => {
    if (!empData?.employees || cells.length === 0) return 0;
    const salarySet = new Set(cells.map(c => Math.round(parseFloat(c.salaryAmount))));
    return empData.employees.filter(emp => {
      const sal = Math.round(parseFloat(emp.currentAnnualSalary) || 0);
      return sal > 0 && !salarySet.has(sal);
    }).length;
  }, [empData, cells]);

  if (offScheduleCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-400 mb-3">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="font-medium">{offScheduleCount} off-schedule</span>
      <span className="text-amber-400/70">
        {offScheduleCount === 1 ? "employee has a salary" : "employees have salaries"} that don't match any step/lane cell in this schedule.
      </span>
    </div>
  );
}

function FormulaBuilder({
  lanes,
  steps,
}: {
  lanes: Lane[];
  steps: Step[];
}) {
  const [baseValue, setBaseValue] = useState("40000");
  const [stepPct, setStepPct] = useState("2.0");
  const [lanePct, setLanePct] = useState("4.0");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const computedCells = useMemo(() => {
    const base = parseFloat(baseValue.replace(/,/g, "")) || 0;
    const sPct = parseFloat(stepPct) / 100;
    const lPct = parseFloat(lanePct) / 100;
    const result: Record<string, number> = {};
    steps.forEach((step, si) => {
      lanes.forEach((lane, li) => {
        const key = `${step.id}-${lane.id}`;
        if (overrides[key] !== undefined) {
          result[key] = parseFloat(overrides[key].replace(/,/g, "")) || 0;
        } else {
          result[key] = base * Math.pow(1 + sPct, si) * Math.pow(1 + lPct, li);
        }
      });
    });
    return result;
  }, [baseValue, stepPct, lanePct, overrides, steps, lanes]);

  return (
    <Card className="bg-card border-border border-dashed">
      <CardHeader className="py-3 px-4 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            Formula Builder Preview
          </CardTitle>
          <span className="text-xs text-muted-foreground">Preview only — not saved</span>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Step 1, Lane 1 Base ($)</label>
            <Input
              value={baseValue}
              onChange={e => setBaseValue(e.target.value)}
              className="h-8 bg-background/50 text-sm font-mono"
              placeholder="40000"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Step Increment (%)</label>
            <Input
              value={stepPct}
              onChange={e => setStepPct(e.target.value)}
              className="h-8 bg-background/50 text-sm font-mono"
              placeholder="2.0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Lane Increment (%)</label>
            <Input
              value={lanePct}
              onChange={e => setLanePct(e.target.value)}
              className="h-8 bg-background/50 text-sm font-mono"
              placeholder="4.0"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Click any cell below to override its computed value. Preview only — values are not saved to the database.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border">
                <TableHead className="w-16 border-r border-border text-xs">Step</TableHead>
                {lanes.map(lane => (
                  <TableHead key={lane.id} className="text-right border-r border-border min-w-[110px] text-xs">{lane.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map(step => (
                <TableRow key={step.id} className="border-border">
                  <TableCell className="font-bold border-r border-border text-center text-xs py-1.5">{step.stepNumber}</TableCell>
                  {lanes.map(lane => {
                    const key = `${step.id}-${lane.id}`;
                    const val = computedCells[key] ?? 0;
                    const isOverridden = overrides[key] !== undefined;
                    return (
                      <TableCell
                        key={lane.id}
                        className={`text-right font-mono text-xs border-r border-border last:border-r-0 py-1.5 cursor-pointer transition-colors ${isOverridden ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                        onClick={() => {
                          const current = overrides[key] ?? String(Math.round(val));
                          const newVal = window.prompt(`Override Step ${step.stepNumber} / ${lane.name}:`, current);
                          if (newVal !== null) {
                            if (newVal === "") {
                              setOverrides(prev => { const n = { ...prev }; delete n[key]; return n; });
                            } else {
                              setOverrides(prev => ({ ...prev, [key]: newVal }));
                            }
                          }
                        }}
                      >
                        {val > 0 ? formatCurrency(String(val.toFixed(0))) : "—"}
                        {isOverridden && <span className="ml-1 text-[9px] text-primary">✎</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {Object.keys(overrides).length > 0 && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setOverrides({})}>
            Clear all overrides ({Object.keys(overrides).length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleGrid({ unitId }: { unitId: string }) {
  const [showFormula, setShowFormula] = useState(false);

  const { data: schedules, isLoading } = useListSalarySchedules(
    { bargainingUnitId: unitId },
    {
      query: {
        enabled: !!unitId,
        queryKey: getListSalarySchedulesQueryKey({ bargainingUnitId: unitId }),
      },
    }
  );

  const schedule = schedules?.[0] as SalaryScheduleWithGrid | undefined;

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!schedule || !schedule.lanes || !schedule.steps) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          No salary grid data found.
        </CardContent>
      </Card>
    );
  }

  const lanes: Lane[] = [...schedule.lanes].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  const steps: Step[] = [...schedule.steps].sort(
    (a, b) => a.stepNumber - b.stepNumber
  );
  const cells: ScheduleCell[] = schedule.cells ?? [];

  return (
    <div className="space-y-3">
      <OffScheduleIndicator unitId={unitId} cells={cells} />

      <div className="flex justify-end">
        <Button
          variant={showFormula ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFormula(v => !v)}
          className="h-8 gap-1.5 text-xs"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Formula Builder
          {showFormula ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {showFormula && <FormulaBuilder lanes={lanes} steps={steps} />}

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border">
                <TableHead className="w-20 border-r border-border sticky left-0 bg-muted/50">
                  Step
                </TableHead>
                {lanes.map((lane) => (
                  <TableHead
                    key={lane.id}
                    className="text-right border-r border-border min-w-[120px]"
                  >
                    {lane.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((step) => (
                <TableRow
                  key={step.id}
                  className="border-border hover:bg-muted/30"
                >
                  <TableCell className="font-bold border-r border-border text-center sticky left-0 bg-card">
                    {step.stepNumber}
                  </TableCell>
                  {lanes.map((lane) => {
                    const cell = cells.find(
                      (c: ScheduleCell) =>
                        c.stepId === step.id && c.laneId === lane.id
                    );
                    return (
                      <TableCell
                        key={lane.id}
                        className="text-right font-mono text-sm border-r border-border last:border-r-0 text-muted-foreground hover:text-foreground hover:bg-primary/5 transition-colors"
                      >
                        {cell ? formatCurrency(cell.salaryAmount) : "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function HourlyScheduleGrid({ unitId }: { unitId: string }) {
  const { data: schedules, isLoading } = useListHourlySchedules(
    { bargainingUnitId: unitId },
    {
      query: {
        enabled: !!unitId,
        queryKey: getListHourlySchedulesQueryKey({ bargainingUnitId: unitId }),
      },
    }
  );

  const schedule = schedules?.[0] as HourlyScheduleWithCategories | undefined;

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!schedule || !schedule.categories?.length) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-muted-foreground">
          No hourly schedule data found.
        </CardContent>
      </Card>
    );
  }

  const categories = [...schedule.categories].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-border">
            <TableHead className="border-r border-border">Category</TableHead>
            <TableHead className="text-right border-r border-border">Base Hourly Rate</TableHead>
            <TableHead className="text-right border-r border-border">Annual Hours</TableHead>
            <TableHead className="text-right">Annual Equivalent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => {
            const annualEquivalent =
              parseFloat(cat.baseHourlyRate) * parseFloat(cat.annualHours);
            return (
              <TableRow key={cat.id} className="border-border hover:bg-muted/30">
                <TableCell className="font-medium border-r border-border">
                  {cat.name}
                </TableCell>
                <TableCell className="text-right font-mono text-sm border-r border-border text-green-400">
                  ${parseFloat(cat.baseHourlyRate).toFixed(2)}/hr
                </TableCell>
                <TableCell className="text-right font-mono text-sm border-r border-border text-muted-foreground">
                  {parseInt(cat.annualHours).toLocaleString()} hrs
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-foreground">
                  {isNaN(annualEquivalent) ? "—" : formatCurrency(String(annualEquivalent.toFixed(2)))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function SideBySideView({
  salaryUnits,
  hourlyUnits,
}: {
  salaryUnits: BargainingUnit[];
  hourlyUnits: BargainingUnit[];
}) {
  return (
    <div className="space-y-8">
      {salaryUnits.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Salary Lane/Step Grids
          </h2>
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${Math.min(salaryUnits.length, 2)}, 1fr)` }}
          >
            {salaryUnits.map((unit) => (
              <div key={unit.id} className="space-y-2">
                <Card className="bg-card border-border p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={getBadgeColorClass(unit.name)}>
                      {unit.code}
                    </Badge>
                    <span className="text-sm font-medium">{unit.name}</span>
                  </div>
                  <CompactSalaryGrid unitId={unit.id} />
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {hourlyUnits.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Hourly Rate Schedules
          </h2>
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: `repeat(${Math.min(hourlyUnits.length, 2)}, 1fr)` }}
          >
            {hourlyUnits.map((unit) => (
              <div key={unit.id}>
                <Card className="bg-card border-border p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={getBadgeColorClass(unit.name)}>
                      {unit.code}
                    </Badge>
                    <span className="text-sm font-medium">{unit.name}</span>
                  </div>
                  <HourlyScheduleGrid unitId={unit.id} />
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactSalaryGrid({ unitId }: { unitId: string }) {
  const { data: schedules, isLoading } = useListSalarySchedules(
    { bargainingUnitId: unitId },
    {
      query: {
        enabled: !!unitId,
        queryKey: getListSalarySchedulesQueryKey({ bargainingUnitId: unitId }),
      },
    }
  );

  const schedule = schedules?.[0] as SalaryScheduleWithGrid | undefined;

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!schedule?.lanes || !schedule?.steps) {
    return <p className="text-xs text-muted-foreground">No data.</p>;
  }

  const lanes: Lane[] = [...schedule.lanes].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  const steps: Step[] = [...schedule.steps].sort(
    (a, b) => a.stepNumber - b.stepNumber
  );
  const cells: ScheduleCell[] = schedule.cells ?? [];

  return (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0">
          <TableRow className="border-border">
            <TableHead className="w-14 border-r border-border text-xs py-1.5">Step</TableHead>
            {lanes.map((lane) => (
              <TableHead
                key={lane.id}
                className="text-right border-r border-border min-w-[100px] text-xs py-1.5"
              >
                {lane.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((step) => (
            <TableRow key={step.id} className="border-border">
              <TableCell className="font-bold border-r border-border text-center text-xs py-1.5">
                {step.stepNumber}
              </TableCell>
              {lanes.map((lane) => {
                const cell = cells.find(
                  (c: ScheduleCell) =>
                    c.stepId === step.id && c.laneId === lane.id
                );
                return (
                  <TableCell
                    key={lane.id}
                    className="text-right font-mono text-xs border-r border-border last:border-r-0 py-1.5 text-muted-foreground"
                  >
                    {cell ? formatCurrency(cell.salaryAmount) : "—"}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CardHeader2({ children }: { children: React.ReactNode }) {
  return (
    <CardHeader>
      <CardTitle className="text-sm">{children}</CardTitle>
    </CardHeader>
  );
}
