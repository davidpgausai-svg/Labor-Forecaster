import { useState, useEffect } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import {
  useGetDistrict,
  getGetDistrictQueryKey,
  useUpdateDistrict,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  useUpdateBargainingUnit,
  useCreateBargainingUnit,
  BargainingUnit,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

type BenefitRates = {
  retirementEmployeeRate: string;
  retirementEmployerRate: string;
  retirementGrossUpRate: string;
  ficaRate: string;
  ficaExempt: boolean;
  healthInsuranceSingleAnnual: string;
  healthInsuranceFamilyAnnual: string;
  dentalAnnual: string;
  lifeInsuranceAnnual: string;
  disabilityInsuranceAnnual: string;
  hsaContributionSingle: string;
  hsaContributionFamily: string;
  workersCompRate: string;
};

function AddBargainingUnitDialog({
  open,
  onClose,
  districtId,
}: {
  open: boolean;
  onClose: () => void;
  districtId: string;
}) {
  const { toast } = useToast();
  const createMutation = useCreateBargainingUnit();

  const [form, setForm] = useState({
    name: "",
    code: "",
    compensationType: "salary" as "salary" | "hourly",
    retirementSystem: "TRS" as "TRS" | "IMRF" | "other",
  });

  const set = (field: keyof typeof form) => (value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = () => {
    if (!form.name || !form.code) return;
    createMutation.mutate(
      {
        data: {
          districtId,
          name: form.name,
          code: form.code,
          compensationType: form.compensationType as "salary" | "hourly",
          retirementSystem: form.retirementSystem as "TRS" | "IMRF" | "other",
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Bargaining unit created", description: `${form.name} has been added.` });
          setForm({ name: "", code: "", compensationType: "salary", retirementSystem: "TRS" });
          onClose();
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to create bargaining unit.", variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add Bargaining Unit</DialogTitle>
          <p className="text-sm text-muted-foreground">Define a new unit for contract modeling.</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-1.5">
            <Label>Unit Name</Label>
            <Input
              value={form.name}
              onChange={e => set("name")(e.target.value)}
              placeholder="e.g. Paraprofessionals"
              className="bg-background/50"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Short Code</Label>
            <Input
              value={form.code}
              onChange={e => set("code")(e.target.value)}
              placeholder="e.g. PARA"
              className="bg-background/50 uppercase"
              maxLength={10}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Compensation Type</Label>
              <Select value={form.compensationType} onValueChange={set("compensationType")}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Salary (Lane/Step)</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Retirement System</Label>
              <Select value={form.retirementSystem} onValueChange={set("retirementSystem")}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRS">TRS</SelectItem>
                  <SelectItem value="IMRF">IMRF</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!form.name || !form.code || createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Unit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BargainingUnitEditDialog({
  unit,
  open,
  onClose,
}: {
  unit: BargainingUnit;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateBargainingUnit();

  const [rates, setRates] = useState<BenefitRates>({
    retirementEmployeeRate: unit.retirementEmployeeRate ?? "",
    retirementEmployerRate: unit.retirementEmployerRate ?? "",
    retirementGrossUpRate: unit.retirementGrossUpRate ?? "",
    ficaRate: unit.ficaRate ?? "",
    ficaExempt: unit.ficaExempt ?? false,
    healthInsuranceSingleAnnual: unit.healthInsuranceSingleAnnual ?? "",
    healthInsuranceFamilyAnnual: unit.healthInsuranceFamilyAnnual ?? "",
    dentalAnnual: unit.dentalAnnual ?? "",
    lifeInsuranceAnnual: unit.lifeInsuranceAnnual ?? "",
    disabilityInsuranceAnnual: unit.disabilityInsuranceAnnual ?? "",
    hsaContributionSingle: unit.hsaContributionSingle ?? "",
    hsaContributionFamily: unit.hsaContributionFamily ?? "",
    workersCompRate: unit.workersCompRate ?? "",
  });

  useEffect(() => {
    setRates({
      retirementEmployeeRate: unit.retirementEmployeeRate ?? "",
      retirementEmployerRate: unit.retirementEmployerRate ?? "",
      retirementGrossUpRate: unit.retirementGrossUpRate ?? "",
      ficaRate: unit.ficaRate ?? "",
      ficaExempt: unit.ficaExempt ?? false,
      healthInsuranceSingleAnnual: unit.healthInsuranceSingleAnnual ?? "",
      healthInsuranceFamilyAnnual: unit.healthInsuranceFamilyAnnual ?? "",
      dentalAnnual: unit.dentalAnnual ?? "",
      lifeInsuranceAnnual: unit.lifeInsuranceAnnual ?? "",
      disabilityInsuranceAnnual: unit.disabilityInsuranceAnnual ?? "",
      hsaContributionSingle: unit.hsaContributionSingle ?? "",
      hsaContributionFamily: unit.hsaContributionFamily ?? "",
      workersCompRate: unit.workersCompRate ?? "",
    });
  }, [unit]);

  const set = (field: keyof BenefitRates) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setRates((prev) => ({
      ...prev,
      [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  };

  const handleSave = () => {
    const payload: Record<string, string | boolean | undefined> = {};
    for (const [k, v] of Object.entries(rates)) {
      if (v === "") continue;
      payload[k] = v;
    }
    updateMutation.mutate(
      { id: unit.id, data: payload as Parameters<typeof updateMutation.mutate>[0]["data"] },
      {
        onSuccess: () => {
          toast({ title: "Saved", description: `${unit.name} benefit rates updated.` });
          onClose();
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to save changes.",
            variant: "destructive",
          }),
      }
    );
  };

  const NumField = ({
    label,
    field,
    help,
  }: {
    label: string;
    field: keyof BenefitRates;
    help?: string;
  }) => (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={rates[field] as string}
        onChange={set(field)}
        placeholder="0.00"
        className="font-mono text-right h-8 text-sm bg-background/50"
      />
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Benefit Rates — {unit.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {unit.retirementSystem} retirement system &bull; {unit.compensationType} compensation
          </p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Retirement
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <NumField
                label="Employee Rate (%)"
                field="retirementEmployeeRate"
                help="Employee TRS/IMRF contribution"
              />
              <NumField
                label="Employer Rate (%)"
                field="retirementEmployerRate"
                help="Employer normal cost contribution"
              />
              <NumField
                label="Gross-Up Rate (%)"
                field="retirementGrossUpRate"
                help="Employer picks up employee share"
              />
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              FICA / Social Security
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="FICA Rate (%)" field="ficaRate" />
              <div className="flex items-center gap-3 pt-5">
                <input
                  type="checkbox"
                  id="ficaExempt"
                  checked={rates.ficaExempt}
                  onChange={set("ficaExempt")}
                  className="w-4 h-4"
                />
                <Label htmlFor="ficaExempt" className="text-sm cursor-pointer">
                  FICA Exempt
                </Label>
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Health & Insurance (Annual)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Health — Single ($)"
                field="healthInsuranceSingleAnnual"
                help="Annual district premium — single coverage"
              />
              <NumField
                label="Health — Family ($)"
                field="healthInsuranceFamilyAnnual"
                help="Annual district premium — family coverage"
              />
              <NumField label="Dental ($)" field="dentalAnnual" />
              <NumField label="Life Insurance ($)" field="lifeInsuranceAnnual" />
              <NumField label="Disability Insurance ($)" field="disabilityInsuranceAnnual" />
              <NumField label="Workers' Comp Rate (%)" field="workersCompRate" />
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              HSA Contribution (Annual)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="HSA — Single ($)" field="hsaContributionSingle" />
              <NumField label="HSA — Family ($)" field="hsaContributionFamily" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const { districtId } = useDistrictContext();
  const { toast } = useToast();
  const [editingUnit, setEditingUnit] = useState<BargainingUnit | null>(null);
  const [showAddUnit, setShowAddUnit] = useState(false);

  const { data: district, isLoading: districtLoading } = useGetDistrict(
    districtId!,
    { query: { enabled: !!districtId, queryKey: getGetDistrictQueryKey(districtId!) } }
  );

  const { data: units, isLoading: unitsLoading } = useListBargainingUnits(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }),
      },
    }
  );

  const updateDistrictMutation = useUpdateDistrict();

  const [districtData, setDistrictData] = useState({
    name: "",
    state: "",
    fiscalYearStart: "",
    studentEnrollment: 0,
  });

  useEffect(() => {
    if (district) {
      setDistrictData({
        name: district.name,
        state: district.state || "",
        fiscalYearStart: district.fiscalYearStart || "",
        studentEnrollment: district.studentEnrollment || 0,
      });
    }
  }, [district]);

  const handleSaveDistrict = () => {
    updateDistrictMutation.mutate(
      { id: districtId!, data: districtData },
      {
        onSuccess: () => toast({ title: "Saved", description: "District settings updated." }),
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to save district settings.",
            variant: "destructive",
          }),
      }
    );
  };

  const UNIT_COLOR: Record<string, string> = {
    "Licensed Staff": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "Educational Support Personnel": "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "Custodial & Maintenance": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage district profile and bargaining unit benefit rate configurations.
        </p>
      </div>

      {districtLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>District Profile</CardTitle>
            <CardDescription>Global settings for {district?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>District Name</Label>
                <Input
                  value={districtData.name}
                  onChange={(e) =>
                    setDistrictData((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>State</Label>
                <Input
                  value={districtData.state}
                  onChange={(e) =>
                    setDistrictData((p) => ({ ...p, state: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fiscal Year Start</Label>
                <Input
                  type="date"
                  value={
                    districtData.fiscalYearStart
                      ? districtData.fiscalYearStart.substring(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    setDistrictData((p) => ({
                      ...p,
                      fiscalYearStart: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Student Enrollment</Label>
                <Input
                  type="number"
                  value={districtData.studentEnrollment || ""}
                  onChange={(e) =>
                    setDistrictData((p) => ({
                      ...p,
                      studentEnrollment: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveDistrict}
                disabled={updateDistrictMutation.isPending}
              >
                {updateDistrictMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bargaining Units</CardTitle>
              <CardDescription>
                Edit benefit rates and contract parameters per unit.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddUnit(true)}
              className="gap-1.5 border-border"
            >
              <Plus className="w-3.5 h-3.5" /> Add Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {unitsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-3">
              {units?.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{unit.name}</h4>
                      <span className="text-muted-foreground text-sm font-normal">
                        ({unit.code})
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={UNIT_COLOR[unit.name] ?? ""}
                      >
                        {unit.compensationType}
                      </Badge>
                      <Badge variant="secondary">{unit.retirementSystem}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {unit.contractYears}-yr contract
                      </span>
                      {unit.retirementEmployerRate && (
                        <span className="text-xs text-muted-foreground">
                          Employer retirement:{" "}
                          <span className="font-mono">{unit.retirementEmployerRate}%</span>
                        </span>
                      )}
                      {unit.healthInsuranceSingleAnnual && (
                        <span className="text-xs text-muted-foreground">
                          Health single:{" "}
                          <span className="font-mono">
                            ${parseInt(unit.healthInsuranceSingleAnnual).toLocaleString()}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUnit(unit)}
                    className="border-border"
                  >
                    Edit Rates
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingUnit && (
        <BargainingUnitEditDialog
          unit={editingUnit}
          open={!!editingUnit}
          onClose={() => setEditingUnit(null)}
        />
      )}

      {districtId && (
        <AddBargainingUnitDialog
          open={showAddUnit}
          onClose={() => setShowAddUnit(false)}
          districtId={districtId}
        />
      )}
    </div>
  );
}
