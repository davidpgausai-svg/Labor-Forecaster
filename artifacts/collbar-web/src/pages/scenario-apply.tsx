import { useParams, useLocation } from "wouter";
import { useGetScenario, getGetScenarioQueryKey, useApplyScenario } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function ScenarioApply() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: scenario, isLoading } = useGetScenario(id!, {
    query: { enabled: !!id, queryKey: getGetScenarioQueryKey(id!) }
  });

  const applyMutation = useApplyScenario();

  const handleApply = () => {
    if (!id) return;
    applyMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Scenario Applied", description: `"${scenario?.name}" is now the Final Agreement.` });
          setLocation("/scenarios");
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to apply scenario.", variant: "destructive" });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto mt-12">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!scenario) return <div className="text-destructive p-8">Scenario not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto mt-12">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <CardTitle className="text-2xl text-amber-500">Apply as Final Agreement</CardTitle>
          <CardDescription className="text-base text-muted-foreground mt-2">
            You are about to mark <span className="font-semibold text-foreground">{scenario.name}</span> as the final approved agreement.
            This will lock the scenario and archive all other draft scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {scenario.description && (
            <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground border border-border">
              {scenario.description}
            </div>
          )}

          <div className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              Created {new Date(scenario.createdAt).toLocaleDateString()} &bull; Status: <span className="capitalize font-medium text-foreground">{scenario.status}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              size="lg"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
              onClick={handleApply}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? "Applying..." : "Confirm Final Agreement"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setLocation(`/scenarios/${id}`)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
