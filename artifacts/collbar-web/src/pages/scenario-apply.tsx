import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetScenario,
  getGetScenarioQueryKey,
  useApplyScenario,
  useCalculateScenario,
  ScenarioCalculationResult,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, Calculator, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getStatusBadgeClass } from "@/lib/badges";

export default function ScenarioApply() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [calcResult, setCalcResult] = useState<ScenarioCalculationResult | null>(null);

  const { data: scenario, isLoading } = useGetScenario(id!, {
    query: { enabled: !!id, queryKey: getGetScenarioQueryKey(id!) },
  });

  const applyMutation = useApplyScenario();
  const calculateMutation = useCalculateScenario();

  const handleCalculate = () => {
    calculateMutation.mutate(
      { id: id! },
      {
        onSuccess: (result) => {
          setCalcResult(result);
          toast({
            title: "Calculation complete",
            description: result.totalFiveYearCost
              ? `5-Year Total: ${formatCurrency(result.totalFiveYearCost)}`
              : "Calculation finished.",
          });
        },
        onError: () =>
          toast({
            title: "Calculation failed",
            description: "Please check the scenario configuration.",
            variant: "destructive",
          }),
      }
    );
  };

  const handleApply = () => {
    applyMutation.mutate(
      { id: id! },
      {
        onSuccess: () => {
          toast({
            title: "Scenario applied as Final",
            description: `"${scenario?.name}" is now the official contract.`,
          });
          setLocation("/scenarios");
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to apply scenario.",
            variant: "destructive",
          }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Scenario not found.
      </div>
    );
  }

  const isAlreadyFinal = scenario.status === "final";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(`/scenarios/${id}`)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apply Scenario as Final</h1>
          <p className="text-muted-foreground text-sm">
            Review the 5-year projection before locking this scenario as the official contract.
          </p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>{scenario.name}</CardTitle>
              {scenario.description && (
                <CardDescription className="mt-1">{scenario.description}</CardDescription>
              )}
            </div>
            <Badge variant="outline" className={getStatusBadgeClass(scenario.status)}>
              {scenario.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-muted/30 border border-border rounded-lg text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>
              Created {new Date(scenario.createdAt).toLocaleDateString()} &bull;{" "}
              Status: <span className="capitalize font-medium text-foreground">{scenario.status}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>5-Year Projection Summary</CardTitle>
              <CardDescription>
                Run the calculation to see district-wide cost before applying.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalculate}
              disabled={calculateMutation.isPending}
              className="gap-2"
            >
              <Calculator className="w-4 h-4" />
              {calculateMutation.isPending ? "Calculating..." : "Run Calculation"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {calcResult ? (
            <div className="space-y-4">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead>Contract Year</TableHead>
                    <TableHead className="text-right">Employee Count</TableHead>
                    <TableHead className="text-right">Total Employer Cost</TableHead>
                    <TableHead className="text-right">YoY Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calcResult.districtWideSummary?.map((yr, i) => {
                    const prevCost = i > 0
                      ? parseFloat(calcResult.districtWideSummary?.[i - 1]?.totalEmployerCost ?? "0")
                      : null;
                    const thisCost = parseFloat(yr.totalEmployerCost ?? "0");
                    const delta = prevCost !== null ? thisCost - prevCost : null;
                    const deltaPct = prevCost !== null && prevCost > 0
                      ? ((delta! / prevCost) * 100).toFixed(1)
                      : null;
                    return (
                      <TableRow key={i} className="border-border">
                        <TableCell className="font-medium">{yr.yearLabel ?? `Year ${yr.contractYear}`}</TableCell>
                        <TableCell className="text-right font-mono">
                          {yr.employeeCount ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(yr.totalEmployerCost)}
                        </TableCell>
                        <TableCell className="text-right">
                          {delta !== null ? (
                            <span className={`font-mono text-xs ${delta > 0 ? "text-red-400" : "text-green-400"}`}>
                              {delta > 0 ? "+" : ""}{formatCurrency(delta)} ({delta > 0 ? "+" : ""}{deltaPct}%)
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/30 border-t-2 border-border font-bold">
                    <TableCell>5-Year Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-mono text-primary text-lg">
                      {formatCurrency(calcResult.totalFiveYearCost)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>

            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Calculator className="w-8 h-8 mx-auto mb-3 opacity-40" />
              Click "Run Calculation" above to generate the 5-year district-wide cost projection.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={`border ${isAlreadyFinal ? "border-green-500/30 bg-green-500/5" : "border-border bg-card"}`}>
        <CardContent className="pt-6">
          {isAlreadyFinal ? (
            <div className="flex items-center gap-3 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <div>
                <div className="font-semibold">This scenario is already Final</div>
                <div className="text-sm text-muted-foreground">
                  It has been applied as the official contract for this district.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-amber-500 mb-0.5">Irreversible Action</div>
                  <div className="text-muted-foreground">
                    Applying this scenario marks it as the official final contract. Any existing
                    Final scenario will be superseded. This action cannot be undone.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/scenarios/${id}`)}
                  className="flex-1"
                >
                  Back to Editor
                </Button>
                <Button
                  size="lg"
                  onClick={handleApply}
                  disabled={applyMutation.isPending || !calcResult}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {applyMutation.isPending
                    ? "Applying..."
                    : !calcResult
                    ? "Run Calculation First"
                    : `Apply "${scenario.name}" as Final`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
