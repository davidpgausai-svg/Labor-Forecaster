import { useState, useEffect } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useGetScenario, getGetScenarioQueryKey, useListBargainingUnits, getListBargainingUnitsQueryKey, useUpdateScenario, ScenarioYearConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";

export default function ScenarioDetail() {
  const { id } = useParams();
  const { districtId } = useDistrictContext();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: scenario, isLoading } = useGetScenario(id!, {
    query: { enabled: !!id, queryKey: getGetScenarioQueryKey(id!) }
  });

  const { data: units, isLoading: unitsLoading } = useListBargainingUnits(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }) } }
  );

  const updateMutation = useUpdateScenario();
  
  const [formData, setFormData] = useState<any>({
    name: "",
    description: "",
    yearConfigs: []
  });

  useEffect(() => {
    if (scenario) {
      setFormData({
        name: scenario.name,
        description: scenario.description || "",
        yearConfigs: scenario.yearConfigs || []
      });
    }
  }, [scenario]);

  const handleSave = () => {
    updateMutation.mutate({ id: id!, data: formData }, {
      onSuccess: () => {
        toast({ title: "Scenario saved", description: "Changes have been updated." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save scenario.", variant: "destructive" });
      }
    });
  };

  const handleApply = () => {
    setLocation(`/scenarios/${id}/apply`);
  };

  if (isLoading || unitsLoading) {
    return <div className="space-y-6 max-w-5xl mx-auto"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!scenario) return <div>Scenario not found.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Scenario</h1>
          <p className="text-muted-foreground text-sm">Configure parameters per unit and year.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSave} disabled={updateMutation.isPending}>Save Draft</Button>
          <Button onClick={handleApply}>Apply as Final</Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Scenario Name</label>
            <Input 
              value={formData.name} 
              onChange={e => setFormData((p: Record<string, unknown>) => ({ ...p, name: e.target.value }))}
              className="bg-background/50"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description</label>
            <Input 
              value={formData.description} 
              onChange={e => setFormData((p: Record<string, unknown>) => ({ ...p, description: e.target.value }))}
              className="bg-background/50"
            />
          </div>
        </CardContent>
      </Card>

      {units && units.length > 0 && (
        <Tabs defaultValue={units[0].id} className="w-full">
          <TabsList className="bg-muted border-border flex-wrap h-auto">
            {units.map(unit => (
              <TabsTrigger key={unit.id} value={unit.id} className="data-[state=active]:bg-background">
                {unit.name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {units.map(unit => (
            <TabsContent key={unit.id} value={unit.id} className="mt-6 space-y-6">
              <h3 className="text-lg font-semibold">{unit.name} Settings</h3>
              
              {/* Simplified view: Just showing year 1 config as an example */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Year 1 Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Increase Type</label>
                      <Select defaultValue="fixed_percentage">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed_percentage">Fixed Percentage</SelectItem>
                          <SelectItem value="cpi_formula">CPI Formula</SelectItem>
                          <SelectItem value="flat_dollar">Flat Dollar</SelectItem>
                          <SelectItem value="step_only">Step Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Fixed Percentage (%)</label>
                      <Input type="number" defaultValue="3.00" className="font-mono text-right" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
