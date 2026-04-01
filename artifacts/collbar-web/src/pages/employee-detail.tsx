import { useGetEmployee, getGetEmployeeQueryKey } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getBadgeColorClass } from "@/lib/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useParams } from "wouter";

export default function EmployeeDetail() {
  const params = useParams();
  const id = params.id as string;
  const { scenarioId } = useDistrictContext();

  const { data: emp, isLoading } = useGetEmployee(
    id,
    { scenarioId: scenarioId || undefined },
    {
      query: {
        enabled: !!id,
        queryKey: getGetEmployeeQueryKey(id, { scenarioId: scenarioId || undefined })
      }
    }
  );

  if (isLoading) {
    return <div className="space-y-6 max-w-5xl mx-auto"><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!emp) {
    return <div className="text-center py-12 text-muted-foreground">Employee not found.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{emp.firstName} {emp.lastName}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant="outline" className={getBadgeColorClass(emp.bargainingUnitName || "")}>
              {emp.bargainingUnitName || "Unknown Unit"}
            </Badge>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 capitalize">
              {emp.status}
            </Badge>
            {emp.retirementEligible && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                Retirement Eligible
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border md:col-span-2">
          <CardHeader>
            <CardTitle>5-Year Projection</CardTitle>
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
                      <TableCell className="text-right font-mono">{formatCurrency(proj.projectedBaseSalary)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(proj.totalEmployerCost)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPercent(proj.effectiveRate)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No projection data available. Ensure a scenario is selected.</TableCell>
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
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Salary</div>
              <div className="font-mono font-medium text-lg">{formatCurrency(emp.currentAnnualSalary)}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Step</div>
                <div className="font-medium">{emp.currentStep || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Lane</div>
                <div className="font-medium">{emp.laneName || "—"}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Insurance</div>
              <div className="font-medium capitalize">{emp.insuranceElection || "—"}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Yrs in District</div>
                <div className="font-medium">{emp.yearsInDistrict || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Service</div>
                <div className="font-medium">{emp.yearsTotalService || "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {emp.retirementEligible && emp.retirementOptions && (
          <Card className="bg-card border-border md:col-span-3">
            <CardHeader>
              <CardTitle>Retirement Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(emp.retirementOptions).map(([key, opt]) => opt && (
                  <div key={key} className="p-4 rounded-lg border border-border bg-muted/20">
                    <div className="font-semibold capitalize mb-2">{key.replace('option', 'Option ')}</div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                      {JSON.stringify(opt, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
