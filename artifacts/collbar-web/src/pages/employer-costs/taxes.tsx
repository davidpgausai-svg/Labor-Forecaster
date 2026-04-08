import { useState, useEffect } from "react";
import {
  useGetTaxConfig,
  useUpsertTaxConfig,
  getGetTaxConfigQueryKey,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const DEFAULTS = {
  ssRate: "0.062000",
  ssWageBase: "176100.00",
  medicareRate: "0.014500",
  futaRate: "0.006000",
  futaWageBase: "7000.00",
  sutaRate: "0.027000",
  sutaWageBase: "13000.00",
  workersCompRatePer100: "0.000000",
  notes: "",
};

function pct(v: string) {
  const n = parseFloat(v);
  return isNaN(n) ? v : (n * 100).toFixed(4);
}

function fromPct(v: string) {
  const n = parseFloat(v);
  return isNaN(n) ? "0" : (n / 100).toFixed(6);
}

export default function TaxesPage() {
  const { districtId } = useDistrictContext();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useGetTaxConfig(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getGetTaxConfigQueryKey({ districtId: districtId! }) } }
  );

  const [form, setForm] = useState(DEFAULTS);
  // Display as percentages (e.g. 6.2 for 6.2%)
  const [display, setDisplay] = useState({
    ssRate: "6.2000",
    medicareRate: "1.4500",
    futaRate: "0.6000",
    sutaRate: "2.7000",
    workersCompRatePer100: "0.0000",
  });

  useEffect(() => {
    if (config) {
      setForm({
        ssRate: config.ssRate ?? DEFAULTS.ssRate,
        ssWageBase: config.ssWageBase ?? DEFAULTS.ssWageBase,
        medicareRate: config.medicareRate ?? DEFAULTS.medicareRate,
        futaRate: config.futaRate ?? DEFAULTS.futaRate,
        futaWageBase: config.futaWageBase ?? DEFAULTS.futaWageBase,
        sutaRate: config.sutaRate ?? DEFAULTS.sutaRate,
        sutaWageBase: config.sutaWageBase ?? DEFAULTS.sutaWageBase,
        workersCompRatePer100: config.workersCompRatePer100 ?? DEFAULTS.workersCompRatePer100,
        notes: config.notes ?? "",
      });
      setDisplay({
        ssRate: pct(config.ssRate ?? DEFAULTS.ssRate),
        medicareRate: pct(config.medicareRate ?? DEFAULTS.medicareRate),
        futaRate: pct(config.futaRate ?? DEFAULTS.futaRate),
        sutaRate: pct(config.sutaRate ?? DEFAULTS.sutaRate),
        workersCompRatePer100: pct(config.workersCompRatePer100 ?? DEFAULTS.workersCompRatePer100),
      });
    }
  }, [config]);

  const mutation = useUpsertTaxConfig({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTaxConfigQueryKey({ districtId: districtId! }) });
      },
    },
  });

  function handleSave() {
    if (!districtId) return;
    mutation.mutate({
      data: {
        districtId,
        ssRate: fromPct(display.ssRate),
        ssWageBase: form.ssWageBase,
        medicareRate: fromPct(display.medicareRate),
        futaRate: fromPct(display.futaRate),
        futaWageBase: form.futaWageBase,
        sutaRate: fromPct(display.sutaRate),
        sutaWageBase: form.sutaWageBase,
        workersCompRatePer100: fromPct(display.workersCompRatePer100),
        notes: form.notes || null,
      },
    });
  }

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Employer Tax Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          These rates apply globally to all employees. FICA exemptions for specific
          retirement systems (e.g., TRS) are configured on the Retirement page per plan.
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">FICA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Social Security Rate %</Label>
              <Input
                value={display.ssRate}
                onChange={(e) => setDisplay((d) => ({ ...d, ssRate: e.target.value }))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Default: 6.2%</p>
            </div>
            <div className="space-y-1.5">
              <Label>SS Wage Base $</Label>
              <Input
                value={form.ssWageBase}
                onChange={(e) => setForm((f) => ({ ...f, ssWageBase: e.target.value }))}
                className="font-mono"
              />
              <p className="text-xs text-amber-400/70">Updated annually — verify each year</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Medicare Rate %</Label>
              <Input
                value={display.medicareRate}
                onChange={(e) => setDisplay((d) => ({ ...d, medicareRate: e.target.value }))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Default: 1.45%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">FUTA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>FUTA Rate %</Label>
              <Input
                value={display.futaRate}
                onChange={(e) => setDisplay((d) => ({ ...d, futaRate: e.target.value }))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Effective rate after SUTA credit. Default: 0.6%</p>
            </div>
            <div className="space-y-1.5">
              <Label>FUTA Wage Base $</Label>
              <Input
                value={form.futaWageBase}
                onChange={(e) => setForm((f) => ({ ...f, futaWageBase: e.target.value }))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Default: $7,000</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">SUTA (State Unemployment)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SUTA Rate %</Label>
              <Input
                value={display.sutaRate}
                onChange={(e) => setDisplay((d) => ({ ...d, sutaRate: e.target.value }))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Enter your experience-rated value</p>
            </div>
            <div className="space-y-1.5">
              <Label>SUTA Wage Base $</Label>
              <Input
                value={form.sutaWageBase}
                onChange={(e) => setForm((f) => ({ ...f, sutaWageBase: e.target.value }))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Varies by state</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Workers&apos; Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rate per $100 of Payroll</Label>
              <Input
                value={display.workersCompRatePer100}
                onChange={(e) => setDisplay((d) => ({ ...d, workersCompRatePer100: e.target.value }))}
                className="font-mono"
                placeholder="e.g. 0.75"
              />
              <p className="text-xs text-muted-foreground">Enter as a dollar amount (e.g., 0.75 = $0.75 per $100)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Tax Configuration
        </Button>
      </div>
    </div>
  );
}
