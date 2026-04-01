import { useListScenarios, getListScenariosQueryKey } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStatusBadgeClass } from "@/lib/badges";
import { formatCurrency } from "@/lib/format";
import { Link } from "wouter";
import { Plus, Layers, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Scenarios() {
  const { districtId } = useDistrictContext();
  const { data, isLoading } = useListScenarios(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListScenariosQueryKey({ districtId: districtId! }) } }
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Negotiation Scenarios</h1>
          <p className="text-muted-foreground text-sm">Model different proposal structures and compare costs.</p>
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
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">5-Yr Cost</div>
                    <div className="font-mono font-bold text-lg">{sc.totalFiveYearCost ? formatCurrency(sc.totalFiveYearCost) : "—"}</div>
                  </div>
                  <Link href={`/scenarios/${sc.id}`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9">
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
