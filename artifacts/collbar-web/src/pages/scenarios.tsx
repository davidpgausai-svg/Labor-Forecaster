import { useState } from "react";
import {
  useListScenarios,
  getListScenariosQueryKey,
  useDeleteScenario,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getStatusBadgeClass } from "@/lib/badges";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";
import { Plus, Layers, ArrowRight, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Scenarios() {
  const { districtId } = useDistrictContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useListScenarios(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListScenariosQueryKey({ districtId: districtId! }) } }
  );

  const deleteMutation = useDeleteScenario();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmScenario = data?.find(s => s.id === confirmId);

  function handleDeleteConfirm() {
    if (!confirmId) return;
    deleteMutation.mutate(
      { id: confirmId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListScenariosQueryKey({ districtId: districtId! }) });
          toast({ title: "Scenario deleted" });
          setConfirmId(null);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
            ?? "Failed to delete scenario.";
          toast({ title: "Cannot delete", description: msg, variant: "destructive" });
          setConfirmId(null);
        },
      }
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Negotiation Scenarios</h1>
          <p className="text-muted-foreground text-sm">
            Each scenario projects your current workforce costs forward under different contract proposals.
            Workforce data (employees, positions, step/lane placement) is shared across all scenarios.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/scenarios/compare" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 gap-2">
            <Layers className="w-4 h-4" /> Compare
          </Link>
          <Link href="/scenarios/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 gap-2">
            <Plus className="w-4 h-4" /> New Scenario
          </Link>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          data?.map(sc => (
            <Card key={sc.id} className="bg-card border-border hover:border-primary/50 transition-colors">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg">{sc.name}</h3>
                    <Badge variant="outline" className={getStatusBadgeClass(sc.status)}>{sc.status}</Badge>
                    {sc.isFinal && <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Final Agreement</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-2xl truncate">{sc.description || "No description provided."}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">5-Yr Projected Cost</div>
                    <div className="font-mono font-bold text-lg">{sc.totalFiveYearCost ? formatCurrency(sc.totalFiveYearCost) : "—"}</div>
                  </div>
                  <Link href={`/scenarios/${sc.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    disabled={!!sc.isFinal}
                    title={sc.isFinal ? "Cannot delete the final scenario" : "Delete scenario"}
                    onClick={() => setConfirmId(sc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={open => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{confirmScenario?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the scenario and all its projected cost data. Your workforce
              data (employees, positions, salary placement) is not affected — it is shared across all
              scenarios and will remain intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Scenario"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
