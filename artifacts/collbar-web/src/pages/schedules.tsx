import {
  useListSalarySchedules,
  getListSalarySchedulesQueryKey,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  SalaryScheduleWithGrid,
  Lane,
  Step,
  ScheduleCell,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function Schedules() {
  const { districtId } = useDistrictContext();
  const { data: units, isLoading: unitsLoading } = useListBargainingUnits(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }) } }
  );

  const salaryUnits = units?.filter(u => u.compensationType === "salary") || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salary Schedules</h1>
        <p className="text-muted-foreground text-sm">View step and lane compensation grids.</p>
      </div>

      {unitsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : salaryUnits.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">No salary units found.</CardContent>
        </Card>
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
              <ScheduleGrid unitId={unit.id} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function ScheduleGrid({ unitId }: { unitId: string }) {
  const { data: schedules, isLoading } = useListSalarySchedules(
    { bargainingUnitId: unitId },
    { query: { enabled: !!unitId, queryKey: getListSalarySchedulesQueryKey({ bargainingUnitId: unitId }) } }
  );

  const schedule = schedules?.[0] as SalaryScheduleWithGrid | undefined;

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!schedule || !schedule.lanes || !schedule.steps) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-muted-foreground">No grid data found.</CardContent>
      </Card>
    );
  }

  const lanes: Lane[] = [...schedule.lanes].sort((a, b) => a.displayOrder - b.displayOrder);
  const steps: Step[] = [...schedule.steps].sort((a, b) => a.stepNumber - b.stepNumber);
  const cells: ScheduleCell[] = schedule.cells ?? [];

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border">
              <TableHead className="w-20 border-r border-border">Step</TableHead>
              {lanes.map(lane => (
                <TableHead key={lane.id} className="text-right border-r border-border min-w-[120px]">
                  {lane.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map(step => (
              <TableRow key={step.id} className="border-border hover:bg-muted/30">
                <TableCell className="font-bold border-r border-border text-center">{step.stepNumber}</TableCell>
                {lanes.map(lane => {
                  const cell = cells.find((c: ScheduleCell) => c.stepId === step.id && c.laneId === lane.id);
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
  );
}
