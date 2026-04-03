import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPerDiemConfig,
  getGetPerDiemConfigQueryKey,
  useUpsertPerDiemConfig,
  useListPerDiemCaps,
  getListPerDiemCapsQueryKey,
  useCreatePerDiemCap,
  useUpdatePerDiemCap,
  useDeletePerDiemCap,
  useListCompensationSchedules,
  getListCompensationSchedulesQueryKey,
  PerDiemConfig,
  PerDiemCap,
  CompensationSchedule,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// CapFormDialog — Add / Edit a per-diem cap
// ---------------------------------------------------------------------------

interface CapFormState {
  laneId: string;
  capStep: string;
  capRateDollars: string;
}

function CapFormDialog({
  open,
  onClose,
  scheduleId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  existing: PerDiemCap | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreatePerDiemCap();
  const updateMutation = useUpdatePerDiemCap();

  const [form, setForm] = useState<CapFormState>(() =>
    existing
      ? {
          laneId: existing.laneId,
          capStep: String(existing.capStep),
          capRateDollars: (existing.capRateCents / 100).toFixed(2),
        }
      : { laneId: "", capStep: "", capRateDollars: "" }
  );

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm(
        existing
          ? {
              laneId: existing.laneId,
              capStep: String(existing.capStep),
              capRateDollars: (existing.capRateCents / 100).toFixed(2),
            }
          : { laneId: "", capStep: "", capRateDollars: "" }
      );
    }
    if (!v) onClose();
  };

  const handleSave = () => {
    if (!form.laneId.trim()) {
      toast({ title: "Lane ID is required.", variant: "destructive" });
      return;
    }

    const payload = {
      laneId: form.laneId.trim(),
      capStep: parseInt(form.capStep) || 0,
      capRateCents: Math.round(parseFloat(form.capRateDollars || "0") * 100),
    };

    if (existing) {
      updateMutation.mutate(
        { id: existing.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPerDiemCapsQueryKey(scheduleId) });
            toast({ title: "Cap updated." });
            onClose();
          },
          onError: () =>
            toast({ title: "Error", description: "Failed to update cap.", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { scheduleId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListPerDiemCapsQueryKey(scheduleId) });
            toast({ title: "Cap added." });
            onClose();
          },
          onError: () =>
            toast({ title: "Error", description: "Failed to add cap.", variant: "destructive" }),
        }
      );
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Cap" : "Add Cap"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Lane ID (UUID)</Label>
            <Input
              value={form.laneId}
              onChange={(e) => setForm((p) => ({ ...p, laneId: e.target.value }))}
              placeholder="Paste the lane UUID from the salary schedule"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Find the lane UUID in the salary schedule grid editor.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cap Applies at Step ≥</Label>
              <Input
                type="number"
                min={0}
                value={form.capStep}
                onChange={(e) => setForm((p) => ({ ...p, capStep: e.target.value }))}
                placeholder="e.g. 10"
              />
            </div>

            <div className="space-y-1">
              <Label>Max Daily Rate ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.capRateDollars}
                onChange={(e) => setForm((p) => ({ ...p, capRateDollars: e.target.value }))}
                placeholder="0.00"
                className="font-mono text-right"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isBusy || !form.laneId.trim()}>
            {existing ? "Save Changes" : "Add Cap"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ConfigSection — contract days, derivation method, source schedule
// ---------------------------------------------------------------------------

function ConfigSection({
  scheduleId,
  employeeGroupId,
  config,
}: {
  scheduleId: string;
  employeeGroupId: string;
  config: PerDiemConfig | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const upsertMutation = useUpsertPerDiemConfig();

  const [contractDays, setContractDays] = useState(
    String(config?.contractDays ?? 187)
  );
  const [derivationMethod, setDerivationMethod] = useState<
    "from_salary_schedule" | "independent"
  >(
    (config?.derivationMethod as "from_salary_schedule" | "independent") ??
      "independent"
  );
  const [sourceScheduleId, setSourceScheduleId] = useState(
    config?.sourceScheduleId ?? ""
  );
  const [dirty, setDirty] = useState(false);

  // Sync when config loads
  useEffect(() => {
    setContractDays(String(config?.contractDays ?? 187));
    setDerivationMethod(
      (config?.derivationMethod as "from_salary_schedule" | "independent") ??
        "independent"
    );
    setSourceScheduleId(config?.sourceScheduleId ?? "");
    setDirty(false);
  }, [config]);

  const scheduleParams = { employeeGroupId };
  const { data: allSchedules = [] } = useListCompensationSchedules(
    scheduleParams,
    {
      query: {
        enabled: derivationMethod === "from_salary_schedule",
        queryKey: getListCompensationSchedulesQueryKey(scheduleParams),
      },
    }
  );

  // Salary-type schedules suitable as source
  const salarySchedules = allSchedules.filter(
    (s: CompensationSchedule) =>
      s.id !== scheduleId &&
      ["index_based_grid", "individual_salary", "direct_import_grid"].includes(
        s.scheduleType
      )
  );

  const handleSave = () => {
    upsertMutation.mutate(
      {
        scheduleId,
        data: {
          contractDays: parseInt(contractDays) || 187,
          derivationMethod,
          sourceScheduleId:
            derivationMethod === "from_salary_schedule" && sourceScheduleId
              ? sourceScheduleId
              : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetPerDiemConfigQueryKey(scheduleId),
          });
          toast({ title: "Configuration saved." });
          setDirty(false);
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to save configuration.",
            variant: "destructive",
          }),
      }
    );
  };

  const mark = () => setDirty(true);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Contract Days</Label>
          <Input
            type="number"
            min={1}
            value={contractDays}
            onChange={(e) => { setContractDays(e.target.value); mark(); }}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Used as the divisor when deriving daily rate from annual salary.
          </p>
        </div>

        <div className="space-y-1">
          <Label>Derivation Method</Label>
          <Select
            value={derivationMethod}
            onValueChange={(v) => {
              setDerivationMethod(v as typeof derivationMethod);
              mark();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="independent">
                Independent — apply increase rules to employee salary
              </SelectItem>
              <SelectItem value="from_salary_schedule">
                From Salary Schedule — divide annual salary by contract days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {derivationMethod === "from_salary_schedule" && (
        <div className="space-y-1">
          <Label>Source Salary Schedule</Label>
          {salarySchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No salary-type schedules found in this group.
            </p>
          ) : (
            <Select
              value={sourceScheduleId}
              onValueChange={(v) => { setSourceScheduleId(v); mark(); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select schedule…" />
              </SelectTrigger>
              <SelectContent>
                {salarySchedules.map((s: CompensationSchedule) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">
            Daily rate = employee's projected annual salary ÷ contract days.
          </p>
        </div>
      )}

      {dirty && (
        <Button
          size="sm"
          onClick={handleSave}
          disabled={upsertMutation.isPending}
          className="mt-1"
        >
          <Save className="h-3 w-3 mr-1" />
          {upsertMutation.isPending ? "Saving…" : "Save Configuration"}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PerDiemEditor — main panel opened from ScheduleRow
// ---------------------------------------------------------------------------

export function PerDiemEditor({
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeletePerDiemCap();

  const [addCapOpen, setAddCapOpen] = useState(false);
  const [editCap, setEditCap] = useState<PerDiemCap | null>(null);
  const [deleteCap, setDeleteCap] = useState<PerDiemCap | null>(null);

  const { data: config, isLoading: configLoading } = useGetPerDiemConfig(
    scheduleId,
    { query: { enabled: open, queryKey: getGetPerDiemConfigQueryKey(scheduleId) } }
  );

  const { data: caps = [], isLoading: capsLoading } = useListPerDiemCaps(
    scheduleId,
    { query: { enabled: open, queryKey: getListPerDiemCapsQueryKey(scheduleId) } }
  );

  const handleDeleteCap = () => {
    if (!deleteCap) return;
    deleteMutation.mutate(
      { id: deleteCap.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPerDiemCapsQueryKey(scheduleId) });
          toast({ title: "Cap removed." });
          setDeleteCap(null);
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to remove cap.", variant: "destructive" }),
      }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-card border-border max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{scheduleName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-orange-500/30 text-orange-400"
              >
                Per-Diem
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Config section */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Configuration
              </p>
              {configLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <ConfigSection
                  scheduleId={scheduleId}
                  employeeGroupId={employeeGroupId}
                  config={config ?? null}
                />
              )}
            </div>

            {/* Caps section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Daily Rate Caps
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Optional — cap the daily rate for employees in specific lanes at or above a step threshold.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => setAddCapOpen(true)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Cap
                </Button>
              </div>

              {capsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : caps.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">
                  No caps defined. All employees will use the calculated daily rate.
                </p>
              ) : (
                <div className="space-y-0.5">
                  <div className="grid grid-cols-[1fr_80px_120px_64px] gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Lane ID</span>
                    <span>Step ≥</span>
                    <span className="text-right">Max Daily Rate</span>
                    <span />
                  </div>
                  {caps.map((cap) => (
                    <div
                      key={cap.id}
                      className={cn(
                        "grid grid-cols-[1fr_80px_120px_64px] gap-2 items-center px-2 py-1.5 rounded",
                        "hover:bg-muted/30 group"
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {cap.laneId}
                      </span>
                      <span className="text-sm tabular-nums">{cap.capStep}</span>
                      <span className="text-sm font-mono text-right tabular-nums">
                        {formatDollars(cap.capRateCents)}
                      </span>
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditCap(cap)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteCap(cap)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CapFormDialog
        open={addCapOpen}
        onClose={() => setAddCapOpen(false)}
        scheduleId={scheduleId}
        existing={null}
      />

      {editCap && (
        <CapFormDialog
          open={!!editCap}
          onClose={() => setEditCap(null)}
          scheduleId={scheduleId}
          existing={editCap}
        />
      )}

      <AlertDialog
        open={!!deleteCap}
        onOpenChange={(v) => !v && setDeleteCap(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Cap</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this cap? Employees in this lane will no longer have a daily
              rate ceiling.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCap}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
