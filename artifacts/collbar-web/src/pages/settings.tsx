import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDistrictContext } from "@/context/DistrictContext";
import {
  useGetDistrict,
  getGetDistrictQueryKey,
  useUpdateDistrict,
  useListEmployeeGroups,
  getListEmployeeGroupsQueryKey,
  useCreateEmployeeGroup,
  useUpdateEmployeeGroup,
  useCreateCompensationSchedule,
  useUpdateCompensationSchedule,
  useDeleteCompensationSchedule,
  useSetCompensationSchedulePrimary,
  EmployeeGroupWithSchedules,
  CompensationSchedule,
  CreateCompensationScheduleRequestScheduleType,
  CreateCompensationScheduleRequestPayType,
  CreateEmployeeGroupRequest,
  UpdateEmployeeGroupRequest,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Star,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StipendTableEditor } from "@/components/StipendTableEditor";
import { FlatRateCategoryEditor } from "@/components/FlatRateCategoryEditor";
import { PerDiemEditor } from "@/components/PerDiemEditor";
import { HourlyCategoryEditor } from "@/components/HourlyCategoryEditor";
import { SalaryRangeEditor } from "@/components/SalaryRangeEditor";
import { IndividualSalaryViewer } from "@/components/IndividualSalaryViewer";
import { ImportGridEditor } from "@/components/ImportGridEditor";
import { IndexBasedGridEditor } from "@/components/IndexBasedGridEditor";

const GROUP_INDEX_COLORS = [
  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "bg-green-500/10 text-green-400 border-green-500/20",
  "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
];

const SCHEDULE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  index_based_grid: {
    label: "Index-Based Grid",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  individual_salary: {
    label: "Individual Salary",
    color: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  },
  direct_import_grid: {
    label: "Direct Import Grid",
    color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  hourly: {
    label: "Hourly",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  per_diem: {
    label: "Per-Diem",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  },
  flat_rate: {
    label: "Flat Rate",
    color: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
  stipend_table: {
    label: "Stipend Table",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  range_based: {
    label: "Range-Based",
    color: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  },
};

const SCHEDULE_TYPE_OPTIONS = [
  { value: "index_based_grid", label: "Index-Based Salary Grid" },
  { value: "individual_salary", label: "Individual Salary + Formula" },
  { value: "direct_import_grid", label: "Direct Import Grid (paste matrix)" },
  { value: "hourly", label: "Hourly Rate Schedule" },
  { value: "per_diem", label: "Per-Diem Rate Schedule" },
  { value: "range_based", label: "Salary Range Schedule" },
  { value: "flat_rate", label: "Flat Rate Schedule" },
  { value: "stipend_table", label: "Stipend Table" },
];

type GroupFormState = {
  name: string;
  code: string;
  contractDays: string;
  isUnionized: boolean;
  bargainingUnitName: string;
  contractStartDate: string;
  contractEndDate: string;
  contractYears: string;
  retirementSystem: string;
  retirementEmployeeRate: string;
  retirementEmployerRate: string;
  retirementGrossUpRate: string;
  ficaRate: string;
  ficaExempt: boolean;
  healthInsuranceSingleAnnual: string;
  healthInsuranceFamilyAnnual: string;
  healthInsuranceEmployerCapRate: string;
  hsaContributionSingle: string;
  hsaContributionFamily: string;
  dentalAnnual: string;
  lifeInsuranceAnnual: string;
  disabilityInsuranceAnnual: string;
  workersCompRate: string;
  notes: string;
};

const DEFAULT_GROUP_FORM: GroupFormState = {
  name: "",
  code: "",
  contractDays: "",
  isUnionized: true,
  bargainingUnitName: "",
  contractStartDate: "",
  contractEndDate: "",
  contractYears: "5",
  retirementSystem: "TRS",
  retirementEmployeeRate: "",
  retirementEmployerRate: "",
  retirementGrossUpRate: "",
  ficaRate: "",
  ficaExempt: false,
  healthInsuranceSingleAnnual: "",
  healthInsuranceFamilyAnnual: "",
  healthInsuranceEmployerCapRate: "",
  hsaContributionSingle: "",
  hsaContributionFamily: "",
  dentalAnnual: "",
  lifeInsuranceAnnual: "",
  disabilityInsuranceAnnual: "",
  workersCompRate: "",
  notes: "",
};

function groupToForm(g: EmployeeGroupWithSchedules): GroupFormState {
  return {
    name: g.name,
    code: g.code,
    contractDays: g.contractDays != null ? String(g.contractDays) : "",
    isUnionized: g.isUnionized,
    bargainingUnitName: g.bargainingUnitName ?? "",
    contractStartDate: g.contractStartDate
      ? g.contractStartDate.substring(0, 10)
      : "",
    contractEndDate: g.contractEndDate
      ? g.contractEndDate.substring(0, 10)
      : "",
    contractYears: String(g.contractYears ?? 5),
    retirementSystem: g.retirementSystem ?? "TRS",
    retirementEmployeeRate: g.retirementEmployeeRate ?? "",
    retirementEmployerRate: g.retirementEmployerRate ?? "",
    retirementGrossUpRate: g.retirementGrossUpRate ?? "",
    ficaRate: g.ficaRate ?? "",
    ficaExempt: g.ficaExempt ?? false,
    healthInsuranceSingleAnnual: g.healthInsuranceSingleAnnual ?? "",
    healthInsuranceFamilyAnnual: g.healthInsuranceFamilyAnnual ?? "",
    healthInsuranceEmployerCapRate: g.healthInsuranceEmployerCapRate ?? "",
    hsaContributionSingle: g.hsaContributionSingle ?? "",
    hsaContributionFamily: g.hsaContributionFamily ?? "",
    dentalAnnual: g.dentalAnnual ?? "",
    lifeInsuranceAnnual: g.lifeInsuranceAnnual ?? "",
    disabilityInsuranceAnnual: g.disabilityInsuranceAnnual ?? "",
    workersCompRate: g.workersCompRate ?? "",
    notes: g.notes ?? "",
  };
}

function buildOptionalRates(form: GroupFormState) {
  return {
    retirementEmployeeRate: form.retirementEmployeeRate || undefined,
    retirementEmployerRate: form.retirementEmployerRate || undefined,
    retirementGrossUpRate: form.retirementGrossUpRate || undefined,
    ficaRate: form.ficaRate || undefined,
    healthInsuranceSingleAnnual: form.healthInsuranceSingleAnnual || undefined,
    healthInsuranceFamilyAnnual: form.healthInsuranceFamilyAnnual || undefined,
    healthInsuranceEmployerCapRate:
      form.healthInsuranceEmployerCapRate || undefined,
    hsaContributionSingle: form.hsaContributionSingle || undefined,
    hsaContributionFamily: form.hsaContributionFamily || undefined,
    dentalAnnual: form.dentalAnnual || undefined,
    lifeInsuranceAnnual: form.lifeInsuranceAnnual || undefined,
    disabilityInsuranceAnnual: form.disabilityInsuranceAnnual || undefined,
    workersCompRate: form.workersCompRate || undefined,
  };
}

function buildCreatePayload(
  form: GroupFormState,
  districtId: string
): CreateEmployeeGroupRequest {
  return {
    districtId,
    name: form.name,
    code: form.code,
    contractDays: form.contractDays ? Number(form.contractDays) : null,
    isUnionized: form.isUnionized,
    bargainingUnitName: form.bargainingUnitName || null,
    contractStartDate: form.contractStartDate || null,
    contractEndDate: form.contractEndDate || null,
    contractYears: form.contractYears ? Number(form.contractYears) : 5,
    retirementSystem: form.retirementSystem,
    ficaExempt: form.ficaExempt,
    notes: form.notes || null,
    ...buildOptionalRates(form),
  };
}

function buildUpdatePayload(form: GroupFormState): UpdateEmployeeGroupRequest {
  return {
    name: form.name,
    code: form.code,
    contractDays: form.contractDays ? Number(form.contractDays) : null,
    isUnionized: form.isUnionized,
    bargainingUnitName: form.bargainingUnitName || null,
    contractStartDate: form.contractStartDate || null,
    contractEndDate: form.contractEndDate || null,
    contractYears: form.contractYears ? Number(form.contractYears) : 5,
    retirementSystem: form.retirementSystem,
    ficaExempt: form.ficaExempt,
    notes: form.notes || null,
    ...buildOptionalRates(form),
  };
}

type SectionConfig = {
  key: string;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

function CollapsibleSections({ sections }: { sections: SectionConfig[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of sections) init[s.key] = s.defaultOpen ?? false;
    return init;
  });
  const toggle = (key: string) =>
    setOpen((p) => ({ ...p, [key]: !p[key] }));
  return (
    <div className="space-y-2">
      {sections.map((s) => (
        <div
          key={s.key}
          className="border border-border rounded-md overflow-hidden"
        >
          <button
            type="button"
            onClick={() => toggle(s.key)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-left bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            {s.label}
            {open[s.key] ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {open[s.key] && (
            <div className="px-4 py-4 space-y-4">{s.children}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "0.00"}
        className="font-mono text-right h-8 text-sm bg-background/50"
      />
    </div>
  );
}

function GroupEditDialog({
  group,
  districtId,
  open,
  onClose,
  onCreated,
}: {
  group: EmployeeGroupWithSchedules | null;
  districtId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (newGroup: EmployeeGroupWithSchedules) => void;
}) {
  const isEdit = group != null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateEmployeeGroup();
  const updateMutation = useUpdateEmployeeGroup();

  const [form, setForm] = useState<GroupFormState>(
    isEdit ? groupToForm(group!) : { ...DEFAULT_GROUP_FORM }
  );

  useEffect(() => {
    if (open) {
      setForm(isEdit ? groupToForm(group!) : { ...DEFAULT_GROUP_FORM });
    }
  }, [open, group, isEdit]);

  const set =
    <K extends keyof GroupFormState>(field: K) =>
    (value: GroupFormState[K]) =>
      setForm((p) => ({ ...p, [field]: value }));

  const handleSave = () => {
    if (!form.name || !form.code) return;
    if (isEdit) {
      updateMutation.mutate(
        {
          id: group!.id,
          data: buildUpdatePayload(form),
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListEmployeeGroupsQueryKey(),
            });
            toast({ title: "Saved", description: `${form.name} updated.` });
            onClose();
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to save group.",
              variant: "destructive",
            }),
        }
      );
    } else {
      createMutation.mutate(
        {
          data: buildCreatePayload(form, districtId),
        },
        {
          onSuccess: (created) => {
            queryClient.invalidateQueries({
              queryKey: getListEmployeeGroupsQueryKey(),
            });
            toast({
              title: "Group created",
              description: `${form.name} has been added.`,
            });
            onClose();
            onCreated?.(created);
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to create group.",
              variant: "destructive",
            }),
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const identityContent = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>
            Group Name <span className="text-red-400">*</span>
          </Label>
          <Input
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="e.g. Licensed Staff"
            className="bg-background/50"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>
            Short Code <span className="text-red-400">*</span>
          </Label>
          <Input
            value={form.code}
            onChange={(e) => set("code")(e.target.value.toUpperCase())}
            placeholder="e.g. LIC"
            className="bg-background/50 uppercase"
            maxLength={10}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Contract Days</Label>
          <Input
            type="number"
            value={form.contractDays}
            onChange={(e) => set("contractDays")(e.target.value)}
            placeholder="e.g. 187"
            className="bg-background/50"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Contract Years</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={form.contractYears}
            onChange={(e) => set("contractYears")(e.target.value)}
            className="bg-background/50"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="unionized"
          checked={form.isUnionized}
          onCheckedChange={(v) => set("isUnionized")(!!v)}
        />
        <Label htmlFor="unionized" className="font-normal cursor-pointer">
          Unionized group
        </Label>
      </div>
      <div className="grid gap-1.5">
        <Label>Union / Association Name</Label>
        <Input
          value={form.bargainingUnitName}
          onChange={(e) => set("bargainingUnitName")(e.target.value)}
          placeholder="e.g. District 21 Education Association"
          className="bg-background/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Contract Start Date</Label>
          <Input
            type="date"
            value={form.contractStartDate}
            onChange={(e) => set("contractStartDate")(e.target.value)}
            className="bg-background/50"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Contract End Date</Label>
          <Input
            type="date"
            value={form.contractEndDate}
            onChange={(e) => set("contractEndDate")(e.target.value)}
            className="bg-background/50"
          />
        </div>
      </div>
    </>
  );

  const retirementContent = (
    <>
      <div className="grid gap-1.5">
        <Label>Retirement System</Label>
        <Select
          value={form.retirementSystem}
          onValueChange={set("retirementSystem")}
        >
          <SelectTrigger className="bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TRS">TRS</SelectItem>
            <SelectItem value="IMRF">IMRF</SelectItem>
            <SelectItem value="PSRS">PSRS</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumField
          label="Employee Rate %"
          value={form.retirementEmployeeRate}
          onChange={set("retirementEmployeeRate")}
        />
        <NumField
          label="Employer Rate %"
          value={form.retirementEmployerRate}
          onChange={set("retirementEmployerRate")}
        />
        <NumField
          label="Gross-Up Rate %"
          value={form.retirementGrossUpRate}
          onChange={set("retirementGrossUpRate")}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          FICA
        </Label>
        <div className="grid grid-cols-2 gap-3 items-end">
          <NumField
            label="FICA Rate %"
            value={form.ficaRate}
            onChange={set("ficaRate")}
          />
          <div className="flex items-center gap-2 pb-1">
            <Checkbox
              id="ficaExempt"
              checked={form.ficaExempt}
              onCheckedChange={(v) => set("ficaExempt")(!!v)}
            />
            <Label htmlFor="ficaExempt" className="font-normal cursor-pointer">
              FICA Exempt
            </Label>
          </div>
        </div>
      </div>
    </>
  );

  const benefitsContent = (
    <>
      <div className="space-y-1">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Health Insurance (Annual)
        </Label>
        <div className="grid grid-cols-3 gap-3 mt-1">
          <NumField
            label="Single"
            value={form.healthInsuranceSingleAnnual}
            onChange={set("healthInsuranceSingleAnnual")}
            placeholder="0"
          />
          <NumField
            label="Family"
            value={form.healthInsuranceFamilyAnnual}
            onChange={set("healthInsuranceFamilyAnnual")}
            placeholder="0"
          />
          <NumField
            label="Employer Cap Rate %"
            value={form.healthInsuranceEmployerCapRate}
            onChange={set("healthInsuranceEmployerCapRate")}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="HSA Single (Annual)"
          value={form.hsaContributionSingle}
          onChange={set("hsaContributionSingle")}
          placeholder="0"
        />
        <NumField
          label="HSA Family (Annual)"
          value={form.hsaContributionFamily}
          onChange={set("hsaContributionFamily")}
          placeholder="0"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="Dental (Annual)"
          value={form.dentalAnnual}
          onChange={set("dentalAnnual")}
          placeholder="0"
        />
        <NumField
          label="Life Insurance (Annual)"
          value={form.lifeInsuranceAnnual}
          onChange={set("lifeInsuranceAnnual")}
          placeholder="0"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="Disability Insurance (Annual)"
          value={form.disabilityInsuranceAnnual}
          onChange={set("disabilityInsuranceAnnual")}
          placeholder="0"
        />
        <NumField
          label="Workers' Comp Rate %"
          value={form.workersCompRate}
          onChange={set("workersCompRate")}
        />
      </div>
    </>
  );

  const notesContent = (
    <div className="grid gap-1.5">
      <Label>Notes</Label>
      <Textarea
        value={form.notes}
        onChange={(e) => set("notes")(e.target.value)}
        placeholder="Optional notes about this group..."
        className="bg-background/50 h-24 resize-none"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Group — ${group!.name}` : "Add Employee Group"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isEdit
              ? "Update group identity, retirement, and benefit settings."
              : "Define a new labor group and configure its compensation settings."}
          </p>
        </DialogHeader>
        <div className="space-y-2 py-1">
          <div className="border border-border rounded-md overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 text-sm font-medium">
              Group Identity
            </div>
            <div className="px-4 py-4 space-y-4">{identityContent}</div>
          </div>
          <CollapsibleSections
            sections={[
              {
                key: "retirement",
                label: "Retirement & Tax",
                defaultOpen: false,
                children: retirementContent,
              },
              {
                key: "benefits",
                label: "Benefits",
                defaultOpen: false,
                children: benefitsContent,
              },
              {
                key: "notes",
                label: "Notes",
                defaultOpen: false,
                children: notesContent,
              },
            ]}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!form.name || !form.code || isPending}
          >
            {isPending ? "Saving..." : isEdit ? "Save Group" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  schedule,
  groupId,
  isFirstSchedule,
  open,
  onClose,
}: {
  schedule: CompensationSchedule | null;
  groupId: string;
  isFirstSchedule: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const isEdit = schedule != null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateCompensationSchedule();
  const updateMutation = useUpdateCompensationSchedule();

  const [form, setForm] = useState({
    name: "",
    scheduleType:
      "individual_salary" as CreateCompensationScheduleRequestScheduleType,
    payType: "salary" as CreateCompensationScheduleRequestPayType,
    description: "",
    effectiveDate: "",
    effectiveDateRule: "",
    isPrimary: isFirstSchedule,
  });

  useEffect(() => {
    if (open) {
      if (isEdit && schedule) {
        setForm({
          name: schedule.name,
          scheduleType: schedule.scheduleType,
          payType: (schedule.payType ?? "salary") as CreateCompensationScheduleRequestPayType,
          description: schedule.description ?? "",
          effectiveDate: schedule.effectiveDate
            ? schedule.effectiveDate.substring(0, 10)
            : "",
          effectiveDateRule: schedule.effectiveDateRule ?? "",
          isPrimary: schedule.isPrimary,
        });
      } else {
        setForm({
          name: "",
          scheduleType: "individual_salary",
          payType: "salary",
          description: "",
          effectiveDate: "",
          effectiveDateRule: "",
          isPrimary: isFirstSchedule,
        });
      }
    }
  }, [open, schedule, isEdit, isFirstSchedule]);

  const set =
    <K extends keyof typeof form>(field: K) =>
    (value: (typeof form)[K]) =>
      setForm((p) => ({ ...p, [field]: value }));

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListEmployeeGroupsQueryKey(),
    });
  };

  const handleSave = () => {
    if (!form.name) return;
    if (isEdit && schedule) {
      updateMutation.mutate(
        {
          id: schedule.id,
          data: {
            name: form.name,
            scheduleType: form.scheduleType,
            payType: form.payType,
            description: form.description || undefined,
            effectiveDate: form.effectiveDate || undefined,
            effectiveDateRule: form.effectiveDateRule || undefined,
            isPrimary: form.isPrimary,
          },
        },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Schedule updated." });
            onClose();
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to save schedule.",
              variant: "destructive",
            }),
        }
      );
    } else {
      createMutation.mutate(
        {
          data: {
            employeeGroupId: groupId,
            name: form.name,
            scheduleType: form.scheduleType,
            payType: form.payType,
            description: form.description || undefined,
            effectiveDate: form.effectiveDate || undefined,
            effectiveDateRule: form.effectiveDateRule || undefined,
            isPrimary: form.isPrimary,
          },
        },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Schedule created." });
            onClose();
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to create schedule.",
              variant: "destructive",
            }),
        }
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Edit Compensation Schedule"
              : "Add Compensation Schedule"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-1.5">
            <Label>
              Schedule Name <span className="text-red-400">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Licensed Staff Salary Schedule"
              className="bg-background/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Schedule Type</Label>
              <Select
                value={form.scheduleType}
                onValueChange={(v) =>
                  set("scheduleType")(
                    v as CreateCompensationScheduleRequestScheduleType
                  )
                }
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Pay Type</Label>
              <Select
                value={form.payType}
                onValueChange={(v) =>
                  set("payType")(v as CreateCompensationScheduleRequestPayType)
                }
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Salary (× FTE)</SelectItem>
                  <SelectItem value="hourly">Hourly (FTE × rate × 2080 hrs)</SelectItem>
                  <SelectItem value="per_diem">Per Diem (rate × contract days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Brief description of this schedule..."
              className="bg-background/50 h-20 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Effective Date (optional)</Label>
              <Input
                type="date"
                value={form.effectiveDate}
                onChange={(e) => set("effectiveDate")(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Effective Date Rule (optional)</Label>
              <Input
                value={form.effectiveDateRule}
                onChange={(e) => set("effectiveDateRule")(e.target.value)}
                placeholder='e.g. "For assignments after..."'
                className="bg-background/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isPrimary"
              checked={form.isPrimary}
              onCheckedChange={(v) => set("isPrimary")(!!v)}
            />
            <Label htmlFor="isPrimary" className="font-normal cursor-pointer">
              Set as Primary schedule
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!form.name || isPending}>
            {isPending
              ? "Saving..."
              : isEdit
              ? "Save Schedule"
              : "Add Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleRow({
  schedule,
  employeeGroupId,
  onEdit,
  onDelete,
}: {
  schedule: CompensationSchedule;
  employeeGroupId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setPrimaryMutation = useSetCompensationSchedulePrimary();
  const [stipendEditorOpen, setStipendEditorOpen] = useState(false);
  const [flatRateEditorOpen, setFlatRateEditorOpen] = useState(false);
  const [perDiemEditorOpen, setPerDiemEditorOpen] = useState(false);
  const [hourlyEditorOpen, setHourlyEditorOpen] = useState(false);
  const [salaryRangeEditorOpen, setSalaryRangeEditorOpen] = useState(false);
  const [individualSalaryOpen, setIndividualSalaryOpen] = useState(false);
  const [importGridOpen, setImportGridOpen] = useState(false);
  const [indexGridOpen, setIndexGridOpen] = useState(false);

  const cfg = SCHEDULE_TYPE_CONFIG[schedule.scheduleType] ?? {
    label: schedule.scheduleType,
    color: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  const handleSetPrimary = () => {
    setPrimaryMutation.mutate(
      { id: schedule.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListEmployeeGroupsQueryKey(),
          });
          toast({ title: "Primary schedule updated." });
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to set primary.",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/30 group">
      <button
        type="button"
        onClick={handleSetPrimary}
        title={schedule.isPrimary ? "Primary schedule" : "Set as primary"}
        className={cn(
          "transition-colors",
          schedule.isPrimary
            ? "text-amber-400"
            : "text-muted-foreground/30 hover:text-amber-400"
        )}
      >
        <Star
          className="h-3.5 w-3.5"
          fill={schedule.isPrimary ? "currentColor" : "none"}
        />
      </button>
      <span className="text-sm flex-1 min-w-0 truncate">{schedule.name}</span>
      {schedule.isPrimary && (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-400"
        >
          Primary
        </Badge>
      )}
      <Badge
        variant="outline"
        className={cn("text-[10px] px-1.5 py-0", cfg.color)}
      >
        {cfg.label}
      </Badge>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {schedule.scheduleType === "stipend_table" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setStipendEditorOpen(true)}
          >
            Manage Table
          </Button>
        )}
        {schedule.scheduleType === "flat_rate" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setFlatRateEditorOpen(true)}
          >
            Manage Positions
          </Button>
        )}
        {schedule.scheduleType === "per_diem" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setPerDiemEditorOpen(true)}
          >
            Configure
          </Button>
        )}
        {schedule.scheduleType === "hourly" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setHourlyEditorOpen(true)}
          >
            Manage Categories
          </Button>
        )}
        {schedule.scheduleType === "range_based" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setSalaryRangeEditorOpen(true)}
          >
            Manage Ranges
          </Button>
        )}
        {schedule.scheduleType === "individual_salary" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setIndividualSalaryOpen(true)}
          >
            View Salaries
          </Button>
        )}
        {schedule.scheduleType === "direct_import_grid" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setImportGridOpen(true)}
          >
            Edit Grid
          </Button>
        )}
        {schedule.scheduleType === "index_based_grid" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setIndexGridOpen(true)}
          >
            Edit Grid
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-400 hover:text-red-300"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {schedule.scheduleType === "stipend_table" && (
        <StipendTableEditor
          open={stipendEditorOpen}
          onClose={() => setStipendEditorOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
          employeeGroupId={employeeGroupId}
        />
      )}

      {schedule.scheduleType === "flat_rate" && (
        <FlatRateCategoryEditor
          open={flatRateEditorOpen}
          onClose={() => setFlatRateEditorOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
        />
      )}

      {schedule.scheduleType === "per_diem" && (
        <PerDiemEditor
          open={perDiemEditorOpen}
          onClose={() => setPerDiemEditorOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
          employeeGroupId={employeeGroupId}
        />
      )}

      {schedule.scheduleType === "hourly" && (
        <HourlyCategoryEditor
          open={hourlyEditorOpen}
          onClose={() => setHourlyEditorOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
        />
      )}

      {schedule.scheduleType === "range_based" && (
        <SalaryRangeEditor
          open={salaryRangeEditorOpen}
          onClose={() => setSalaryRangeEditorOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
        />
      )}

      {schedule.scheduleType === "individual_salary" && (
        <IndividualSalaryViewer
          open={individualSalaryOpen}
          onClose={() => setIndividualSalaryOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
          employeeGroupId={employeeGroupId}
        />
      )}

      {schedule.scheduleType === "direct_import_grid" && (
        <ImportGridEditor
          open={importGridOpen}
          onClose={() => setImportGridOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
        />
      )}

      {schedule.scheduleType === "index_based_grid" && (
        <IndexBasedGridEditor
          open={indexGridOpen}
          onClose={() => setIndexGridOpen(false)}
          scheduleId={schedule.id}
          scheduleName={schedule.name}
        />
      )}
    </div>
  );
}

function EmployeeGroupRow({
  group,
  colorClass,
  onEdit,
}: {
  group: EmployeeGroupWithSchedules;
  colorClass: string;
  onEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);
  const [editSchedule, setEditSchedule] =
    useState<CompensationSchedule | null>(null);
  const [deleteSchedule, setDeleteSchedule] =
    useState<CompensationSchedule | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteScheduleMutation = useDeleteCompensationSchedule();

  const handleDeleteSchedule = () => {
    if (!deleteSchedule) return;
    deleteScheduleMutation.mutate(
      { id: deleteSchedule.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListEmployeeGroupsQueryKey(),
          });
          toast({ title: "Schedule removed." });
          setDeleteSchedule(null);
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to delete schedule.",
            variant: "destructive",
          }),
      }
    );
  };

  const schedules = group.compensationSchedules ?? [];

  return (
    <>
      <div className="rounded-md border border-border bg-muted/20 hover:bg-muted/30 transition-colors">
        <div
          className="flex items-start gap-3 p-3 cursor-pointer select-none"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="mt-0.5 shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-medium text-sm">{group.name}</span>
              <Badge
                variant="outline"
                className={cn("text-[11px] px-1.5 py-0", colorClass)}
              >
                {group.code}
              </Badge>
              {group.contractDays != null && (
                <Badge
                  variant="outline"
                  className="text-[11px] px-1.5 py-0 border-border text-muted-foreground"
                >
                  {group.contractDays} days
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-[11px] px-1.5 py-0 border-border text-muted-foreground"
              >
                {group.retirementSystem ?? "TRS"}
              </Badge>
              {group.contractYears && (
                <Badge
                  variant="outline"
                  className="text-[11px] px-1.5 py-0 border-border text-muted-foreground"
                >
                  {group.contractYears}-yr contract
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {group.isUnionized ? "Unionized" : "Non-Unionized"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {schedules.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">
                  No compensation schedules configured
                </span>
              ) : (
                schedules.map((s) => {
                  const cfg = SCHEDULE_TYPE_CONFIG[s.scheduleType] ?? {
                    label: s.scheduleType,
                    color: "bg-gray-500/10 text-gray-400 border-gray-500/20",
                  };
                  return (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border bg-muted/30 border-border text-muted-foreground"
                    >
                      {s.isPrimary && (
                        <Star
                          className="h-2.5 w-2.5 text-amber-400"
                          fill="currentColor"
                        />
                      )}
                      {s.name}
                      <span
                        className={cn("px-1 rounded text-[10px]", cfg.color)}
                      >
                        {cfg.label}
                      </span>
                    </span>
                  );
                })
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-border shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Edit Group
          </Button>
        </div>

        {expanded && (
          <div className="border-t border-border px-4 pb-3 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Compensation Schedules
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAddScheduleOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Schedule
              </Button>
            </div>
            {schedules.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                No schedules yet. Add one to define how compensation is
                calculated.
              </p>
            ) : (
              <div className="space-y-0.5">
                {schedules.map((s) => (
                  <ScheduleRow
                    key={s.id}
                    schedule={s}
                    employeeGroupId={group.id}
                    onEdit={() => setEditSchedule(s)}
                    onDelete={() => setDeleteSchedule(s)}
                  />
                ))}
              </div>
            )}
            {(group.retirementEmployerRate ||
              group.healthInsuranceSingleAnnual ||
              group.ficaRate) && (
              <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-4">
                {group.retirementEmployerRate && (
                  <span className="text-xs text-muted-foreground">
                    Employer retirement:{" "}
                    <span className="font-mono">
                      {group.retirementEmployerRate}%
                    </span>
                  </span>
                )}
                {group.healthInsuranceSingleAnnual && (
                  <span className="text-xs text-muted-foreground">
                    Health single:{" "}
                    <span className="font-mono">
                      $
                      {parseInt(
                        group.healthInsuranceSingleAnnual
                      ).toLocaleString()}
                    </span>
                  </span>
                )}
                {group.ficaRate && (
                  <span className="text-xs text-muted-foreground">
                    FICA:{" "}
                    <span className="font-mono">{group.ficaRate}%</span>
                    {group.ficaExempt && " (exempt)"}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ScheduleDialog
        schedule={null}
        groupId={group.id}
        isFirstSchedule={schedules.length === 0}
        open={addScheduleOpen}
        onClose={() => setAddScheduleOpen(false)}
      />

      {editSchedule && (
        <ScheduleDialog
          schedule={editSchedule}
          groupId={group.id}
          isFirstSchedule={false}
          open={!!editSchedule}
          onClose={() => setEditSchedule(null)}
        />
      )}

      <AlertDialog
        open={!!deleteSchedule}
        onOpenChange={(v) => !v && setDeleteSchedule(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteSchedule?.name}"? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchedule}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Settings() {
  const { districtId } = useDistrictContext();
  const { toast } = useToast();

  const [editingGroup, setEditingGroup] =
    useState<EmployeeGroupWithSchedules | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [pendingScheduleGroup, setPendingScheduleGroup] =
    useState<EmployeeGroupWithSchedules | null>(null);

  const { data: district, isLoading: districtLoading } = useGetDistrict(
    districtId!,
    {
      query: {
        enabled: !!districtId,
        queryKey: getGetDistrictQueryKey(districtId!),
      },
    }
  );

  const { data: groups, isLoading: groupsLoading } = useListEmployeeGroups(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }),
      },
    }
  );

  const updateDistrictMutation = useUpdateDistrict();

  const [districtData, setDistrictData] = useState({
    name: "",
    state: "",
    fiscalYearStart: "",
    studentEnrollment: 0,
    benefitEligibleFteThreshold: 0.75,
  });

  useEffect(() => {
    if (district) {
      setDistrictData({
        name: district.name,
        state: district.state || "",
        fiscalYearStart: district.fiscalYearStart || "",
        studentEnrollment: district.studentEnrollment || 0,
        benefitEligibleFteThreshold: district.benefitEligibleFteThreshold ?? 0.75,
      });
    }
  }, [district]);

  const handleSaveDistrict = () => {
    updateDistrictMutation.mutate(
      { id: districtId!, data: districtData },
      {
        onSuccess: () =>
          toast({ title: "Saved", description: "District settings updated." }),
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to save district settings.",
            variant: "destructive",
          }),
      }
    );
  };

  const handleGroupCreated = (newGroup: EmployeeGroupWithSchedules) => {
    setPendingScheduleGroup(newGroup);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage district profile and employee group configurations.
        </p>
      </div>

      {districtLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>District Profile</CardTitle>
            <CardDescription>
              Global settings for {district?.name}
            </CardDescription>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Benefit-Eligible FTE Threshold</Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={districtData.benefitEligibleFteThreshold}
                  onChange={(e) =>
                    setDistrictData((p) => ({
                      ...p,
                      benefitEligibleFteThreshold: parseFloat(e.target.value) || 0.75,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Minimum combined FTE for employer-paid benefits (default 0.75)
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSaveDistrict}
                disabled={updateDistrictMutation.isPending}
              >
                {updateDistrictMutation.isPending
                  ? "Saving..."
                  : "Save District"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Employee Groups</CardTitle>
            <CardDescription>
              Configure labor groups, benefits, and their compensation
              schedules.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddGroup(true)}
            className="mt-1 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Employee Group
          </Button>
        </CardHeader>
        <CardContent>
          {groupsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !groups || groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No employee groups configured. Click "+ Add Employee Group" to get
              started.
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group, idx) => (
                <EmployeeGroupRow
                  key={group.id}
                  group={group}
                  colorClass={
                    GROUP_INDEX_COLORS[idx % GROUP_INDEX_COLORS.length]
                  }
                  onEdit={() => setEditingGroup(group)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {districtId && (
        <GroupEditDialog
          group={null}
          districtId={districtId}
          open={showAddGroup}
          onClose={() => setShowAddGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}

      {editingGroup && districtId && (
        <GroupEditDialog
          group={editingGroup}
          districtId={districtId}
          open={!!editingGroup}
          onClose={() => setEditingGroup(null)}
        />
      )}

      {pendingScheduleGroup && (
        <ScheduleDialog
          schedule={null}
          groupId={pendingScheduleGroup.id}
          isFirstSchedule={true}
          open={!!pendingScheduleGroup}
          onClose={() => setPendingScheduleGroup(null)}
        />
      )}
    </div>
  );
}
