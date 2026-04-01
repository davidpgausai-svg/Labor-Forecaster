import { useState, useEffect } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import {
  useGetScenario,
  getGetScenarioQueryKey,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  useUpdateScenario,
  useCalculateScenario,
  ScenarioYearConfig,
  ScenarioYearConfigIncreaseType,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import { formatCurrency } from "@/lib/format";
import { getStatusBadgeClass } from "@/lib/badges";
import { Calculator } from "lucide-react";

type FormData = {
  name: string;
  description: string;
  yearConfigs: ScenarioYearConfig[];
};

const INCREASE_TYPE_LABELS: Record<ScenarioYearConfigIncreaseType, string> = {
  fixed_percentage: "Fixed Percentage",
  cpi_formula: "CPI Formula",
  flat_dollar: "Flat Dollar",
  step_only: "Step Only",
  custom: "Custom",
};

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
  const calculateMutation = useCalculateScenario();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    yearConfigs: [],
  });

  useEffect(() => {
    if (scenario) {
      setFormData({
        name: scenario.name,
        description: scenario.description ?? "",
        yearConfigs: scenario.yearConfigs ?? [],
      });
    }
  }, [scenario]);

  const updateField = (field: keyof Pick<FormData, "name" | "description">, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateYearConfig = (
    bargainingUnitId: string,
    contractYear: number,
    patch: Partial<ScenarioYearConfig>
  ) => {
    setFormData(prev => ({
      ...prev,
      yearConfigs: prev.yearConfigs.map(yc =>
        yc.bargainingUnitId === bargainingUnitId && yc.contractYear === contractYear
          ? { ...yc, ...patch }
          : yc
      ),
    }));
  };

  const handleSave = () => {
    updateMutation.mutate(
      { id: id!, data: formData },
      {
        onSuccess: () => toast({ title: "Scenario saved", description: "Changes have been updated." }),
        onError: () => toast({ title: "Error", description: "Failed to save scenario.", variant: "destructive" }),
      }
    );
  };

  const handleCalculate = () => {
    calculateMutation.mutate(
      { id: id! },
      {
        onSuccess: (result) => {
          toast({
            title: "Calculation complete",
            description: `5-Year total: ${result.totalFiveYearCost ? formatCurrency(result.totalFiveYearCost) : "—"}`,
          });
        },
        onError: () => toast({ title: "Error", description: "Calculation failed.", variant: "destructive" }),
      }
    );
  };

  if (isLoading || unitsLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!scenario) return <div className="text-destructive p-8">Scenario not found.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">{scenario.name}</h1>
            <Badge variant="outline" className={getStatusBadgeClass(scenario.status)}>{scenario.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">Configure year-by-year parameters per bargaining unit.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCalculate} disabled={calculateMutation.isPending}>
            <Calculator className="w-4 h-4 mr-2" />
            {calculateMutation.isPending ? "Calculating..." : "Calculate"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Draft"}
          </Button>
          <Button size="sm" onClick={() => setLocation(`/scenarios/${id}/apply`)}>Apply as Final</Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Scenario Name</label>
            <Input
              value={formData.name}
              onChange={e => updateField("name", e.target.value)}
              className="bg-background/50"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={formData.description}
              onChange={e => updateField("description", e.target.value)}
              className="bg-background/50"
              placeholder="Optional description"
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

          {units.map(unit => {
            const unitConfigs = formData.yearConfigs
              .filter(yc => yc.bargainingUnitId === unit.id)
              .sort((a, b) => a.contractYear - b.contractYear);

            return (
              <TabsContent key={unit.id} value={unit.id} className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold">{unit.name}</h3>
                {unitConfigs.length === 0 ? (
                  <Card className="bg-card border-border">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No year configurations for this unit.
                    </CardContent>
                  </Card>
                ) : (
                  unitConfigs.map(yc => (
                    <YearConfigCard
                      key={`${yc.bargainingUnitId}-${yc.contractYear}`}
                      config={yc}
                      onChange={patch => updateYearConfig(yc.bargainingUnitId, yc.contractYear, patch)}
                    />
                  ))
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

function YearConfigCard({
  config,
  onChange,
}: {
  config: ScenarioYearConfig;
  onChange: (patch: Partial<ScenarioYearConfig>) => void;
}) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {config.yearLabel} — Year {config.contractYear}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Increase Type</label>
          <Select
            value={config.increaseType}
            onValueChange={val => onChange({ increaseType: val as ScenarioYearConfigIncreaseType })}
          >
            <SelectTrigger className="bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INCREASE_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {config.increaseType === "fixed_percentage" && (
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fixed % Increase</label>
            <Input
              type="number"
              step="0.01"
              value={config.fixedPercentage ?? ""}
              onChange={e => onChange({ fixedPercentage: e.target.value })}
              className="font-mono text-right bg-background/50"
              placeholder="e.g. 3.00"
            />
          </div>
        )}

        {config.increaseType === "cpi_formula" && (
          <>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CPI Value %</label>
              <Input
                type="number"
                step="0.01"
                value={config.cpiValue ?? ""}
                onChange={e => onChange({ cpiValue: e.target.value })}
                className="font-mono text-right bg-background/50"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CPI Adder %</label>
              <Input
                type="number"
                step="0.01"
                value={config.cpiAdder ?? ""}
                onChange={e => onChange({ cpiAdder: e.target.value })}
                className="font-mono text-right bg-background/50"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Floor %</label>
              <Input
                type="number"
                step="0.01"
                value={config.cpiFloor ?? ""}
                onChange={e => onChange({ cpiFloor: e.target.value })}
                className="font-mono text-right bg-background/50"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cap %</label>
              <Input
                type="number"
                step="0.01"
                value={config.cpiCap ?? ""}
                onChange={e => onChange({ cpiCap: e.target.value })}
                className="font-mono text-right bg-background/50"
              />
            </div>
          </>
        )}

        {config.increaseType === "flat_dollar" && (
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Earner Flat Increase</label>
            <Input
              type="number"
              value={config.highEarnerFlatIncrease ?? ""}
              onChange={e => onChange({ highEarnerFlatIncrease: e.target.value })}
              className="font-mono text-right bg-background/50"
              placeholder="e.g. 3000"
            />
          </div>
        )}

        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Earner Threshold</label>
          <Input
            type="number"
            value={config.highEarnerThreshold ?? ""}
            onChange={e => onChange({ highEarnerThreshold: e.target.value })}
            className="font-mono text-right bg-background/50"
            placeholder="e.g. 100000"
          />
        </div>

        <div className="flex items-center gap-3 pt-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Step Advancement</label>
          <button
            type="button"
            onClick={() => onChange({ stepAdvancement: !config.stepAdvancement })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.stepAdvancement ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${config.stepAdvancement ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
