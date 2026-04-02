import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import {
  useGetScenario,
  getGetScenarioQueryKey,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  useListEmployeeGroups,
  getListEmployeeGroupsQueryKey,
  useUpdateScenario,
  useCalculateScenario,
  ScenarioYearConfig,
  ScenarioYearConfigIncreaseType,
  BargainingUnit,
  ScenarioCalculationResult,
  EmployeeGroupWithSchedules,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import { formatCurrency } from "@/lib/format";
import { getStatusBadgeClass } from "@/lib/badges";
import { Calculator, Info, TrendingUp } from "lucide-react";

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

  const { data: employeeGroups } = useListEmployeeGroups(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }) } }
  );

  const updateMutation = useUpdateScenario();
  const calculateMutation = useCalculateScenario();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    yearConfigs: [],
  });

  const [calcSummary, setCalcSummary] = useState<{ total: string; years: number } | null>(null);
  const [lastCalcResult, setLastCalcResult] = useState<ScenarioCalculationResult | null>(null);
  const autoCalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const updateYearConfigById = (
    id: string,
    patch: Partial<ScenarioYearConfig>
  ) => {
    setFormData(prev => ({
      ...prev,
      yearConfigs: prev.yearConfigs.map(yc =>
        yc.id === id ? { ...yc, ...patch } : yc
      ),
    }));
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

  const idRef = useRef(id);
  const calcMutRef = useRef(calculateMutation);
  const toastRef = useRef(toast);
  idRef.current = id;
  calcMutRef.current = calculateMutation;
  toastRef.current = toast;

  const runCalculation = useCallback((showToast = true) => {
    calcMutRef.current.mutate(
      { id: idRef.current! },
      {
        onSuccess: (result) => {
          const total = result.totalFiveYearCost ? formatCurrency(result.totalFiveYearCost) : "—";
          const distinctYears = new Set(result.yearSummaries?.map(s => s.contractYear) ?? []).size;
          setCalcSummary({ total, years: distinctYears });
          setLastCalcResult(result);
          if (showToast) {
            toastRef.current({
              title: "Calculation complete",
              description: `5-Year total: ${total}`,
            });
          }
        },
        onError: () => {
          if (showToast) toastRef.current({ title: "Error", description: "Calculation failed.", variant: "destructive" });
        },
      }
    );
  }, []);

  const handleCalculate = () => runCalculation(true);

  useEffect(() => {
    if (!id || formData.yearConfigs.length === 0) return;
    if (autoCalcTimerRef.current) clearTimeout(autoCalcTimerRef.current);
    autoCalcTimerRef.current = setTimeout(() => runCalculation(false), 1800);
    return () => {
      if (autoCalcTimerRef.current) clearTimeout(autoCalcTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.yearConfigs]);

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

      {calcSummary && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
          <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
          <span>
            Last calculation: <span className="font-semibold text-foreground">{calcSummary.total}</span> over{" "}
            <span className="font-semibold text-foreground">{calcSummary.years}</span> contract years
          </span>
        </div>
      )}

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

      <UnifiedGroupSelector
        units={units ?? []}
        employeeGroups={employeeGroups ?? []}
        formData={formData}
        lastCalcResult={lastCalcResult}
        updateYearConfig={updateYearConfig}
        updateYearConfigById={updateYearConfigById}
      />
    </div>
  );
}

type UnifiedGroup =
  | { kind: "unit"; id: string; name: string; unit: BargainingUnit }
  | { kind: "group"; id: string; name: string; group: EmployeeGroupWithSchedules };

function UnifiedGroupSelector({
  units,
  employeeGroups,
  formData,
  lastCalcResult,
  updateYearConfig,
  updateYearConfigById,
}: {
  units: BargainingUnit[];
  employeeGroups: EmployeeGroupWithSchedules[];
  formData: FormData;
  lastCalcResult: ScenarioCalculationResult | null;
  updateYearConfig: (bargainingUnitId: string, contractYear: number, patch: Partial<ScenarioYearConfig>) => void;
  updateYearConfigById: (id: string, patch: Partial<ScenarioYearConfig>) => void;
}) {
  const allGroups: UnifiedGroup[] = [
    ...units.map(u => ({ kind: "unit" as const, id: `unit:${u.id}`, name: u.name, unit: u })),
    ...employeeGroups.map(g => ({ kind: "group" as const, id: `group:${g.id}`, name: g.name, group: g })),
  ];

  const [activeId, setActiveId] = useState<string | null>(allGroups[0]?.id ?? null);

  useEffect(() => {
    if (!activeId && allGroups.length > 0) {
      setActiveId(allGroups[0].id);
    }
  }, [allGroups.length]);

  if (allGroups.length === 0) return null;

  const activeEntry = allGroups.find(g => g.id === activeId) ?? allGroups[0];

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wide">Groups</h3>
      <div className="flex flex-wrap gap-1.5">
        {allGroups.map(entry => {
          const isActive = entry.id === activeEntry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setActiveId(entry.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                isActive
                  ? "bg-background border-border shadow-sm text-foreground"
                  : "bg-muted border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              {entry.name}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  entry.kind === "unit"
                    ? "bg-blue-500/15 text-blue-500"
                    : "bg-violet-500/15 text-violet-500"
                }`}
              >
                {entry.kind === "unit" ? "Union" : "Non-Union"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {activeEntry.kind === "unit" ? (
          (() => {
            const unit = activeEntry.unit;
            const unitConfigs = formData.yearConfigs
              .filter(yc => yc.bargainingUnitId === unit.id && !yc.employeeGroupId)
              .sort((a, b) => a.contractYear - b.contractYear);
            return (
              <>
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
                      bargainingUnit={unit}
                      lastCalcResult={lastCalcResult ?? undefined}
                      onChange={patch => updateYearConfig(yc.bargainingUnitId!, yc.contractYear, patch)}
                    />
                  ))
                )}
              </>
            );
          })()
        ) : (
          (() => {
            const group = activeEntry.group;
            const groupConfigs = formData.yearConfigs
              .filter(yc => yc.employeeGroupId === group.id && yc.contractYear !== 0)
              .sort((a, b) => a.contractYear - b.contractYear);
            const primarySchedule = group.compensationSchedules?.find(s => s.isPrimary);
            return (
              <>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">{group.name}</h3>
                  {primarySchedule && (
                    <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                      {primarySchedule.name} &mdash; {primarySchedule.scheduleType?.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {groupConfigs.length === 0 ? (
                  <Card className="bg-card border-border">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      No year configurations for this group. Create a scenario to auto-generate them.
                    </CardContent>
                  </Card>
                ) : (
                  groupConfigs.map(yc => (
                    <GroupYearConfigCard
                      key={yc.id ?? `${group.id}-${yc.contractYear}`}
                      config={yc}
                      groupName={group.name}
                      scheduleType={primarySchedule?.scheduleType ?? null}
                      onChange={patch => updateYearConfigById(yc.id!, patch)}
                    />
                  ))
                )}
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}

function computeEffectiveRate(config: ScenarioYearConfig): number | null {
  if (config.increaseType === "fixed_percentage") {
    const v = parseFloat(config.fixedPercentage ?? "");
    return isNaN(v) ? null : v;
  }
  if (config.increaseType === "cpi_formula") {
    const cpi = parseFloat(config.cpiValue ?? "0");
    const adder = parseFloat(config.cpiAdder ?? "0");
    const floor = parseFloat(config.cpiFloor ?? "0");
    const cap = parseFloat(config.cpiCap ?? "99");
    const raw = (isNaN(cpi) ? 0 : cpi) + (isNaN(adder) ? 0 : adder);
    return Math.min(Math.max(raw, isNaN(floor) ? 0 : floor), isNaN(cap) ? 99 : cap);
  }
  return null;
}

function RangeWithInput({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.25,
  suffix = "%",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const num = parseFloat(value);
  const safeNum = isNaN(num) ? 0 : num;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        <span className="text-xs font-mono font-semibold text-foreground">
          {isNaN(num) ? "—" : `${num.toFixed(2)}${suffix}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeNum}
        onChange={e => onChange(e.target.value)}
        className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
      />
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="font-mono text-right bg-background/50 h-8 text-sm"
        placeholder={`${min}–${max}`}
      />
    </div>
  );
}

function YearConfigCard({
  config,
  onChange,
  bargainingUnit,
  lastCalcResult,
}: {
  config: ScenarioYearConfig;
  onChange: (patch: Partial<ScenarioYearConfig>) => void;
  bargainingUnit?: BargainingUnit;
  lastCalcResult?: ScenarioCalculationResult;
}) {
  const effectiveRate = useMemo(() => computeEffectiveRate(config), [config]);

  const yearCost = useMemo(() => {
    if (!lastCalcResult?.yearSummaries) return null;
    const yearSummary = lastCalcResult.yearSummaries.find(
      s => s.contractYear === config.contractYear && s.bargainingUnitId === config.bargainingUnitId
    );
    return yearSummary?.totalEmployerCost ? parseFloat(yearSummary.totalEmployerCost) : null;
  }, [lastCalcResult, config.contractYear, config.bargainingUnitId]);

  const estimatedDelta = yearCost !== null && effectiveRate !== null
    ? yearCost * (effectiveRate / 100)
    : null;

  const isBaseline = config.contractYear === 0;

  if (isBaseline) {
    return (
      <Card className="bg-card border-border opacity-80">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {config.yearLabel} — Baseline Year (Current)
            </CardTitle>
            {yearCost !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted border border-border rounded-md">
                <span className="text-xs font-mono text-muted-foreground">
                  {formatCurrency(yearCost.toFixed(0))} employer cost
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-md px-3 py-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Year 0 is the current baseline year. No salary increases or step advancement are applied — it reflects actual current compensation. Increase parameters only apply starting from Year 1.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {config.yearLabel} — Year {config.contractYear}
          </CardTitle>
          <div className="flex items-center gap-2">
            {effectiveRate !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-md">
                <TrendingUp className="w-3 h-3 text-primary" />
                <span className="text-xs font-mono font-semibold text-primary">
                  {effectiveRate.toFixed(2)}% effective
                </span>
              </div>
            )}
            {estimatedDelta !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-md">
                <span className="text-xs font-mono text-amber-400">
                  ~+{formatCurrency(estimatedDelta.toFixed(0))} (% increase est.)
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3">
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
        </div>

        {config.increaseType === "fixed_percentage" && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Raise Parameters</div>
            <RangeWithInput
              label="Fixed % Increase"
              value={config.fixedPercentage ?? ""}
              onChange={v => onChange({ fixedPercentage: v })}
              min={0}
              max={15}
              step={0.25}
            />
          </div>
        )}

        {config.increaseType === "cpi_formula" && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3 h-3" />
              <span>Effective rate = clamp(CPI + Adder, Floor, Cap)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <RangeWithInput
                label="CPI Value %"
                value={config.cpiValue ?? ""}
                onChange={v => onChange({ cpiValue: v })}
                min={0}
                max={12}
                step={0.1}
              />
              <RangeWithInput
                label="CPI Adder %"
                value={config.cpiAdder ?? ""}
                onChange={v => onChange({ cpiAdder: v })}
                min={-3}
                max={5}
                step={0.1}
              />
              <RangeWithInput
                label="Floor %"
                value={config.cpiFloor ?? ""}
                onChange={v => onChange({ cpiFloor: v })}
                min={0}
                max={6}
                step={0.25}
              />
              <RangeWithInput
                label="Cap %"
                value={config.cpiCap ?? ""}
                onChange={v => onChange({ cpiCap: v })}
                min={0}
                max={15}
                step={0.25}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CPI Index Name</label>
              <Input
                value={config.cpiIndexName ?? ""}
                onChange={e => onChange({ cpiIndexName: e.target.value })}
                className="bg-background/50 text-sm"
                placeholder="e.g. Chicago CPI-U"
              />
            </div>
          </div>
        )}

        {config.increaseType === "flat_dollar" && (
          <div className="grid grid-cols-2 gap-4">
            <RangeWithInput
              label="Flat Dollar Increase $"
              value={config.highEarnerFlatIncrease ?? ""}
              onChange={v => onChange({ highEarnerFlatIncrease: v })}
              min={0}
              max={10000}
              step={100}
              suffix="$"
            />
          </div>
        )}

        <HighEarnerSection config={config} onChange={onChange} />

        <div className="border-t border-border pt-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Educational Advancement Rates</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">BA+15 %</label>
              <Input
                type="number"
                step="0.01"
                value={config.educationalAdvancementBa15 ?? ""}
                onChange={e => onChange({ educationalAdvancementBa15: e.target.value })}
                className="font-mono text-right bg-background/50 h-8 text-sm"
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">MA %</label>
              <Input
                type="number"
                step="0.01"
                value={config.educationalAdvancementMa ?? ""}
                onChange={e => onChange({ educationalAdvancementMa: e.target.value })}
                className="font-mono text-right bg-background/50 h-8 text-sm"
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">MA+15 %</label>
              <Input
                type="number"
                step="0.01"
                value={config.educationalAdvancementMa15 ?? ""}
                onChange={e => onChange({ educationalAdvancementMa15: e.target.value })}
                className="font-mono text-right bg-background/50 h-8 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Step Advancement</div>
            <div className="text-xs text-muted-foreground mt-0.5">Eligible employees advance one step this year</div>
            <div className="text-xs text-muted-foreground/60 mt-0.5 italic">Full step cost reflected after Calculate</div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ stepAdvancement: !config.stepAdvancement })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.stepAdvancement ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${config.stepAdvancement ? "translate-x-4" : "translate-x-1"}`} />
          </button>
        </div>

        <RetirementModelingSection config={config} onChange={onChange} bargainingUnit={bargainingUnit} />

        <div className="border-t border-border pt-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
          <textarea
            value={config.notes ?? ""}
            onChange={e => onChange({ notes: e.target.value })}
            className="w-full bg-background/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
            placeholder="Negotiation notes for this year..."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function HighEarnerSection({
  config,
  onChange,
}: {
  config: ScenarioYearConfig;
  onChange: (patch: Partial<ScenarioYearConfig>) => void;
}) {
  const hasThreshold = !!config.highEarnerThreshold && config.highEarnerThreshold !== "";
  const [enabled, setEnabled] = useState(hasThreshold);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    if (!next) onChange({ highEarnerThreshold: null, highEarnerFlatIncrease: null });
  }, [enabled, onChange]);

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High-Earner Override</div>
          <div className="text-xs text-muted-foreground mt-0.5">Employees above threshold receive a separate flat increase</div>
        </div>
        <button
          type="button"
          onClick={toggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-amber-500" : "bg-muted"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-1"}`} />
        </button>
      </div>
      {enabled && (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Salary Threshold $</label>
            <Input
              type="number"
              value={config.highEarnerThreshold ?? ""}
              onChange={e => onChange({ highEarnerThreshold: e.target.value })}
              className="font-mono text-right bg-background/50"
              placeholder="e.g. 100,000"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flat Increase $ (High Earner)</label>
            <Input
              type="number"
              value={config.highEarnerFlatIncrease ?? ""}
              onChange={e => onChange({ highEarnerFlatIncrease: e.target.value })}
              className="font-mono text-right bg-background/50"
              placeholder="e.g. 3,000"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function RetirementModelingSection({
  config,
  onChange,
  bargainingUnit,
}: {
  config: ScenarioYearConfig;
  onChange: (patch: Partial<ScenarioYearConfig>) => void;
  bargainingUnit?: BargainingUnit;
}) {
  const [expanded, setExpanded] = useState(false);

  const retirementSystem = bargainingUnit?.retirementSystem ?? "TRS";
  const ficaRate = bargainingUnit?.ficaRate ?? (retirementSystem === "TRS" ? null : "7.65");
  const ficaExempt = bargainingUnit?.ficaExempt ?? false;
  const workersCompRate = bargainingUnit?.workersCompRate ?? null;
  const dentalAnnual = bargainingUnit?.dentalAnnual ?? null;
  const lifeInsuranceAnnual = bargainingUnit?.lifeInsuranceAnnual ?? null;
  const disabilityInsuranceAnnual = bargainingUnit?.disabilityInsuranceAnnual ?? null;

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Benefits & Retirement Modeling
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {retirementSystem === "TRS" ? "TRS" : retirementSystem === "IMRF" ? "IMRF" : "Retirement"} / {ficaExempt ? "FICA Exempt" : "FICA"} · Year-over-year benefit cost inputs
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${expanded ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${expanded ? "translate-x-4" : "translate-x-1"}`} />
        </button>
      </div>
      {expanded && (
        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <RangeWithInput
              label="Health Premium Increase Rate %"
              value={config.healthPremiumIncreaseRate ?? ""}
              onChange={v => onChange({ healthPremiumIncreaseRate: v })}
              min={0}
              max={20}
              step={0.5}
            />
            <RangeWithInput
              label="Employer Health Cap Rate %"
              value={config.healthEmployerCapRate ?? ""}
              onChange={v => onChange({ healthEmployerCapRate: v })}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="p-3 rounded-md bg-muted/30 border border-border/40 text-xs space-y-1">
            <div className="font-medium text-foreground/70 mb-2 flex items-center gap-2">
              Statutory Contribution Rates
              {bargainingUnit && (
                <span className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
                  {bargainingUnit.name}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
              <span>Retirement System:</span>
              <span className="font-mono font-medium text-foreground text-right">{retirementSystem}</span>
              <span>FICA / Medicare:</span>
              <span className="font-mono text-right">
                {ficaExempt ? "Exempt" : ficaRate ? `${ficaRate}%` : "7.65%"}
              </span>
              <span>Workers' Comp Rate:</span>
              <span className="font-mono text-right">
                {workersCompRate ? `${workersCompRate}%` : "~1.50%"}
              </span>
              <span>Dental / Vision (annual):</span>
              <span className="font-mono text-right">
                {dentalAnnual ? `$${parseFloat(dentalAnnual).toLocaleString()}` : "~$650"}
              </span>
              <span>Life Insurance (annual):</span>
              <span className="font-mono text-right">
                {lifeInsuranceAnnual ? `$${parseFloat(lifeInsuranceAnnual).toLocaleString()}` : "~$300"}
              </span>
              <span>LTD / Disability (annual):</span>
              <span className="font-mono text-right">
                {disabilityInsuranceAnnual ? `$${parseFloat(disabilityInsuranceAnnual).toLocaleString()}` : "~$500"}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground/70 italic border-t border-border/30 pt-1.5">
              Statutory rates are configured per bargaining unit in Settings. Adjust Health Premium and Cap above to model benefit cost changes year-over-year.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupYearConfigCard({
  config,
  groupName,
  scheduleType,
  onChange,
}: {
  config: ScenarioYearConfig;
  groupName: string;
  scheduleType: string | null;
  onChange: (patch: Partial<ScenarioYearConfig>) => void;
}) {
  const isIndexBased = scheduleType === "index_based_grid";

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {groupName} &mdash; {config.yearLabel ?? `Year ${config.contractYear}`}
          </CardTitle>
          <span className="text-xs text-muted-foreground">Year {config.contractYear}</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-4">
        {isIndexBased ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Base Adjustment Type</label>
              <Select
                value={config.baseAdjustmentType ?? "percentage"}
                onValueChange={val => onChange({ baseAdjustmentType: val as ScenarioYearConfig["baseAdjustmentType"] })}
              >
                <SelectTrigger className="bg-background/50 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="dollar">Dollar ($)</SelectItem>
                  <SelectItem value="set_directly">Set Directly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {config.baseAdjustmentType === "dollar"
                  ? "Dollar Amount"
                  : config.baseAdjustmentType === "set_directly"
                  ? "New Base Salary"
                  : "Percentage"}
              </label>
              <div className="relative">
                {(config.baseAdjustmentType === "dollar" || config.baseAdjustmentType === "set_directly") && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                )}
                <Input
                  className={`bg-background/50 h-8 text-sm ${config.baseAdjustmentType === "dollar" || config.baseAdjustmentType === "set_directly" ? "pl-6" : ""}`}
                  type="number"
                  step={config.baseAdjustmentType === "percentage" ? "0.01" : "1"}
                  value={config.baseAdjustmentValue ?? ""}
                  onChange={e => onChange({ baseAdjustmentValue: e.target.value })}
                  placeholder={config.baseAdjustmentType === "percentage" ? "e.g. 3.00" : "0.00"}
                />
                {config.baseAdjustmentType === "percentage" && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Step Advancement</label>
              <div className="flex items-center gap-2 h-8">
                <button
                  type="button"
                  onClick={() => onChange({ stepAdvancement: !config.stepAdvancement })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.stepAdvancement ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${config.stepAdvancement ? "translate-x-4" : "translate-x-1"}`} />
                </button>
                <span className="text-xs text-muted-foreground">{config.stepAdvancement ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Increase Type</label>
              <Select
                value={config.increaseType}
                onValueChange={val => onChange({ increaseType: val as ScenarioYearConfigIncreaseType })}
              >
                <SelectTrigger className="bg-background/50 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INCREASE_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {config.increaseType === "fixed_percentage" && (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Fixed Percentage</label>
                <div className="relative">
                  <Input
                    className="bg-background/50 h-8 text-sm pr-6"
                    type="number"
                    step="0.01"
                    value={config.fixedPercentage ?? ""}
                    onChange={e => onChange({ fixedPercentage: e.target.value })}
                    placeholder="e.g. 3.00"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>
            )}
            {config.increaseType === "flat_dollar" && (
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Flat Dollar Amount</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    className="bg-background/50 h-8 text-sm pl-6"
                    type="number"
                    step="1"
                    value={config.fixedPercentage ?? ""}
                    onChange={e => onChange({ fixedPercentage: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <Input
            className="bg-background/50 h-8 text-sm"
            value={config.notes ?? ""}
            onChange={e => onChange({ notes: e.target.value })}
            placeholder="Optional notes for this year"
          />
        </div>
      </CardContent>
    </Card>
  );
}
