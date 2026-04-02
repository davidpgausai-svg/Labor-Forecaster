import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEmployee,
  getGetEmployeeQueryKey,
  useUpdateEmployee,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  useListEmployeeGroups,
  getListEmployeeGroupsQueryKey,
  useListSalarySchedules,
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
import { useParams, useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, TrendingUp, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AnyOption = Record<string, unknown>;

function s(v: unknown): string { return typeof v === "string" ? v : String(v ?? ""); }
function b(v: unknown): boolean { return Boolean(v); }

function RetirementOption1Card({ opt }: { opt: AnyOption }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">Option 1 — 4-Year Salary Spike</div>
        {b(opt.trsCapWarning) && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-500 border border-amber-500/30 rounded px-2 py-0.5 bg-amber-500/10">
            <AlertTriangle className="w-3 h-3" /> TRS Cap Warning
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Eligible: {b(opt.eligible) ? "Yes" : "No (requires age 55+ and 10+ yrs in district)"}
      </p>
      {b(opt.eligible) && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs text-muted-foreground font-medium pb-1">Year</th>
                <th className="text-right text-xs text-muted-foreground font-medium pb-1">Salary</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[1,2,3,4].map(y => (
                <tr key={y} className="border-b border-border/30">
                  <td className="py-1 text-muted-foreground text-xs">Year {y}</td>
                  <td className="py-1 text-right">{formatCurrency(s(opt[`year${y}Salary`]))}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-2 text-xs">Total Cost</td>
                <td className="pt-2 text-right text-primary">{formatCurrency(s(opt.totalSalaryCost))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RetirementOption2Card({ opt }: { opt: AnyOption }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">Option 2 — 2-Year Spike + Benefits</div>
        {b(opt.trsCapWarning) && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-500 border border-amber-500/30 rounded px-2 py-0.5 bg-amber-500/10">
            <AlertTriangle className="w-3 h-3" /> TRS Cap Warning
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Eligible: {b(opt.eligible) ? "Yes" : "No (requires age 55+ and 10+ yrs in district)"}
      </p>
      {b(opt.eligible) && (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <div className="text-xs text-muted-foreground">Year 1 Salary</div>
              <div>{formatCurrency(s(opt.year1Salary))}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Year 2 Salary</div>
              <div>{formatCurrency(s(opt.year2Salary))}</div>
            </div>
          </div>
          <div className="border-t border-border/30 pt-2 space-y-1 font-mono">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Service Bonus</span>
              <span>{formatCurrency(s(opt.postRetirementServiceBonus))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">TRS Bonus</span>
              <span>{formatCurrency(s(opt.postRetirementTrsBonus))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Insurance (4yr)</span>
              <span>{formatCurrency(s(opt.postRetirementInsuranceBonus))}</span>
            </div>
          </div>
          <div className="flex justify-between font-semibold border-t border-border/30 pt-2 font-mono">
            <span className="text-xs">Total District Cost</span>
            <span className="text-primary">{formatCurrency(s(opt.totalCostToDistrict))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RetirementOption3Card({ opt }: { opt: AnyOption }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm">Option 3 — Longevity Bonus</div>
        {b(opt.trsCapWarning) && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-500 border border-amber-500/30 rounded px-2 py-0.5 bg-amber-500/10">
            <AlertTriangle className="w-3 h-3" /> TRS Cap Warning
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Eligible: {b(opt.eligible) ? "Yes" : "No (requires 10+ yrs in district)"}
      </p>
      {b(opt.eligible) && (
        <div className="space-y-2 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs">Years in District</span>
            <span>{s(opt.yearsInDistrict)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground text-xs">Annual Longevity Bonus</span>
            <span>{formatCurrency(s(opt.longevityBonus))}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-border/30 pt-2">
            <span className="text-xs">Salary With Bonus</span>
            <span className="text-primary">{formatCurrency(s(opt.salaryWithBonus))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
    { query: { enabled: editForm.assignType === "union" && !!editForm.bargainingUnitId } }
  );
  const editLanes = editSchedule?.[0]?.lanes ?? [];

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(id, { scenarioId: scenarioId || undefined }) });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({ districtId: districtId ?? undefined }) });
        queryClient.invalidateQueries({ queryKey: getListScenariosQueryKey({ districtId: districtId ?? undefined }) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey({ districtId: districtId ?? undefined, scenarioId: scenarioId ?? undefined }) });
        setShowEdit(false);
      },
    },
  });

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

  function openEdit() {
    if (!emp) return;
    const e = emp as Record<string, unknown>;
    const hasBu = !!emp.bargainingUnitId;
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
    });
    setShowEdit(true);
    // suppress unused var warning
    void hasBu;
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
      body.bargainingUnitId = emp?.bargainingUnitId ?? null;
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

  const opts = emp.retirementOptions;
  const projections = (emp.yearProjections ?? []) as unknown as Array<Record<string, unknown>>;

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
            {(emp as Record<string, unknown>).employeeGroupName && (
              <Badge
                variant="outline"
                className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs"
                title="Scenario calculations use this employee group config (Non-Union path)"
              >
                {String((emp as Record<string, unknown>).employeeGroupName)} · Non-Union
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle>
              {scenarioId ? "Scenario Projection by Year" : "5-Year Cost Projection"}
            </CardTitle>
            {hasProjections && (emp as Record<string, unknown>).compensationScheduleType === "individual_salary" ? (
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
                  projections.map((proj, i) => {
                    const cy = Number(proj.contractYear);
                    const isActive = cy === effectiveProjYear;
                    const prevProj = i > 0 ? projections[i - 1] : null;
                    const stepAdvanced = prevProj !== null
                      && proj.projectedStep !== null
                      && prevProj.projectedStep !== null
                      && Number(proj.projectedStep) > Number(prevProj.projectedStep);

                    return (
                      <TableRow
                        key={i}
                        className={cn(
                          "border-border cursor-pointer transition-colors",
                          isActive ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-muted/30"
                        )}
                        onClick={() => setSelectedProjYear(cy === selectedProjYear ? null : cy)}
                      >
                        <TableCell className="font-medium">
                          {s(proj.yearLabel)}
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

      {emp.retirementEligible && opts && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Retirement Calculator Options</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Side-by-side comparison of available retirement separation options and their total district cost.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {opts.option1 && (
                <RetirementOption1Card opt={opts.option1 as AnyOption} />
              )}
              {opts.option2 && (
                <RetirementOption2Card opt={opts.option2 as AnyOption} />
              )}
              {opts.option3 && (
                <RetirementOption3Card opt={opts.option3 as AnyOption} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>Edit Employee Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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

            <div className="space-y-1.5">
              <Label>Assignment Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editForm.assignType === "union" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditForm((f) => ({ ...f, assignType: "union", employeeGroupId: "" }))}
                >
                  Union (BU)
                </Button>
                <Button
                  type="button"
                  variant={editForm.assignType === "group" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditForm((f) => ({ ...f, assignType: "group", currentStep: "", currentLaneId: "" }))}
                >
                  Non-Union (Group)
                </Button>
              </div>
            </div>

            {editForm.assignType === "union" ? (
              <>
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
                      {(units ?? []).map((u: Record<string, unknown>) => (
                        <SelectItem key={String(u.id)} value={String(u.id)}>
                          {String(u.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                          {editLanes.map((lane: Record<string, unknown>) => (
                            <SelectItem key={String(lane.id)} value={String(lane.id)}>
                              {String(lane.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>Employee Group</Label>
                <Select
                  value={editForm.employeeGroupId}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, employeeGroupId: v }))}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select group…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employeeGroups ?? []).map((g: Record<string, unknown>) => (
                      <SelectItem key={String(g.id)} value={String(g.id)}>
                        {String(g.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
    </div>
  );
}
