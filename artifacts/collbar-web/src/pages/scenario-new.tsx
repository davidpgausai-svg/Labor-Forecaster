import { useState } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useCreateScenario, useListBargainingUnits, getListBargainingUnitsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function ScenarioNew() {
  const { districtId } = useDistrictContext();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createMutation = useCreateScenario();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name || !districtId) return;
    
    createMutation.mutate({
      data: {
        districtId,
        name,
        description,
        yearConfigs: []
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Scenario created", description: "Navigating to scenario editor..." });
        setLocation(`/scenarios/${data.id}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create scenario.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Scenario</h1>
        <p className="text-muted-foreground text-sm">Create a new negotiation model.</p>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Scenario Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Initial Board Proposal"
              className="bg-background/50"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description (Optional)</label>
            <Input 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 3% raise year 1, 2% year 2"
              className="bg-background/50"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSubmit} disabled={!name || createMutation.isPending}>
              Create Scenario
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
