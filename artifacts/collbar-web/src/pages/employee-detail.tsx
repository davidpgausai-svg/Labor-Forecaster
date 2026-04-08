import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEmployee,
  getGetEmployeeQueryKey,
  useUpdateEmployee,
  useDiscardPendingChange,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  useListEmployeeGroups,
  getListEmployeeGroupsQueryKey,
  useListSalarySchedules,
  getListSalarySchedulesQueryKey,
  useListImportGridLanes,
  getListImportGridLanesQueryKey,
  useListEmployeePositions,
  getListEmployeePositionsQueryKey,
  useCreateEmployeePosition,
  useUpdateEmployeePosition,
  useDeleteEmployeePosition,
  useGetDistrict,
  getGetDistrictQueryKey,
  type SalaryScheduleWithGrid,
  type EmployeePosition,
  getListScenariosQueryKey,
  getListEmployeesQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getBadgeColorClass } from "@/lib/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, TrendingUp, Pencil, Loader2, Clock, X, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function s(v: unknown): string { return typeof v === "string" ? v : String(v ?? ""); }

export default function EmployeeDetail() {
  const params = useParams();
  const id = params.id as string;
  const { districtId, scenarioId, activeContractYear } = useDistrictContext();
  const [, setLocation] = useLocation();
  const [selectedProjYear, setSelectedProjYear] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "", lastName: "", employeeNumber: "",
    assignType: "union" as "union" | "group",
    bargainingUnitId: "", employeeGroupId: "",
    currentAnnualSalary: "", currentStep: "", currentLaneId: "",
    status: "active",
    editMode: "immediate" as "immediate" | "future",
    effectiveContractYear: "",
  });

  const queryClient = useQueryClient();

  const { data: units } = useListBargainingUnits(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }) } }
  );
  const { data: employeeGroups } = useListEmployeeGroups(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }) } }
  );
  const { data: editSchedule } = useListSalarySchedules(
    { bargainingUnitId: editForm.bargainingUnitId || undefined },
    { query: { enabled: editForm.assignType === "union" && !!editForm.bargainingUnitId, queryKey: getListSalarySchedulesQueryKey({ bargainingUnitId: editForm.bargainingUnitId || undefined }) } }
  );
  const editLanes = ((editSchedule as unknown as SalaryScheduleWithGrid[])?.[0]?.lanes) ?? [];

  // Group assignment: find the primary compensation schedule for the selected group
  const selectedGroupData = (employeeGroups ?? []).find((g) => g.id === editForm.employeeGroupId);
  const primaryCompSchedule = selectedGroupData?.compensationSchedules?.find((s) => s.isPrimary);
  const groupScheduleIsGrid = primaryCompSchedule?.scheduleType === "index_based_grid" || primaryCompSchedule?.scheduleType === "direct_import_grid";
  const { data: groupScheduleLanes = [] } = useListImportGridLanes(
    primaryCompSchedule?.id ?? "",
    {
      query: {
        enabled: editForm.assignType === "group" && groupScheduleIsGrid && !!primaryCompSchedule?.id,
        queryKey: getListImportGridLanesQueryKey(primaryCompSchedule?.id ?? ""),
      },
    }
  );

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(id, { scenarioId: scenarioId || undefined }) });
    queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({ districtId: districtId ?? undefined }) });
    queryClient.invalidateQueries({ queryKey: getListScenariosQueryKey({ districtId: districtId ?? undefined }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey({ districtId: districtId ?? undefined, scenarioId: scenarioId ?? undefined }) });
  }

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        invalidateAll();
        setShowEdit(false);
      },
    },
  });

  const discardMutation = useDiscardPendingChange({
    mutation: {
      onSuccess: () => {
        invalidateAll();
      },
    },
  });

  // ── Positions ──────────────────────────────────────────────────────────────
  const [showPositionDialog, setShowPositionDialog] = useState(false);
  const [editingPosition, setEditingPosition] = useState<EmployeePosition | null>(null);
  const [positionForm, setPositionForm] = useState({
    assignType: "group" as "union" | "group",
    employeeGroupId: "",
    bargainingUnitId: "",
    compensationScheduleId: "",
    jobTitle: "",
    fteFraction: "1.0000",
    currentStep: "",
    currentLaneId: "",
    currentAnnualSalary: "0",
    currentHourlyRate: "",
    annualHours: "",
    isPrimary: false,
    status: "active",
    effectiveDate: "",
    endDate: "",
    displayOrder: 0,
  });

  const { data: positions = [], isLoading: positionsLoading } = useListEmployeePositions(
    id,
    { query: { enabled: !!id, queryKey: getListEmployeePositionsQueryKey(id) } }
  );

  const createPositionMutation = useCreateEmployeePosition({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeePositionsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(id, { scenarioId: scenarioId || undefined }) });
        setShowPositionDialog(false);
      },
    },
  });

  const updatePositionMutation = useUpdateEmployeePosition({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeePositionsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(id, { scenarioId: scenarioId || undefined }) });
        setShowPositionDialog(false);
        setEditingPosition(null);
      },
    },
  });

  const deletePositionMutation = useDeleteEmployeePosition({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeePositionsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(id, { scenarioId: scenarioId || undefined }) });
      },
    },
  });

  // Group/lane lookups for the position dialog
  const selectedPosGroupData = (employeeGroups ?? []).find((g) => g.id === positionForm.employeeGroupId);
  const posGroupSchedules = selectedPosGroupData?.compensationSchedules ?? [];
  // Use the explicitly-selected schedule; fall back to the primary when none selected yet
  const selectedPosSchedule = positionForm.compensationScheduleId
    ? posGroupSchedules.find((cs) => cs.id === positionForm.compensationScheduleId)
    : posGroupSchedules.find((cs) => cs.isPrimary);
  const posScheduleType = selectedPosSchedule?.scheduleType ?? null;
  const posGroupIsGrid = posScheduleType === "index_based_grid" || posScheduleType === "direct_import_grid";
  const { data: posGroupLanes = [] } = useListImportGridLanes(
    selectedPosSchedule?.id ?? "",
    {
      query: {
        enabled: positionForm.assignType === "group" && posGroupIsGrid && !!selectedPosSchedule?.id,
        queryKey: getListImportGridLanesQueryKey(selectedPosSchedule?.id ?? ""),
      },
    }
  );
  // For union-path positions: fetch the BU's salary schedule to know if it has lanes
  const { data: posUnionScheduleData } = useListSalarySchedules(
    { bargainingUnitId: positionForm.bargainingUnitId || undefined },
    {
      query: {
        enabled: positionForm.assignType === "union" && !!positionForm.bargainingUnitId,
        queryKey: getListSalarySchedulesQueryKey({ bargainingUnitId: positionForm.bargainingUnitId || undefined }),
      },
    }
  );
  const posUnionLanes = ((posUnionScheduleData as unknown as SalaryScheduleWithGrid[])?.[0]?.lanes) ?? [];

  // Derived field-visibility for the position dialog
  const posHasAssignment = positionForm.assignType === "group"
    ? !!positionForm.employeeGroupId
    : !!positionForm.bargainingUnitId;
  const posShowStep = posHasAssignment && (positionForm.assignType === "union" || posGroupIsGrid);
  const posShowLane = posHasAssignment && (
    (positionForm.assignType === "union" && posUnionLanes.length > 0) ||
    (posGroupIsGrid && posGroupLanes.length > 0)
  );
  const posShowSalary = posHasAssignment && (
    (positionForm.assignType === "union" && posUnionLanes.length === 0) ||
    posScheduleType === "individual_salary" ||
    posScheduleType === "range_based" ||
    (positionForm.assignType === "group" && posScheduleType === null)
  );
  const posShowHourly = posHasAssignment && posScheduleType === "hourly";
  const posPlacementNote = !posHasAssignment
    ? "Select an assignment above to configure placement fields."
    : posScheduleType === "per_diem"
    ? "Rate is driven by the per-diem schedule — no manual entry needed."
    : posScheduleType === "flat_rate"
    ? "Rate is driven by the flat-rate schedule — no manual entry needed."
    : posScheduleType === "stipend_table"
    ? "Stipend amounts are driven by schedule configuration."
    : null;

  function openAddPosition() {
    setEditingPosition(null);
    const hasPrimary = positions.some((p) => p.isPrimary);
    setPositionForm({
      assignType: "group",
      employeeGroupId: "",
      bargainingUnitId: "",
      compensationScheduleId: "",
      jobTitle: "",
      fteFraction: "1.0000",
      currentStep: "",
      currentLaneId: "",
      currentAnnualSalary: "0",
      currentHourlyRate: "",
      annualHours: "",
      isPrimary: !hasPrimary,
      status: "active",
      effectiveDate: "",
      endDate: "",
      displayOrder: positions.length,
    });
    setShowPositionDialog(true);
  }

  function openEditPosition(pos: EmployeePosition) {
    setEditingPosition(pos);
    setPositionForm({
      assignType: pos.employeeGroupId ? "group" : "union",
      employeeGroupId: pos.employeeGroupId ?? "",
      bargainingUnitId: pos.bargainingUnitId ?? "",
      compensationScheduleId: pos.compensationScheduleId ?? "",
      jobTitle: pos.jobTitle ?? "",
      fteFraction: pos.fteFraction ?? "1.0000",
      currentStep: pos.currentStep != null ? String(pos.currentStep) : "",
      currentLaneId: pos.currentLaneId ?? "",
      currentAnnualSalary: pos.currentAnnualSalary ?? "0",
      currentHourlyRate: pos.currentHourlyRate ?? "",
      annualHours: pos.annualHours ?? "",
      isPrimary: pos.isPrimary,
      status: pos.status ?? "active",
      effectiveDate: pos.effectiveDate ?? "",
      endDate: pos.endDate ?? "",
      displayOrder: pos.displayOrder ?? 0,
    });
    setShowPositionDialog(true);
  }

  function handleSavePosition() {
    const body = {
      employeeGroupId: positionForm.assignType === "group" ? (positionForm.employeeGroupId || null) : null,
      bargainingUnitId: positionForm.assignType === "union" ? (positionForm.bargainingUnitId || null) : null,
      compensationScheduleId: positionForm.compensationScheduleId || null,
      jobTitle: positionForm.jobTitle || null,
      fteFraction: positionForm.fteFraction || "1.0000",
      currentStep: positionForm.currentStep ? parseInt(positionForm.currentStep, 10) : null,
      currentLaneId: positionForm.currentLaneId || null,
      currentAnnualSalary: positionForm.currentAnnualSalary || "0",
      currentHourlyRate: positionForm.currentHourlyRate || null,
      annualHours: positionForm.annualHours || null,
      isPrimary: positionForm.isPrimary,
      status: positionForm.status,
      effectiveDate: positionForm.effectiveDate || null,
      endDate: positionForm.endDate || null,
      displayOrder: positionForm.displayOrder,
    };

    if (editingPosition) {
      updatePositionMutation.mutate({ id: editingPosition.id, data: body });
    } else {
      createPositionMutation.mutate({ id, data: body });
    }
  }

  const { data: emp, isLoading } = useGetEmployee(
    id,
    { scenarioId: scenarioId || undefined },
    {
      query: {
        enabled: !!id,
        queryKey: getGetEmployeeQueryKey(id, { scenarioId: scenarioId || undefined }),
      },
    }
  );

  const { data: district } = useGetDistrict(
    districtId!,
    { query: { enabled: !!districtId, queryKey: getGetDistrictQueryKey(districtId!) } }
  );
  const benefitFteThreshold = parseFloat(String(district?.benefitEligibleFteThreshold ?? "0.75"));

  function openEdit() {
    if (!emp) return;
    const e = emp as unknown as Record<string, unknown>;
    const hasGroup = !!(e.employeeGroupId);
    setEditForm({
      firstName: emp.firstName ?? "",
      lastName: emp.lastName ?? "",
      employeeNumber: emp.employeeNumber ?? "",
      assignType: hasGroup ? "group" : "union",
      bargainingUnitId: emp.bargainingUnitId ?? "",
      employeeGroupId: String(e.employeeGroupId ?? ""),
      currentAnnualSalary: String(emp.currentAnnualSalary ?? ""),
      currentStep: emp.currentStep != null ? String(emp.currentStep) : "",
      currentLaneId: String(e.currentLaneId ?? ""),
      status: emp.status ?? "active",
      editMode: "immediate",
      effectiveContractYear: "",
    });
    setShowEdit(true);
  }

  function handleSaveEdit() {
    const body: Record<string, unknown> = {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      status: editForm.status,
      currentAnnualSalary: parseFloat(editForm.currentAnnualSalary) || 0,
    };
    if (editForm.employeeNumber) body.employeeNumber = editForm.employeeNumber;
    if (editForm.assignType === "union") {
      body.bargainingUnitId = editForm.bargainingUnitId || null;
      body.employeeGroupId = null;
      if (editForm.currentStep) body.currentStep = parseInt(editForm.currentStep, 10);
      if (editForm.currentLaneId) body.currentLaneId = editForm.currentLaneId;
    } else {
      body.employeeGroupId = editForm.employeeGroupId || null;
      // Do NOT include bargainingUnitId for group assignments — the live BU is preserved on the DB side
      if (editForm.currentStep) body.currentStep = parseInt(editForm.currentStep, 10);
      if (editForm.currentLaneId) body.currentLaneId = editForm.currentLaneId;
    }
    if (editForm.editMode === "future" && editForm.effectiveContractYear) {
      body.effectiveContractYear = parseInt(editForm.effectiveContractYear, 10);
    }
    updateMutation.mutate({ id, data: body as Parameters<typeof updateMutation.mutate>[0]["data"] });
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Employee not found.
      </div>
    );
  }

  const projections = (emp.yearProjections ?? []) as unknown as Array<Record<string, unknown>>;
  const empAny = emp as unknown as Record<string, unknown>;

  // Use selected projection year, fall back to active header year, then first year
  const effectiveProjYear = selectedProjYear
    ?? (activeContractYear !== null && projections.some((p) => Number(p.contractYear) === activeContractYear) ? activeContractYear : null)
    ?? (projections[0] ? Number(projections[0].contractYear) : null);

  const activeProjRow = projections.find((p) => Number(p.contractYear) === effectiveProjYear);

  const hasProjections = projections.length > 0;
  const hasStepData = projections.some((p) => p.projectedStep !== null && p.projectedStep !== undefined);
  const hasLaneData = projections.some((p) => p.projectedLaneName !== null && p.projectedLaneName !== undefined);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-4">

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/employees")}
          className="mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">
              {emp.firstName} {emp.lastName}
            </h1>
            <Badge
              variant="outline"
              className={getBadgeColorClass(emp.bargainingUnitName || "")}
            >
              {emp.bargainingUnitName || "Unknown Unit"}
            </Badge>
            {!!empAny.employeeGroupName && (
              <Badge
                variant="outline"
                className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs"
                title="Scenario calculations use this employee group config"
              >
                {String(empAny.employeeGroupName)} · Group
              </Badge>
            )}
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-500 border-green-500/20 capitalize"
            >
              {emp.status}
            </Badge>
            {emp.retirementEligible && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-500 border-amber-500/20"
              >
                Retirement Eligible
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={openEdit}
          className="shrink-0 gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit Profile
        </Button>
      </div>

      {/* Pending position change banner */}
      {empAny.pendingEffectiveContractYear != null && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-300">
              Pending position change effective{" "}
              {projections.find((p) => Number(p.contractYear) === empAny.pendingEffectiveContractYear)
                ? s(projections.find((p) => Number(p.contractYear) === empAny.pendingEffectiveContractYear)!.yearLabel)
                : `Contract Year ${String(empAny.pendingEffectiveContractYear)}`}
            </div>
            <div className="text-xs text-amber-400/80 mt-0.5 space-x-3">
              {empAny.pendingCurrentStep != null && (
                <span>Step {String(empAny.pendingCurrentStep)}</span>
              )}
              {empAny.pendingAnnualSalary != null && (
                <span>{formatCurrency(String(empAny.pendingAnnualSalary))}</span>
              )}
              <span className="text-amber-500/60">· Year 0 uses current state; this effective year onward uses new position</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => discardMutation.mutate({ id })}
            disabled={discardMutation.isPending}
            className="shrink-0 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 gap-1.5"
          >
            {discardMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Discard
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/40">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">
            Positions
            {positions.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs w-4 h-4 font-mono">
                {positions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="retirement">Retirement & Taxes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle>
              {scenarioId ? "Scenario Projection by Year" : "5-Year Cost Projection"}
            </CardTitle>
            {hasProjections && empAny.compensationScheduleType === "individual_salary" ? (
              <p className="text-xs text-amber-400/80 mt-1">
                Individual salary — this employee's pay is driven by the configured increase %, not by schedule cell lookup. Step shown is for reference tracking only.
              </p>
            ) : hasProjections && hasStepData ? (
              <p className="text-xs text-muted-foreground mt-1">
                Click a row to pin details in the profile panel. Step advancement is reflected per contract year.
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead>Year</TableHead>
                  {hasStepData && <TableHead className="text-center">Step</TableHead>}
                  {hasLaneData && <TableHead>Lane</TableHead>}
                  <TableHead className="text-right">Base Salary</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Effective Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hasProjections ? (
                  projections.flatMap((proj, i) => {
                    const cy = Number(proj.contractYear);
                    const isActive = cy === effectiveProjYear;
                    const prevProj = i > 0 ? projections[i - 1] : null;
                    const stepAdvanced = prevProj !== null
                      && proj.projectedStep !== null
                      && prevProj.projectedStep !== null
                      && Number(proj.projectedStep) > Number(prevProj.projectedStep);
                    const pendingEffectiveYear = Number(empAny.pendingEffectiveContractYear ?? -1);
                    const isPendingBoundary = pendingEffectiveYear > 0 && cy === pendingEffectiveYear;

                    const row = (
                      <TableRow
                        key={i}
                        className={cn(
                          "border-border cursor-pointer transition-colors",
                          isActive ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-muted/30",
                          isPendingBoundary ? "border-t-2 border-t-amber-500/50" : ""
                        )}
                        onClick={() => setSelectedProjYear(cy === selectedProjYear ? null : cy)}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {s(proj.yearLabel)}
                            {isPendingBoundary && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5 font-normal">
                                <Clock className="w-2.5 h-2.5" /> New Position
                              </span>
                            )}
                          </span>
                        </TableCell>
                        {hasStepData && (
                          <TableCell className="text-center">
                            {proj.projectedStep !== null && proj.projectedStep !== undefined ? (
                              <span className={cn(
                                "inline-flex items-center gap-1 font-mono text-sm font-semibold",
                                stepAdvanced ? "text-green-400" : ""
                              )}>
                                {stepAdvanced && <TrendingUp className="w-3 h-3" />}
                                {s(proj.projectedStep)}
                              </span>
                            ) : "—"}
                          </TableCell>
                        )}
                        {hasLaneData && (
                          <TableCell className="text-sm text-muted-foreground">
                            {s(proj.projectedLaneName) || "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono">
                          {proj.projectedBaseSalaryCents
                            ? formatCurrency(String(Number(proj.projectedBaseSalaryCents) / 100))
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {proj.totalEmployerCostCents
                            ? formatCurrency(String(Number(proj.totalEmployerCostCents) / 100))
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {proj.effectiveRate ? formatPercent(s(proj.effectiveRate)) : "—"}
                        </TableCell>
                      </TableRow>
                    );

                    return [row];
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {scenarioId
                        ? "No projection data found. Run Calculate on the scenario first."
                        : "Select a scenario from the header to view projections."}
                    </TableCell>
                  </TableRow>
                )}
                {hasProjections && (
                  <TableRow className="border-t border-border bg-muted/20">
                    <TableCell className="font-semibold text-sm" colSpan={hasStepData && hasLaneData ? 3 : hasStepData || hasLaneData ? 2 : 1}>
                      Total
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {formatCurrency(String(
                        projections.reduce((sum, p) => sum + (Number(p.totalEmployerCostCents) || 0) / 100, 0)
                      ))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>
              {activeProjRow ? (
                <span className="flex items-center gap-2">
                  {s(activeProjRow.yearLabel)}
                  <span className="text-xs font-normal text-muted-foreground">Projected</span>
                </span>
              ) : "Profile Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeProjRow ? (
              <>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Projected Salary
                  </div>
                  <div className="font-mono font-bold text-xl">
                    {activeProjRow.projectedBaseSalaryCents
                      ? formatCurrency(String(Number(activeProjRow.projectedBaseSalaryCents) / 100))
                      : "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Step
                    </div>
                    <div className="font-medium font-mono">
                      {activeProjRow.projectedStep !== null && activeProjRow.projectedStep !== undefined
                        ? s(activeProjRow.projectedStep)
                        : (emp.currentStep || "—")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Lane
                    </div>
                    <div className="font-medium">
                      {s(activeProjRow.projectedLaneName) || emp.laneName || "—"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Total Cost
                    </div>
                    <div className="font-mono font-semibold text-primary">
                      {activeProjRow.totalEmployerCostCents
                        ? formatCurrency(String(Number(activeProjRow.totalEmployerCostCents) / 100))
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Eff. Rate
                    </div>
                    <div className="font-mono text-muted-foreground">
                      {activeProjRow.effectiveRate ? formatPercent(s(activeProjRow.effectiveRate)) : "—"}
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/50 pt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Retirement
                    </div>
                    <div className="font-mono">
                      {activeProjRow.retirementContributionCents
                        ? formatCurrency(String(Number(activeProjRow.retirementContributionCents) / 100))
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      FICA
                    </div>
                    <div className="font-mono">
                      {activeProjRow.ficaCostCents
                        ? formatCurrency(String(Number(activeProjRow.ficaCostCents) / 100))
                        : "—"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Health
                    </div>
                    <div className="font-mono">
                      {activeProjRow.healthInsuranceCostCents
                        ? formatCurrency(String(Number(activeProjRow.healthInsuranceCostCents) / 100))
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Other Benefits
                    </div>
                    <div className="font-mono">
                      {activeProjRow.otherBenefitsCostCents
                        ? formatCurrency(String(Number(activeProjRow.otherBenefitsCostCents) / 100))
                        : "—"}
                    </div>
                  </div>
                </div>
                <div className="border-t border-border/50 pt-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                    Baseline (Current)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Salary: {formatCurrency(emp.currentAnnualSalary)}</span>
                    <span>Step: {emp.currentStep ?? "—"} / {emp.laneName ?? "—"}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Current Salary
                  </div>
                  <div className="font-mono font-bold text-xl">
                    {formatCurrency(emp.currentAnnualSalary)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Step
                    </div>
                    <div className="font-medium">{emp.currentStep || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Lane
                    </div>
                    <div className="font-medium">{emp.laneName || "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Insurance Election
                  </div>
                  <div className="font-medium capitalize">
                    {emp.insuranceElection || "—"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Yrs in District
                    </div>
                    <div className="font-medium">{emp.yearsInDistrict ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Total Service
                    </div>
                    <div className="font-medium">{emp.yearsTotalService ?? "—"}</div>
                  </div>
                </div>
                {emp.employeeNumber && (
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      Employee #
                    </div>
                    <div className="font-mono text-sm">{emp.employeeNumber}</div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="positions" className="mt-6">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Positions</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Each position can have its own group, FTE, compensation schedule, step, and lane.
                </p>
              </div>
              <Button size="sm" onClick={openAddPosition} className="shrink-0 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Position
              </Button>
            </CardHeader>
            <CardContent>
              {positionsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
                  <p>No positions defined yet.</p>
                  <p className="text-xs">This employee uses the legacy single-position model. Add a position to enable multi-position HCM.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                      <TableHead>Job Title / Group</TableHead>
                      <TableHead className="text-center">FTE</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="text-center">Step / Lane</TableHead>
                      <TableHead className="text-right">Salary</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos) => {
                      const group = (employeeGroups ?? []).find((g) => g.id === pos.employeeGroupId);
                      const unit = (units ?? []).find((u) => u.id === pos.bargainingUnitId);
                      const groupSched = group?.compensationSchedules?.find((s) => s.isPrimary);
                      return (
                        <TableRow key={pos.id} className="border-border">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {pos.isPrimary && (
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" aria-label="Primary position" />
                              )}
                              <div>
                                <div className="font-medium text-sm">
                                  {pos.jobTitle || (group?.name ?? unit?.name ?? "—")}
                                </div>
                                {pos.jobTitle && (group || unit) && (
                                  <div className="text-xs text-muted-foreground">
                                    {group?.name ?? unit?.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {parseFloat(pos.fteFraction).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {groupSched?.scheduleType?.replace(/_/g, " ") ?? "—"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {pos.currentStep != null ? `${pos.currentStep}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatCurrency(pos.currentAnnualSalary)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs capitalize",
                                pos.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                                pos.status === "on_leave" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                "bg-muted text-muted-foreground"
                              )}
                            >
                              {pos.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditPosition(pos)}
                                className="h-7 w-7 p-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Delete this position? This cannot be undone.`)) {
                                    deletePositionMutation.mutate({ id: pos.id });
                                  }
                                }}
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                disabled={deletePositionMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Benefits ────────────────────────────────────────────────────── */}
        <TabsContent value="benefits" className="mt-6 space-y-6">
          {/* Eligibility summary card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Benefit Eligibility</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const firstYear = projections[0] as Record<string, unknown> | undefined;
                const hasMultiPos = firstYear && firstYear.totalFteFraction != null;
                const totalFte = hasMultiPos ? parseFloat(String(firstYear!.totalFteFraction)) : null;
                const eligible = hasMultiPos ? !!(firstYear!.benefitEligible) : true;
                const insuranceLabel: Record<string, string> = {
                  single: "Single",
                  single_plus_spouse: "Single + Spouse",
                  single_plus_child: "Single + Child",
                  family: "Family",
                  waived: "Waived",
                };
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Insurance Election</p>
                      <p className="text-sm font-medium">{insuranceLabel[emp.insuranceElection ?? ""] ?? emp.insuranceElection ?? "—"}</p>
                    </div>
                    {hasMultiPos && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Total FTE</p>
                        <p className="text-sm font-mono font-medium">{totalFte?.toFixed(4) ?? "—"}</p>
                      </div>
                    )}
                    {hasMultiPos && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Threshold</p>
                        <p className="text-sm font-mono font-medium">{benefitFteThreshold.toFixed(4)}</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Employer Benefits</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          eligible
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        )}
                      >
                        {eligible ? "Eligible" : "Not Eligible"}
                      </Badge>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Year-by-year benefits table */}
          {hasProjections && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Projected Benefits by Year</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Health Insurance</TableHead>
                      <TableHead className="text-right">Other Benefits</TableHead>
                      <TableHead className="text-right">Total Benefits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projections.map((proj, i) => {
                      const healthCents = Number(proj.healthInsuranceCostCents ?? 0);
                      const otherCents = Number(proj.otherBenefitsCostCents ?? 0);
                      const totalCents = healthCents + otherCents;
                      return (
                        <TableRow key={i} className="border-border">
                          <TableCell className="text-sm">{s(proj.yearLabel ?? `Year ${proj.contractYear}`)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency((healthCents / 100).toFixed(2))}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency((otherCents / 100).toFixed(2))}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency((totalCents / 100).toFixed(2))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Retirement & Taxes ──────────────────────────────────────────── */}
        <TabsContent value="retirement" className="mt-6 space-y-6">
          {/* Profile summary */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Retirement Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Retirement System</p>
                  <p className="text-sm font-medium">{s(empAny.retirementSystem ?? empAny.bargainingUnitRetirementSystem ?? "—")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Years in District</p>
                  <p className="text-sm font-mono font-medium">{emp.yearsInDistrict ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Service Years</p>
                  <p className="text-sm font-mono font-medium">{emp.yearsTotalService ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">FICA Status</p>
                  <Badge
                    variant="outline"
                    className="text-xs bg-muted/40 text-muted-foreground border-border"
                  >
                    {emp.retirementEligible ? "FICA-Exempt (TRS)" : "FICA Liable"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Year-by-year taxes table */}
          {hasProjections && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Projected Retirement &amp; Taxes by Year</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border">
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Retirement Contribution</TableHead>
                      <TableHead className="text-right">FICA / Medicare</TableHead>
                      <TableHead className="text-right">Combined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projections.map((proj, i) => {
                      const retCents = Number(proj.retirementContributionCents ?? 0);
                      const ficaCents = Number(proj.ficaCostCents ?? 0);
                      const combinedCents = retCents + ficaCents;
                      return (
                        <TableRow key={i} className="border-border">
                          <TableCell className="text-sm">{s(proj.yearLabel ?? `Year ${proj.contractYear}`)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency((retCents / 100).toFixed(2))}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency((ficaCents / 100).toFixed(2))}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency((combinedCents / 100).toFixed(2))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Retirement incentive options */}
          {emp.retirementEligible && Boolean(empAny.retirementOptions) && (() => {
            const opts = empAny.retirementOptions as Record<string, Record<string, unknown>>;
            return (
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Retirement Incentive Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Option 1 — 4-Year */}
                  {opts.option1 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Option 1</span>
                        <span className="text-sm font-medium">4-Year Salary Escalator</span>
                        {!Boolean(opts.option1.eligible) && (
                          <Badge variant="outline" className="text-xs bg-muted/40 text-muted-foreground border-border">Not Eligible</Badge>
                        )}
                        {Boolean(opts.option1.trsCapWarning) && (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                            <AlertTriangle className="w-3 h-3 mr-1" />TRS Cap Risk
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        {["year1Salary", "year2Salary", "year3Salary", "year4Salary"].map((key, yi) => (
                          <div key={key} className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Year {yi + 1}</p>
                            <p className="font-mono font-medium">{formatCurrency(s(opts.option1[key]))}</p>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total salary cost: <span className="font-mono text-foreground">{formatCurrency(s(opts.option1.totalSalaryCost))}</span>
                      </div>
                    </div>
                  )}

                  {/* Option 2 — 2-Year */}
                  {opts.option2 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Option 2</span>
                        <span className="text-sm font-medium">2-Year + Post-Retirement Package</span>
                        {!Boolean(opts.option2.eligible) && (
                          <Badge variant="outline" className="text-xs bg-muted/40 text-muted-foreground border-border">Not Eligible</Badge>
                        )}
                        {Boolean(opts.option2.trsCapWarning) && (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                            <AlertTriangle className="w-3 h-3 mr-1" />TRS Cap Risk
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">Year 1</p>
                          <p className="font-mono font-medium">{formatCurrency(s(opts.option2.year1Salary))}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">Year 2</p>
                          <p className="font-mono font-medium">{formatCurrency(s(opts.option2.year2Salary))}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">Post-Ret. Service</p>
                          <p className="font-mono font-medium">{formatCurrency(s(opts.option2.postRetirementServiceBonus))}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">Post-Ret. Insurance</p>
                          <p className="font-mono font-medium">{formatCurrency(s(opts.option2.postRetirementInsuranceBonus))}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total cost to district: <span className="font-mono text-foreground">{formatCurrency(s(opts.option2.totalCostToDistrict))}</span>
                      </div>
                    </div>
                  )}

                  {/* Option 3 — Longevity */}
                  {opts.option3 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Option 3</span>
                        <span className="text-sm font-medium">Longevity Bonus</span>
                        {!Boolean(opts.option3.eligible) && (
                          <Badge variant="outline" className="text-xs bg-muted/40 text-muted-foreground border-border">Not Eligible</Badge>
                        )}
                        {Boolean(opts.option3.trsCapWarning) && (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                            <AlertTriangle className="w-3 h-3 mr-1" />TRS Cap Risk
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">Years in District</p>
                          <p className="font-mono font-medium">{s(opts.option3.yearsInDistrict)}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">Longevity Bonus</p>
                          <p className="font-mono font-medium">{formatCurrency(s(opts.option3.longevityBonus))}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">Salary with Bonus</p>
                          <p className="font-mono font-medium">{formatCurrency(s(opts.option3.salaryWithBonus))}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>
      </Tabs>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Effective From selector */}
            <div className="space-y-1.5">
              <Label>Effective From</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editForm.editMode === "immediate" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditForm((f) => ({ ...f, editMode: "immediate", effectiveContractYear: "" }))}
                >
                  This fiscal year — correct current record
                </Button>
                <Button
                  type="button"
                  variant={editForm.editMode === "future" ? "default" : "outline"}
                  size="sm"
                  disabled={projections.length <= 1}
                  onClick={() => setEditForm((f) => ({ ...f, editMode: "future", effectiveContractYear: projections.length > 1 ? String(projections[1].contractYear) : "" }))}
                >
                  Future fiscal year
                </Button>
              </div>
              {editForm.editMode === "future" && projections.length > 1 && (
                <Select
                  value={editForm.effectiveContractYear}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, effectiveContractYear: v }))}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select effective year…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projections.slice(1).map((p) => (
                      <SelectItem key={String(p.contractYear)} value={String(p.contractYear)}>
                        {s(p.yearLabel)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {editForm.editMode === "future" && (
                <p className="text-xs text-amber-400/80">
                  {positions.length > 0
                    ? "Current year stays unchanged. BU/group transition takes effect from the selected year; update salary placement in the Positions tab after the change."
                    : "Current year stays unchanged. Position fields below apply from the selected year onward."}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Employee Number (optional)</Label>
              <Input
                value={editForm.employeeNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, employeeNumber: e.target.value }))}
                className="bg-background border-border"
                placeholder="e.g. EMP-0042"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editForm.assignType === "group" ? (
              <div className="space-y-1.5">
                <Label>Employee Group</Label>
                <Select
                  value={editForm.employeeGroupId}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, employeeGroupId: v, currentLaneId: "" }))}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select group…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employeeGroups ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Bargaining Unit</Label>
                <Select
                  value={editForm.bargainingUnitId}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, bargainingUnitId: v, currentLaneId: "" }))}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select unit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(units ?? []).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {positions.length === 0 && editForm.assignType === "union" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Current Step</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.currentStep}
                    onChange={(e) => setEditForm((f) => ({ ...f, currentStep: e.target.value }))}
                    className="bg-background border-border"
                    placeholder="e.g. 7"
                  />
                </div>
                {editLanes.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Lane</Label>
                    <Select
                      value={editForm.currentLaneId}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, currentLaneId: v }))}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select lane…" />
                      </SelectTrigger>
                      <SelectContent>
                        {editLanes.map((lane) => (
                          <SelectItem key={lane.id} value={lane.id}>{lane.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {positions.length === 0 && editForm.assignType === "group" && groupScheduleIsGrid && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Current Step</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editForm.currentStep}
                    onChange={(e) => setEditForm((f) => ({ ...f, currentStep: e.target.value }))}
                    className="bg-background border-border"
                    placeholder="e.g. 7"
                  />
                </div>
                {groupScheduleLanes.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Lane</Label>
                    <Select
                      value={editForm.currentLaneId}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, currentLaneId: v }))}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select lane…" />
                      </SelectTrigger>
                      <SelectContent>
                        {groupScheduleLanes
                          .slice()
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((lane) => (
                            <SelectItem key={lane.id} value={lane.id}>{lane.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {positions.length === 0 && !(editForm.assignType === "union" && editLanes.length > 0) ? (
              <div className="space-y-1.5">
                <Label>Annual Salary</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={editForm.currentAnnualSalary}
                    onChange={(e) => setEditForm((f) => ({ ...f, currentAnnualSalary: e.target.value }))}
                    className="bg-background border-border pl-7"
                    placeholder="0"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/20">
                Salary placement is managed via the <strong>Positions tab</strong>.
              </p>
            )}
          </div>

          {updateMutation.isError && (
            <div className="flex items-center gap-2 text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2 mt-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {(updateMutation.error as { message?: string })?.message ?? "Save failed. Please try again."}
              </span>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setShowEdit(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving & Recalculating…
                </>
              ) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Add/Edit Dialog */}
      <Dialog open={showPositionDialog} onOpenChange={(open) => { setShowPositionDialog(open); if (!open) setEditingPosition(null); }}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>{editingPosition ? "Edit Position" : "Add Position"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Job Title */}
            <div className="space-y-1.5">
              <Label>Job Title (optional)</Label>
              <Input
                value={positionForm.jobTitle}
                onChange={(e) => setPositionForm((f) => ({ ...f, jobTitle: e.target.value }))}
                className="bg-background border-border"
                placeholder="e.g. Math Teacher, Head Coach"
              />
            </div>

            {/* Assignment type toggle */}
            <div className="space-y-1.5">
              <Label>Assignment Type</Label>
              <div className="flex gap-2">
                <Button type="button" variant={positionForm.assignType === "group" ? "default" : "outline"} size="sm"
                  onClick={() => setPositionForm((f) => ({ ...f, assignType: "group", bargainingUnitId: "", currentStep: "", currentLaneId: "" }))}>
                  Employee Group
                </Button>
                <Button type="button" variant={positionForm.assignType === "union" ? "default" : "outline"} size="sm"
                  onClick={() => setPositionForm((f) => ({ ...f, assignType: "union", employeeGroupId: "", currentLaneId: "" }))}>
                  Bargaining Unit
                </Button>
              </div>
            </div>

            {/* Group or BU selector */}
            {positionForm.assignType === "group" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Employee Group</Label>
                  <Select
                    value={positionForm.employeeGroupId}
                    onValueChange={(v) => {
                      const grp = (employeeGroups ?? []).find((g) => g.id === v);
                      const primary = grp?.compensationSchedules?.find((cs) => cs.isPrimary);
                      setPositionForm((f) => ({ ...f, employeeGroupId: v, compensationScheduleId: primary?.id ?? "", currentLaneId: "", currentStep: "" }));
                    }}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select group…" />
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
                </div>

                {posGroupSchedules.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Compensation Schedule</Label>
                    <Select
                      value={positionForm.compensationScheduleId}
                      onValueChange={(v) => setPositionForm((f) => ({ ...f, compensationScheduleId: v, currentLaneId: "", currentStep: "" }))}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select schedule…" />
                      </SelectTrigger>
                      <SelectContent>
                        {posGroupSchedules.map((cs) => (
                          <SelectItem key={cs.id} value={cs.id}>
                            {cs.name}
                            <span className="ml-1.5 text-xs text-muted-foreground">({cs.scheduleType.replace(/_/g, " ")})</span>
                            {cs.isPrimary && <span className="ml-1 text-xs text-primary"> · primary</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Bargaining Unit</Label>
                  <Select
                    value={positionForm.bargainingUnitId}
                    onValueChange={(v) => setPositionForm((f) => ({ ...f, bargainingUnitId: v, currentLaneId: "" }))}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Select unit…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(units ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {positionForm.bargainingUnitId && (
                  <div className="space-y-1.5">
                    <Label>Salary Schedule</Label>
                    {(() => {
                      const schedules = (posUnionScheduleData as unknown as SalaryScheduleWithGrid[]) ?? [];
                      if (schedules.length === 0) {
                        return (
                          <p className="text-xs text-amber-400 border border-amber-500/30 rounded-md px-3 py-2 bg-amber-500/10">
                            No salary schedule configured for this bargaining unit.
                          </p>
                        );
                      }
                      if (schedules.length === 1) {
                        return (
                          <div className="text-sm px-3 py-2 rounded-md border border-border bg-muted/20 text-muted-foreground">
                            {schedules[0].name}
                            <span className="ml-2 text-xs">
                              {posUnionLanes.length > 0 ? `${posUnionLanes.length} lanes · step/lane grid` : "step-only"}
                            </span>
                          </div>
                        );
                      }
                      // Multiple schedules — let the user pick
                      return (
                        <Select
                          value={positionForm.compensationScheduleId}
                          onValueChange={(v) => setPositionForm((f) => ({ ...f, compensationScheduleId: v, currentLaneId: "" }))}
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue placeholder="Select salary schedule…" />
                          </SelectTrigger>
                          <SelectContent>
                            {schedules.map((sc) => (
                              <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {/* FTE — always shown */}
            <div className="space-y-1.5">
              <Label>FTE Fraction</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                max="1"
                value={positionForm.fteFraction}
                onChange={(e) => setPositionForm((f) => ({ ...f, fteFraction: e.target.value }))}
                className="bg-background border-border"
              />
            </div>

            {/* Schedule-driven placement fields */}
            {!posHasAssignment && (
              <p className="text-xs text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/20">
                Select an assignment above to configure salary placement fields.
              </p>
            )}

            {posPlacementNote && posHasAssignment && (
              <p className="text-xs text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/20">
                {posPlacementNote}
              </p>
            )}

            {/* Step + Lane (grid-based: index, direct-import, union with lanes) */}
            {(posShowStep || posShowLane) && (
              <div className="grid grid-cols-2 gap-4">
                {posShowStep && (
                  <div className="space-y-1.5">
                    <Label>Step</Label>
                    <Input
                      type="number"
                      min={1}
                      value={positionForm.currentStep}
                      onChange={(e) => setPositionForm((f) => ({ ...f, currentStep: e.target.value }))}
                      className="bg-background border-border"
                      placeholder="e.g. 7"
                    />
                  </div>
                )}
                {posShowLane && (
                  <div className="space-y-1.5">
                    <Label>Lane</Label>
                    <Select
                      value={positionForm.currentLaneId}
                      onValueChange={(v) => setPositionForm((f) => ({ ...f, currentLaneId: v }))}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Select lane…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(positionForm.assignType === "union" ? posUnionLanes : posGroupLanes)
                          .slice()
                          .sort((a, b) => a.displayOrder - b.displayOrder)
                          .map((lane) => (
                            <SelectItem key={lane.id} value={lane.id}>{lane.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Annual Salary (individual_salary, range_based, union, no-schedule fallback) */}
            {posShowSalary && (
              <div className="space-y-1.5">
                <Label>
                  Annual Salary
                  {posScheduleType === "range_based" && (
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">— will be matched to the nearest salary range</span>
                  )}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={positionForm.currentAnnualSalary}
                    onChange={(e) => setPositionForm((f) => ({ ...f, currentAnnualSalary: e.target.value }))}
                    className="bg-background border-border pl-7"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* Hourly Rate + Annual Hours */}
            {posShowHourly && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Hourly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={positionForm.currentHourlyRate}
                      onChange={(e) => setPositionForm((f) => ({ ...f, currentHourlyRate: e.target.value }))}
                      className="bg-background border-border pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Annual Hours</Label>
                  <Input
                    type="number"
                    value={positionForm.annualHours}
                    onChange={(e) => setPositionForm((f) => ({ ...f, annualHours: e.target.value }))}
                    className="bg-background border-border"
                    placeholder="e.g. 1800"
                  />
                </div>
              </div>
            )}

            {/* Status + Primary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={positionForm.status}
                  onValueChange={(v) => setPositionForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={positionForm.isPrimary}
                    onChange={(e) => setPositionForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Primary position</span>
                </label>
                <p className="text-xs text-muted-foreground">Drives benefit rates and header display</p>
              </div>
            </div>
          </div>

          {(createPositionMutation.isError || updatePositionMutation.isError) && (
            <div className="flex items-center gap-2 text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2 mt-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {((createPositionMutation.error || updatePositionMutation.error) as { message?: string } | null)?.message
                  ?? "Save failed. Please try again."}
              </span>
            </div>
          )}
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => { setShowPositionDialog(false); setEditingPosition(null); }}
              disabled={createPositionMutation.isPending || updatePositionMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSavePosition}
              disabled={createPositionMutation.isPending || updatePositionMutation.isPending}>
              {(createPositionMutation.isPending || updatePositionMutation.isPending) ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : editingPosition ? "Save Changes" : "Add Position"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
