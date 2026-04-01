import { useGetEmployee, getGetEmployeeQueryKey } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getBadgeColorClass } from "@/lib/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const { scenarioId } = useDistrictContext();
  const [, setLocation] = useLocation();

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle>5-Year Cost Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="border-border">
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Base Salary</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Effective Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emp.yearProjections && emp.yearProjections.length > 0 ? (
                  emp.yearProjections.map((proj, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="font-medium">{proj.yearLabel}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(proj.projectedBaseSalary)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(proj.totalEmployerCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatPercent(proj.effectiveRate)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No projection data. Select a scenario from the header.
                    </TableCell>
                  </TableRow>
                )}
                {emp.yearProjections && emp.yearProjections.length > 0 && (
                  <TableRow className="border-t border-border bg-muted/20">
                    <TableCell className="font-semibold text-sm">5-Year Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {formatCurrency(
                        emp.yearProjections.reduce(
                          (sum, p) =>
                            sum + (parseFloat(p.totalEmployerCost) || 0),
                          0
                        )
                      )}
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
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
    </div>
  );
}
