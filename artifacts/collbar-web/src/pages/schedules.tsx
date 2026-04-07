import { useState, useMemo } from "react";
import {
  useListEmployeeGroups,
  getListEmployeeGroupsQueryKey,
  useGetIndexGridConfig,
  getGetIndexGridConfigQueryKey,
  useListImportGridLanes,
  getListImportGridLanesQueryKey,
  useListImportGridCells,
  getListImportGridCellsQueryKey,
  useListHourlyCategories,
  getListHourlyCategoriesQueryKey,
  useListSalaryRanges,
  getListSalaryRangesQueryKey,
  useListFlatRateCategories,
  getListFlatRateCategoriesQueryKey,
  useListStipendDefinitions,
  getListStipendDefinitionsQueryKey,
  useGetPerDiemConfig,
  getGetPerDiemConfigQueryKey,
  useListEmployees,
  getListEmployeesQueryKey,
  EmployeeGroupWithSchedules,
  CompensationSchedule,
  CompensationScheduleScheduleType,
  ScheduleIndex,
  ImportGridLane,
  ImportGridCell,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutGrid,
  SplitSquareHorizontal,
  DollarSign,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants / helpers
// ---------------------------------------------------------------------------

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  index_based_grid: "Index Grid",
  individual_salary: "Individual Salary",
  direct_import_grid: "Import Grid",
  hourly: "Hourly",
  per_diem: "Per Diem",
  flat_rate: "Flat Rate",
  stipend_table: "Stipend Table",
  range_based: "Salary Ranges",
};

const PAY_TYPE_COLORS: Record<string, string> = {
  salary: "border-blue-500/30 text-blue-400",
  hourly: "border-purple-500/30 text-purple-400",
  per_diem: "border-amber-500/30 text-amber-400",
};

const PAY_TYPE_LABELS: Record<string, string> = {
  salary: "Salary",
  hourly: "Hourly",
  per_diem: "Per Diem",
};

function formatCents(cents: number): string {
  return formatCurrency(String((cents / 100).toFixed(2)));
}

function formatIndexSalary(base: string, index: string): string {
  const n = Math.round(parseFloat(base) * parseFloat(index));
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// IndexGridViewer
// ---------------------------------------------------------------------------

function IndexGridViewer({
  scheduleId,
  active,
}: {
  scheduleId: string;
  active: boolean;
}) {
  const { data: config, isLoading: configLoading } = useGetIndexGridConfig(
    scheduleId,
    {
      query: {
        enabled: active,
        queryKey: getGetIndexGridConfigQueryKey(scheduleId),
      },
    }
  );
  const { data: lanes = [], isLoading: lanesLoading } = useListImportGridLanes(
    scheduleId,
    {
      query: {
        enabled: active,
        queryKey: getListImportGridLanesQueryKey(scheduleId),
      },
    }
  );

  if (configLoading || lanesLoading)
    return <Skeleton className="h-48 w-full" />;
  if (!config || lanes.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No grid data. Use Settings → Compensation Schedules to configure.
      </p>
    );

  const sortedLanes = [...lanes].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  const steps = Array.from({ length: config.maxSteps }, (_, i) => i + 1);
  const indexMap = new Map<string, string>();
  config.indices.forEach((idx: ScheduleIndex) => {
    indexMap.set(`${idx.laneId}:${idx.stepNumber}`, idx.indexValue);
  });

  const base = config.baseAnchorSalary;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Base anchor:{" "}
          <span className="font-mono text-foreground">
            {parseFloat(base).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 0,
            })}
          </span>
        </span>
        <span>·</span>
        <span>
          {config.maxSteps} steps · {sortedLanes.length} lane
          {sortedLanes.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded border border-border">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow className="border-border">
              <TableHead className="w-14 border-r border-border text-xs sticky left-0 bg-muted/50">
                Step
              </TableHead>
              {sortedLanes.map((lane) => (
                <TableHead
                  key={lane.id}
                  colSpan={2}
                  className="text-center border-r border-border min-w-[160px] text-xs"
                >
                  {lane.name}
                </TableHead>
              ))}
            </TableRow>
            <TableRow className="border-border bg-muted/30">
              <TableHead className="w-14 border-r border-border sticky left-0 bg-muted/30" />
              {sortedLanes.map((lane) => (
                <>
                  <TableHead
                    key={`${lane.id}-idx`}
                    className="text-right border-r border-border text-[10px] text-muted-foreground w-20"
                  >
                    Index
                  </TableHead>
                  <TableHead
                    key={`${lane.id}-sal`}
                    className="text-right border-r border-border last:border-r-0 text-[10px] text-muted-foreground w-28"
                  >
                    Salary
                  </TableHead>
                </>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((step) => (
              <TableRow key={step} className="border-border hover:bg-muted/20">
                <TableCell className="font-mono text-xs font-bold border-r border-border text-center sticky left-0 bg-card">
                  {step}
                </TableCell>
                {sortedLanes.map((lane) => {
                  const idxVal = indexMap.get(`${lane.id}:${step}`);
                  return (
                    <>
                      <TableCell
                        key={`${lane.id}-idx`}
                        className="text-right font-mono text-xs border-r border-border text-muted-foreground py-1.5"
                      >
                        {idxVal ?? "—"}
                      </TableCell>
                      <TableCell
                        key={`${lane.id}-sal`}
                        className="text-right font-mono text-xs border-r border-border last:border-r-0 py-1.5"
                      >
                        {idxVal ? formatIndexSalary(base, idxVal) : "—"}
                      </TableCell>
                    </>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportGridViewer
// ---------------------------------------------------------------------------

function ImportGridViewer({
  scheduleId,
  active,
}: {
  scheduleId: string;
  active: boolean;
}) {
  const { data: lanes = [], isLoading: lanesLoading } = useListImportGridLanes(
    scheduleId,
    {
      query: {
        enabled: active,
        queryKey: getListImportGridLanesQueryKey(scheduleId),
      },
    }
  );
  const { data: cells = [], isLoading: cellsLoading } = useListImportGridCells(
    scheduleId,
    {
      query: {
        enabled: active,
        queryKey: getListImportGridCellsQueryKey(scheduleId),
      },
    }
  );

  if (lanesLoading || cellsLoading)
    return <Skeleton className="h-48 w-full" />;
  if (lanes.length === 0 || cells.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No grid data. Use Settings → Compensation Schedules to import.
      </p>
    );

  const sortedLanes = [...lanes].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  const maxStep = Math.max(...cells.map((c: ImportGridCell) => c.stepNumber));
  const steps = Array.from({ length: maxStep }, (_, i) => i + 1);
  const cellMap = new Map<string, number>();
  cells.forEach((c: ImportGridCell) => {
    cellMap.set(`${c.laneId}:${c.stepNumber}`, c.salaryCents);
  });

  return (
    <div className="overflow-x-auto max-h-[360px] overflow-y-auto rounded border border-border">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0 z-10">
          <TableRow className="border-border">
            <TableHead className="w-14 border-r border-border text-xs sticky left-0 bg-muted/50">
              Step
            </TableHead>
            {sortedLanes.map((lane) => (
              <TableHead
                key={lane.id}
                className="text-right border-r border-border min-w-[110px] text-xs last:border-r-0"
              >
                {lane.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((step) => (
            <TableRow key={step} className="border-border hover:bg-muted/20">
              <TableCell className="font-mono text-xs font-bold border-r border-border text-center sticky left-0 bg-card py-1.5">
                {step}
              </TableCell>
              {sortedLanes.map((lane) => {
                const cents = cellMap.get(`${lane.id}:${step}`);
                return (
                  <TableCell
                    key={lane.id}
                    className="text-right font-mono text-sm border-r border-border last:border-r-0 py-1.5 text-muted-foreground"
                  >
                    {cents !== undefined ? formatCents(cents) : "—"}
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

// ---------------------------------------------------------------------------
// CompHourlyCategoryViewer
// ---------------------------------------------------------------------------

function CompHourlyCategoryViewer({
  scheduleId,
  active,
}: {
  scheduleId: string;
  active: boolean;
}) {
  const { data: categories = [], isLoading } = useListHourlyCategories(
    scheduleId,
    {
      query: {
        enabled: active,
        queryKey: getListHourlyCategoriesQueryKey(scheduleId),
      },
    }
  );

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (categories.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No categories defined.
      </p>
    );

  const sorted = [...categories].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
  const totalAnnual = sorted.reduce(
    (sum, c) => sum + parseFloat(c.baseHourlyRate) * parseFloat(c.annualHours),
    0
  );

  return (
    <div className="rounded border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-border">
            <TableHead className="border-r border-border text-xs">
              Category
            </TableHead>
            <TableHead className="text-right border-r border-border text-xs">
              Rate / hr
            </TableHead>
            <TableHead className="text-right border-r border-border text-xs">
              Annual Hrs
            </TableHead>
            <TableHead className="text-right text-xs">Annual Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((cat) => {
            const annual =
              parseFloat(cat.baseHourlyRate) * parseFloat(cat.annualHours);
            return (
              <TableRow key={cat.id} className="border-border hover:bg-muted/20">
                <TableCell className="border-r border-border text-sm py-1.5">
                  {cat.name}
                </TableCell>
                <TableCell className="text-right font-mono text-sm border-r border-border text-green-400 py-1.5">
                  ${parseFloat(cat.baseHourlyRate).toFixed(4)}/hr
                </TableCell>
                <TableCell className="text-right font-mono text-xs border-r border-border text-muted-foreground py-1.5">
                  {parseInt(cat.annualHours).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-sm py-1.5">
                  {formatCurrency(annual.toFixed(2))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex justify-end px-3 py-2 border-t border-border bg-muted/20">
        <span className="text-xs text-muted-foreground mr-2">
          Total Annual:
        </span>
        <span className="text-xs font-mono font-semibold">
          {formatCurrency(totalAnnual.toFixed(2))}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SalaryRangeViewer
// ---------------------------------------------------------------------------

function SalaryRangeViewer({
  scheduleId,
  active,
}: {
  scheduleId: string;
  active: boolean;
}) {
  const { data: ranges = [], isLoading } = useListSalaryRanges(scheduleId, {
    query: {
      enabled: active,
      queryKey: getListSalaryRangesQueryKey(scheduleId),
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (ranges.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No ranges defined.
      </p>
    );

  const sorted = [...ranges].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="rounded border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-border">
            <TableHead className="border-r border-border text-xs">
              Position
            </TableHead>
            <TableHead className="text-right border-r border-border text-xs text-green-500/80">
              Min
            </TableHead>
            <TableHead className="text-right border-r border-border text-xs text-yellow-500/80">
              Mid
            </TableHead>
            <TableHead className="text-right border-r border-border text-xs text-red-500/80">
              Max
            </TableHead>
            <TableHead className="text-right text-xs">Spread</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => {
            const spread = r.maxSalaryCents - r.minSalaryCents;
            return (
              <TableRow key={r.id} className="border-border hover:bg-muted/20">
                <TableCell className="border-r border-border text-sm py-1.5">
                  {r.positionTitle}
                </TableCell>
                <TableCell className="text-right font-mono text-sm border-r border-border text-green-400 py-1.5">
                  {formatCents(r.minSalaryCents)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm border-r border-border text-yellow-400 py-1.5">
                  {formatCents(r.midSalaryCents)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm border-r border-border text-red-400 py-1.5">
                  {formatCents(r.maxSalaryCents)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground py-1.5">
                  {formatCents(spread)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlatRateViewer
// ---------------------------------------------------------------------------

function FlatRateViewer({
  scheduleId,
  active,
}: {
  scheduleId: string;
  active: boolean;
}) {
  const { data: rates = [], isLoading } = useListFlatRateCategories(
    scheduleId,
    {
      query: {
        enabled: active,
        queryKey: getListFlatRateCategoriesQueryKey(scheduleId),
      },
    }
  );

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (rates.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No flat rates defined.
      </p>
    );

  const sorted = [...rates].sort((a, b) => a.displayOrder - b.displayOrder);
  const total = sorted.reduce((s, r) => s + r.annualAmountCents, 0);

  return (
    <div className="rounded border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-border">
            <TableHead className="border-r border-border text-xs">
              Position
            </TableHead>
            <TableHead className="text-right text-xs">Annual Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.id} className="border-border hover:bg-muted/20">
              <TableCell className="border-r border-border text-sm py-1.5">
                {r.positionTitle}
              </TableCell>
              <TableCell className="text-right font-mono text-sm py-1.5">
                {formatCents(r.annualAmountCents)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end px-3 py-2 border-t border-border bg-muted/20">
        <span className="text-xs text-muted-foreground mr-2">Total:</span>
        <span className="text-xs font-mono font-semibold">
          {formatCents(total)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StipendViewer
// ---------------------------------------------------------------------------

function StipendViewer({
  scheduleId,
  active,
}: {
  scheduleId: string;
  active: boolean;
}) {
  const { data: stipends = [], isLoading } = useListStipendDefinitions(
    scheduleId,
    {
      query: {
        enabled: active,
        queryKey: getListStipendDefinitionsQueryKey(scheduleId),
      },
    }
  );

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (stipends.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No stipends defined.
      </p>
    );

  const sorted = [...stipends]
    .filter((s) => s.active)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="rounded border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-border">
            <TableHead className="border-r border-border text-xs">
              Stipend
            </TableHead>
            <TableHead className="border-r border-border text-xs">
              Category
            </TableHead>
            <TableHead className="text-right border-r border-border text-xs">
              Amount
            </TableHead>
            <TableHead className="text-xs text-center">TRS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((s) => (
            <TableRow key={s.id} className="border-border hover:bg-muted/20">
              <TableCell className="border-r border-border text-sm py-1.5">
                {s.name}
              </TableCell>
              <TableCell className="border-r border-border text-xs text-muted-foreground py-1.5">
                {s.category}
              </TableCell>
              <TableCell className="text-right font-mono text-sm border-r border-border py-1.5">
                {s.amountType === "percentage_of_base"
                  ? `${parseFloat(s.percentageValue ?? "0").toFixed(2)}%`
                  : formatCents(s.amountCents)}
              </TableCell>
              <TableCell className="text-center text-xs py-1.5">
                {s.trsCreditable ? (
                  <span className="text-green-400">✓</span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PerDiemViewer
// ---------------------------------------------------------------------------

function PerDiemViewer({
  scheduleId,
  active,
}: {
  scheduleId: string;
  active: boolean;
}) {
  const { data: config, isLoading } = useGetPerDiemConfig(scheduleId, {
    query: {
      enabled: active,
      queryKey: getGetPerDiemConfigQueryKey(scheduleId),
    },
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!config)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No per diem config. Use Settings to configure.
      </p>
    );

  return (
    <div className="flex items-center gap-6 py-2 text-sm">
      <div>
        <span className="text-xs text-muted-foreground">Contract Days</span>
        <p className="font-mono font-semibold">{config.contractDays}</p>
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Derivation</span>
        <p className="text-sm capitalize">
          {config.derivationMethod.replace(/_/g, " ")}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IndividualSalaryViewer
// ---------------------------------------------------------------------------

function IndividualSalaryViewer({
  groupId,
  active,
}: {
  groupId: string;
  active: boolean;
}) {
  const { districtId } = useDistrictContext();
  const { data, isLoading } = useListEmployees(
    { districtId: districtId!, employeeGroupId: groupId, pageSize: 500 },
    {
      query: {
        enabled: active && !!districtId,
        queryKey: getListEmployeesQueryKey({
          districtId: districtId!,
          employeeGroupId: groupId,
          pageSize: 500,
        }),
      },
    }
  );

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  const employees = data?.employees ?? [];
  if (employees.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        No employees in this group.
      </p>
    );

  const sorted = [...employees].sort(
    (a, b) =>
      parseFloat(b.currentAnnualSalary) - parseFloat(a.currentAnnualSalary)
  );
  const total = sorted.reduce(
    (s, e) => s + parseFloat(e.currentAnnualSalary),
    0
  );
  const avg = total / sorted.length;

  return (
    <div className="rounded border border-border overflow-hidden">
      <div className="max-h-[360px] overflow-y-auto">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow className="border-border">
              <TableHead className="border-r border-border text-xs">
                Employee
              </TableHead>
              <TableHead className="text-right text-xs">
                Annual Salary
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((emp) => (
              <TableRow
                key={emp.id}
                className="border-border hover:bg-muted/20"
              >
                <TableCell className="border-r border-border text-sm py-1.5">
                  {emp.lastName}, {emp.firstName}
                </TableCell>
                <TableCell className="text-right font-mono text-sm py-1.5">
                  {formatCurrency(emp.currentAnnualSalary)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/20 text-xs">
        <span className="text-muted-foreground">
          {sorted.length} employees
        </span>
        <div className="flex gap-4">
          <span>
            Avg:{" "}
            <span className="font-mono">{formatCurrency(avg.toFixed(2))}</span>
          </span>
          <span>
            Total:{" "}
            <span className="font-mono font-semibold">
              {formatCurrency(total.toFixed(2))}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleViewer — dispatches to the right viewer by scheduleType
// ---------------------------------------------------------------------------

function ScheduleViewer({
  schedule,
  groupId,
  active,
}: {
  schedule: CompensationSchedule;
  groupId: string;
  active: boolean;
}) {
  switch (schedule.scheduleType as CompensationScheduleScheduleType) {
    case "index_based_grid":
      return <IndexGridViewer scheduleId={schedule.id} active={active} />;
    case "direct_import_grid":
      return <ImportGridViewer scheduleId={schedule.id} active={active} />;
    case "hourly":
      return (
        <CompHourlyCategoryViewer scheduleId={schedule.id} active={active} />
      );
    case "range_based":
      return <SalaryRangeViewer scheduleId={schedule.id} active={active} />;
    case "flat_rate":
      return <FlatRateViewer scheduleId={schedule.id} active={active} />;
    case "stipend_table":
      return <StipendViewer scheduleId={schedule.id} active={active} />;
    case "per_diem":
      return <PerDiemViewer scheduleId={schedule.id} active={active} />;
    case "individual_salary":
      return <IndividualSalaryViewer groupId={groupId} active={active} />;
    default:
      return (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          No viewer available for this schedule type.
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// ScheduleCard
// ---------------------------------------------------------------------------

function ScheduleCard({
  schedule,
  groupId,
  active,
}: {
  schedule: CompensationSchedule;
  groupId: string;
  active: boolean;
}) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="py-3 px-4 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-sm font-semibold">
            {schedule.name}
          </CardTitle>
          {schedule.isPrimary && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-400"
            >
              Primary
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-border"
          >
            {SCHEDULE_TYPE_LABELS[schedule.scheduleType] ??
              schedule.scheduleType}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0",
              PAY_TYPE_COLORS[schedule.payType] ?? "border-border"
            )}
          >
            {PAY_TYPE_LABELS[schedule.payType] ?? schedule.payType}
          </Badge>
          {schedule.description && (
            <span className="text-xs text-muted-foreground ml-auto">
              {schedule.description}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <ScheduleViewer
          schedule={schedule}
          groupId={groupId}
          active={active}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// GroupSchedulesView
// ---------------------------------------------------------------------------

function GroupSchedulesView({
  group,
  active,
}: {
  group: EmployeeGroupWithSchedules;
  active: boolean;
}) {
  const schedules = [...(group.compensationSchedules ?? [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );

  if (schedules.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No compensation schedules configured for this group.
          <p className="text-xs mt-1">
            Go to Settings → Employee Groups to add a schedule.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {schedules.map((sched) => (
        <ScheduleCard
          key={sched.id}
          schedule={sched}
          groupId={group.id}
          active={active}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SideBySideView
// ---------------------------------------------------------------------------

function SideBySideView({
  groups,
}: {
  groups: EmployeeGroupWithSchedules[];
}) {
  const [leftGroupId, setLeftGroupId] = useState<string>(
    groups[0]?.id ?? ""
  );
  const [rightGroupId, setRightGroupId] = useState<string>(
    groups[1]?.id ?? groups[0]?.id ?? ""
  );

  const leftGroup = groups.find((g) => g.id === leftGroupId);
  const rightGroup = groups.find((g) => g.id === rightGroupId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/30 border border-border rounded-lg">
        <span className="text-xs text-muted-foreground font-medium">
          Left:
        </span>
        <Select value={leftGroupId} onValueChange={setLeftGroupId}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground font-medium">
          Right:
        </span>
        <Select value={rightGroupId} onValueChange={setRightGroupId}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            {leftGroup?.name ?? "—"}
          </h3>
          {leftGroup ? (
            <GroupSchedulesView group={leftGroup} active={true} />
          ) : (
            <p className="text-xs text-muted-foreground">Select a group.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            {rightGroup?.name ?? "—"}
          </h3>
          {rightGroup ? (
            <GroupSchedulesView group={rightGroup} active={true} />
          ) : (
            <p className="text-xs text-muted-foreground">Select a group.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type ViewMode = "single" | "compare";

export default function Schedules() {
  const { districtId } = useDistrictContext();
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  const { data: groups = [], isLoading } = useListEmployeeGroups(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }),
      },
    }
  );

  const activeGroups = useMemo(
    () =>
      [...groups]
        .filter((g) => g.active)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [groups]
  );

  const defaultTab = activeGroups[0]?.id;
  const currentTab = activeTab ?? defaultTab;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Compensation Schedules
          </h1>
          <p className="text-muted-foreground text-sm">
            View all pay schedules by employee group.
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
            <SplitSquareHorizontal className="w-3.5 h-3.5" /> Compare
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : activeGroups.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            No employee groups found. Create groups in Settings first.
          </CardContent>
        </Card>
      ) : viewMode === "compare" ? (
        <SideBySideView groups={activeGroups} />
      ) : (
        <Tabs
          value={currentTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="bg-muted border-border flex-wrap h-auto">
            {activeGroups.map((group) => {
              const types = group.compensationSchedules?.map(
                (s) => s.payType
              ) ?? [];
              const hasHourly = types.includes("hourly");
              const hasPerDiem = types.includes("per_diem");
              return (
                <TabsTrigger
                  key={group.id}
                  value={group.id}
                  className="data-[state=active]:bg-background gap-1.5"
                >
                  {hasHourly ? (
                    <Clock className="w-3 h-3" />
                  ) : hasPerDiem ? (
                    <Clock className="w-3 h-3 text-amber-400" />
                  ) : (
                    <DollarSign className="w-3 h-3" />
                  )}
                  {group.name}
                  {group.compensationSchedules?.length ? (
                    <span className="text-[10px] text-muted-foreground">
                      ({group.compensationSchedules.length})
                    </span>
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {activeGroups.map((group) => (
            <TabsContent
              key={group.id}
              value={group.id}
              className="mt-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-xs font-mono">
                  {group.code}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {group.retirementSystem}
                </span>
                {group.contractDays && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-sm text-muted-foreground">
                      {group.contractDays} contract days
                    </span>
                  </>
                )}
              </div>
              <GroupSchedulesView
                group={group}
                active={currentTab === group.id}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
