import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListStipendDefinitions,
  getListStipendDefinitionsQueryKey,
  useCreateStipendDefinition,
  useUpdateStipendDefinition,
  useDeleteStipendDefinition,
  useListStipendAssignments,
  getListStipendAssignmentsQueryKey,
  useCreateStipendAssignment,
  useDeleteStipendAssignment,
  useListEmployees,
  getListEmployeesQueryKey,
  StipendDefinition,
  EmployeeStipendAssignment,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AMOUNT_TYPE_LABELS: Record<string, string> = {
  fixed_dollar: "Fixed $",
  percentage_of_base: "% of Base",
  hourly: "Hourly",
  per_event: "Per Event",
};

const AMOUNT_TYPE_OPTIONS = [
  { value: "fixed_dollar", label: "Fixed Dollar Amount" },
  { value: "percentage_of_base", label: "Percentage of Base Salary" },
  { value: "hourly", label: "Hourly Rate × Hours" },
  { value: "per_event", label: "Per Event × Count" },
];

function formatAmount(def: StipendDefinition): string {
  const cents = def.amountCents ?? 0;
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  switch (def.amountType) {
    case "fixed_dollar":
      return dollars;
    case "percentage_of_base":
      return `${def.percentageValue ?? "0"}% of base`;
    case "hourly":
      return `${dollars}/hr`;
    case "per_event":
      return `${dollars}/event`;
    default:
      return dollars;
  }
}

// ---------------------------------------------------------------------------
// StipendDefinitionForm — used by both Add and Edit dialogs
// ---------------------------------------------------------------------------

interface DefinitionFormState {
  name: string;
  category: string;
  amountType: string;
  amountDollars: string; // dollar input, converted to cents on save
  percentageValue: string;
  maxAmountDollars: string;
  increaseWithBase: boolean;
  trsCreditable: boolean;
  imrfCreditable: boolean;
  displayOrder: string;
  active: boolean;
}

const emptyForm = (): DefinitionFormState => ({
  name: "",
  category: "General",
  amountType: "fixed_dollar",
  amountDollars: "",
  percentageValue: "",
  maxAmountDollars: "",
  increaseWithBase: false,
  trsCreditable: false,
  imrfCreditable: false,
  displayOrder: "0",
  active: true,
});

function definitionToForm(def: StipendDefinition): DefinitionFormState {
  return {
    name: def.name,
    category: def.category,
    amountType: def.amountType,
    amountDollars: def.amountCents
      ? (def.amountCents / 100).toString()
      : "",
    percentageValue: def.percentageValue ?? "",
    maxAmountDollars: def.maxAmountCents
      ? (def.maxAmountCents / 100).toString()
      : "",
    increaseWithBase: def.increaseWithBase,
    trsCreditable: def.trsCreditable,
    imrfCreditable: def.imrfCreditable,
    displayOrder: def.displayOrder.toString(),
    active: def.active,
  };
}

function formToPayload(form: DefinitionFormState) {
  const amountCents = form.amountDollars
    ? Math.round(parseFloat(form.amountDollars) * 100)
    : 0;
  const maxAmountCents = form.maxAmountDollars
    ? Math.round(parseFloat(form.maxAmountDollars) * 100)
    : null;
  return {
    name: form.name.trim(),
    category: form.category.trim() || "General",
    amountType: form.amountType as
      | "fixed_dollar"
      | "percentage_of_base"
      | "hourly"
      | "per_event",
    amountCents,
    percentageValue:
      form.amountType === "percentage_of_base" && form.percentageValue
        ? form.percentageValue
        : null,
    maxAmountCents,
    increaseWithBase: form.increaseWithBase,
    trsCreditable: form.trsCreditable,
    imrfCreditable: form.imrfCreditable,
    displayOrder: parseInt(form.displayOrder) || 0,
    active: form.active,
  };
}

function StipendDefinitionDialog({
  open,
  onClose,
  scheduleId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  existing: StipendDefinition | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateStipendDefinition();
  const updateMutation = useUpdateStipendDefinition();

  const [form, setForm] = useState<DefinitionFormState>(
    existing ? definitionToForm(existing) : emptyForm()
  );

  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setForm(existing ? definitionToForm(existing) : emptyForm());
    if (!v) onClose();
  };

  const set = (key: keyof DefinitionFormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required.", variant: "destructive" });
      return;
    }
    const payload = formToPayload(form);
    if (existing) {
      updateMutation.mutate(
        { id: existing.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListStipendDefinitionsQueryKey(scheduleId),
            });
            toast({ title: "Stipend updated." });
            onClose();
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to update stipend.",
              variant: "destructive",
            }),
        }
      );
    } else {
      createMutation.mutate(
        { scheduleId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListStipendDefinitionsQueryKey(scheduleId),
            });
            toast({ title: "Stipend added." });
            onClose();
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to create stipend.",
              variant: "destructive",
            }),
        }
      );
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const showPercentage = form.amountType === "percentage_of_base";
  const showMax =
    form.amountType === "percentage_of_base" ||
    form.amountType === "hourly" ||
    form.amountType === "per_event";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit Stipend" : "Add Stipend"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Department Chair, Extra Duty"
              />
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="General"
              />
            </div>

            <div className="space-y-1">
              <Label>Display Order</Label>
              <Input
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(e) => set("displayOrder", e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Amount Type</Label>
              <Select
                value={form.amountType}
                onValueChange={(v) => set("amountType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AMOUNT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showPercentage ? (
              <div className="col-span-2 space-y-1">
                <Label>Percentage of Base (%)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.percentageValue}
                  onChange={(e) => set("percentageValue", e.target.value)}
                  placeholder="e.g. 5.00"
                />
              </div>
            ) : (
              <div className="col-span-2 space-y-1">
                <Label>
                  {form.amountType === "hourly"
                    ? "Hourly Rate ($)"
                    : form.amountType === "per_event"
                    ? "Per-Event Amount ($)"
                    : "Amount ($)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.amountDollars}
                  onChange={(e) => set("amountDollars", e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            {showMax && (
              <div className="col-span-2 space-y-1">
                <Label>Max Amount Cap ($ — optional)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.maxAmountDollars}
                  onChange={(e) => set("maxAmountDollars", e.target.value)}
                  placeholder="Leave blank for no cap"
                />
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Options
            </Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.increaseWithBase}
                  onCheckedChange={(v) => set("increaseWithBase", !!v)}
                />
                Increases with base salary each contract year
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.trsCreditable}
                  onCheckedChange={(v) => set("trsCreditable", !!v)}
                />
                TRS creditable earnings
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.imrfCreditable}
                  onCheckedChange={(v) => set("imrfCreditable", !!v)}
                />
                IMRF creditable earnings
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(v) => set("active", !!v)}
                />
                Active
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isBusy}>
            {existing ? "Save Changes" : "Add Stipend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AssignEmployeeDialog
// ---------------------------------------------------------------------------

function AssignEmployeeDialog({
  open,
  onClose,
  definitionId,
  employeeGroupId,
  existingAssignments,
}: {
  open: boolean;
  onClose: () => void;
  definitionId: string;
  employeeGroupId: string;
  existingAssignments: EmployeeStipendAssignment[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateStipendAssignment();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [overrideDollars, setOverrideDollars] = useState("");
  const [hoursOrEvents, setHoursOrEvents] = useState("");
  const [notes, setNotes] = useState("");

  const employeeParams = { employeeGroupId };
  const { data: employeeList, isLoading } = useListEmployees(employeeParams, {
    query: {
      enabled: open,
      queryKey: getListEmployeesQueryKey(employeeParams),
    },
  });

  const assignedIds = new Set(existingAssignments.map((a) => a.employeeId));
  const available = (employeeList?.employees ?? []).filter(
    (e) => !assignedIds.has(e.id)
  );

  const handleClose = () => {
    setSelectedEmployeeId("");
    setOverrideDollars("");
    setHoursOrEvents("");
    setNotes("");
    onClose();
  };

  const handleAssign = () => {
    if (!selectedEmployeeId) {
      toast({ title: "Select an employee.", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        definitionId,
        data: {
          employeeId: selectedEmployeeId,
          overrideAmountCents: overrideDollars
            ? Math.round(parseFloat(overrideDollars) * 100)
            : null,
          hoursOrEvents: hoursOrEvents || null,
          notes: notes || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListStipendAssignmentsQueryKey(definitionId),
          });
          toast({ title: "Employee assigned." });
          handleClose();
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to assign employee.",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign Employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Employee</Label>
            {isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                All employees in this group are already assigned.
              </p>
            ) : (
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.lastName}, {e.firstName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1">
            <Label>
              Override Amount ($){" "}
              <span className="text-muted-foreground font-normal">
                — optional
              </span>
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={overrideDollars}
              onChange={(e) => setOverrideDollars(e.target.value)}
              placeholder="Leave blank to use definition amount"
            />
          </div>

          <div className="space-y-1">
            <Label>
              Hours / Events{" "}
              <span className="text-muted-foreground font-normal">
                — for hourly/per-event types
              </span>
            </Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={hoursOrEvents}
              onChange={(e) => setHoursOrEvents(e.target.value)}
              placeholder="e.g. 40"
            />
          </div>

          <div className="space-y-1">
            <Label>
              Notes{" "}
              <span className="text-muted-foreground font-normal">
                — optional
              </span>
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Department Chair — Math"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={
              createMutation.isPending ||
              !selectedEmployeeId ||
              available.length === 0
            }
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DefinitionRow — expandable row showing a stipend definition + its employees
// ---------------------------------------------------------------------------

function DefinitionRow({
  definition,
  scheduleId,
  employeeGroupId,
  onEdit,
  onDelete,
}: {
  definition: StipendDefinition;
  scheduleId: string;
  employeeGroupId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const deleteMutation = useDeleteStipendAssignment();

  const { data: assignments = [], isLoading: assignmentsLoading } =
    useListStipendAssignments(definition.id, {
      query: {
        enabled: expanded,
        queryKey: getListStipendAssignmentsQueryKey(definition.id),
      },
    });

  const handleRemoveAssignment = (assignmentId: string) => {
    deleteMutation.mutate(
      { id: assignmentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListStipendAssignmentsQueryKey(definition.id),
          });
          toast({ title: "Assignment removed." });
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to remove assignment.",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <>
      <div className="rounded border border-border bg-muted/10">
        {/* Definition header row */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          <span className="text-sm font-medium flex-1 min-w-0 truncate">
            {definition.name}
          </span>

          {definition.category !== "General" && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-border text-muted-foreground"
            >
              {definition.category}
            </Badge>
          )}

          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-border text-muted-foreground font-mono"
          >
            {formatAmount(definition)}
          </Badge>

          {definition.trsCreditable && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400"
            >
              TRS
            </Badge>
          )}
          {definition.imrfCreditable && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-400"
            >
              IMRF
            </Badge>
          )}
          {definition.increaseWithBase && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-400"
            >
              Escalates
            </Badge>
          )}
          {!definition.active && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-border text-muted-foreground"
            >
              Inactive
            </Badge>
          )}

          <div className="flex gap-1 shrink-0">
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
        </div>

        {/* Expanded employee assignments */}
        {expanded && (
          <div className="border-t border-border px-3 pb-2 pt-2">
            {assignmentsLoading ? (
              <Skeleton className="h-6 w-full" />
            ) : assignments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-0.5">
                No employees assigned yet.
              </p>
            ) : (
              <div className="space-y-0.5 mb-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 text-xs py-0.5 group"
                  >
                    <span className="flex-1 text-muted-foreground">
                      {a.employeeLastName}, {a.employeeFirstName}
                    </span>
                    {a.overrideAmountCents != null && (
                      <span className="font-mono text-amber-400">
                        override:{" "}
                        {(a.overrideAmountCents / 100).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          minimumFractionDigits: 0,
                        })}
                      </span>
                    )}
                    {a.hoursOrEvents != null && (
                      <span className="font-mono text-muted-foreground">
                        ×{a.hoursOrEvents}
                      </span>
                    )}
                    {a.notes && (
                      <span className="text-muted-foreground/60 truncate max-w-[120px]">
                        {a.notes}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                      onClick={() => handleRemoveAssignment(a.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setAssignOpen(true)}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Assign Employee
            </Button>
          </div>
        )}
      </div>

      <AssignEmployeeDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        definitionId={definition.id}
        employeeGroupId={employeeGroupId}
        existingAssignments={assignments}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// StipendTableEditor — the main panel opened from ScheduleRow
// ---------------------------------------------------------------------------

export function StipendTableEditor({
  open,
  onClose,
  scheduleId,
  scheduleName,
  employeeGroupId,
}: {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  scheduleName: string;
  employeeGroupId: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteMutation = useDeleteStipendDefinition();

  const [addOpen, setAddOpen] = useState(false);
  const [editDef, setEditDef] = useState<StipendDefinition | null>(null);
  const [deleteDef, setDeleteDef] = useState<StipendDefinition | null>(null);

  const { data: definitions = [], isLoading } = useListStipendDefinitions(
    scheduleId,
    {
      query: {
        enabled: open,
        queryKey: getListStipendDefinitionsQueryKey(scheduleId),
      },
    }
  );

  const handleDelete = () => {
    if (!deleteDef) return;
    deleteMutation.mutate(
      { id: deleteDef.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListStipendDefinitionsQueryKey(scheduleId),
          });
          toast({ title: "Stipend deleted." });
          setDeleteDef(null);
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to delete stipend.",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{scheduleName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-purple-500/30 text-purple-400"
              >
                Stipend Table
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stipend Definitions
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Stipend
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : definitions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No stipends defined yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "+ Add Stipend" to create your first stipend entry.
                </p>
              </div>
            ) : (
              definitions.map((def) => (
                <DefinitionRow
                  key={def.id}
                  definition={def}
                  scheduleId={scheduleId}
                  employeeGroupId={employeeGroupId}
                  onEdit={() => setEditDef(def)}
                  onDelete={() => setDeleteDef(def)}
                />
              ))
            )}
          </div>

          <div className="pt-2 border-t border-border mt-2">
            <p className="text-xs text-muted-foreground">
              Expand a stipend row to assign employees and set optional
              overrides.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <StipendDefinitionDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scheduleId={scheduleId}
        existing={null}
      />

      {editDef && (
        <StipendDefinitionDialog
          open={!!editDef}
          onClose={() => setEditDef(null)}
          scheduleId={scheduleId}
          existing={editDef}
        />
      )}

      <AlertDialog
        open={!!deleteDef}
        onOpenChange={(v) => !v && setDeleteDef(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stipend</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteDef?.name}"? This will also remove all employee
              assignments for this stipend. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
