import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetIndexGridConfig,
  getGetIndexGridConfigQueryKey,
  useUpsertIndexGridConfig,
  useBulkUpsertIndexGridIndices,
  useListImportGridLanes,
  getListImportGridLanesQueryKey,
  useCreateImportGridLane,
  useDeleteImportGridLane,
  useUpdateImportGridLane,
  ImportGridLane,
  ScheduleIndex,
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSalary(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// LaneHeaderCell — inline rename + delete
// ---------------------------------------------------------------------------

function LaneHeaderCell({
  lane,
  onDelete,
  onRenamed,
}: {
  lane: ImportGridLane;
  onDelete: (lane: ImportGridLane) => void;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lane.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateImportGridLane();

  const startEdit = () => {
    setDraft(lane.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === lane.name) {
      setEditing(false);
      return;
    }
    updateMutation.mutate(
      { id: lane.id, data: { name: trimmed } },
      {
        onSuccess: () => {
          setEditing(false);
          onRenamed();
        },
        onError: () => setEditing(false),
      }
    );
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="text-xs font-semibold bg-muted border border-border rounded px-1 py-0 w-20 text-center outline-none focus:border-primary"
        autoFocus
      />
    );
  }

  return (
    <div className="group flex items-center justify-center gap-1">
      <button
        className="text-xs font-semibold truncate hover:text-primary cursor-text"
        onClick={startEdit}
        title="Click to rename"
      >
        {lane.name}
      </button>
      <button
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-400"
        onClick={() => onDelete(lane)}
        title="Delete lane"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IndexBasedGridEditor
// ---------------------------------------------------------------------------

type IndexMap = Record<string, string>; // "laneId:step" -> indexValue string

export function IndexBasedGridEditor({
  open,
  onClose,
  scheduleId,
  scheduleName,
}: {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  scheduleName: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const upsertConfigMutation = useUpsertIndexGridConfig();
  const upsertIndicesMutation = useBulkUpsertIndexGridIndices();
  const createLaneMutation = useCreateImportGridLane();
  const deleteLaneMutation = useDeleteImportGridLane();

  const [baseAnchor, setBaseAnchor] = useState("40000");
  const [maxSteps, setMaxSteps] = useState("20");
  const [localIndices, setLocalIndices] = useState<IndexMap>({});
  const [isDirty, setIsDirty] = useState(false);
  const [deleteLane, setDeleteLane] = useState<ImportGridLane | null>(null);

  const { data: config, isLoading: configLoading } = useGetIndexGridConfig(
    scheduleId,
    { query: { enabled: open, queryKey: getGetIndexGridConfigQueryKey(scheduleId) } }
  );

  const { data: lanes = [], isLoading: lanesLoading } = useListImportGridLanes(
    scheduleId,
    { query: { enabled: open, queryKey: getListImportGridLanesQueryKey(scheduleId) } }
  );

  // Sync remote state into local on open / data arrival
  useEffect(() => {
    if (!open || !config) return;
    setBaseAnchor(config.baseAnchorSalary);
    setMaxSteps(String(config.maxSteps));
    const map: IndexMap = {};
    config.indices.forEach((idx: ScheduleIndex) => {
      map[`${idx.laneId}:${idx.stepNumber}`] = idx.indexValue;
    });
    setLocalIndices(map);
    setIsDirty(false);
  }, [open, config]);

  const steps = useMemo(
    () => Array.from({ length: parseInt(maxSteps) || 20 }, (_, i) => i + 1),
    [maxSteps]
  );

  const idxKey = (laneId: string, step: number) => `${laneId}:${step}`;

  const handleIndexChange = (laneId: string, step: number, val: string) => {
    setLocalIndices((prev) => ({ ...prev, [idxKey(laneId, step)]: val }));
    setIsDirty(true);
  };

  // Compute preview salary for a cell
  const previewSalary = (laneId: string, step: number): number | null => {
    const base = parseFloat(baseAnchor);
    const idx = parseFloat(localIndices[idxKey(laneId, step)] ?? "");
    if (isNaN(base) || isNaN(idx)) return null;
    return Math.round(base * idx);
  };

  // Fill a lane with a geometric sequence
  const fillLane = (laneId: string) => {
    const start = parseFloat(
      window.prompt("Starting index for Step 1:", "1.0000") ?? ""
    );
    const increment = parseFloat(
      window.prompt("Increment per step (e.g. 0.02 for 2%):", "0.02") ?? ""
    );
    if (isNaN(start) || isNaN(increment)) return;
    const updates: IndexMap = { ...localIndices };
    steps.forEach((s) => {
      updates[idxKey(laneId, s)] = (start + increment * (s - 1)).toFixed(4);
    });
    setLocalIndices(updates);
    setIsDirty(true);
  };

  const handleSave = async () => {
    // Save config
    await upsertConfigMutation.mutateAsync(
      {
        scheduleId,
        data: {
          baseAnchorSalary: baseAnchor,
          maxSteps: parseInt(maxSteps) || 20,
        },
      },
      {
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to save config.",
            variant: "destructive",
          }),
      }
    );

    // Save indices
    const indices = lanes.flatMap((lane) =>
      steps
        .filter((s) => localIndices[idxKey(lane.id, s)])
        .map((s) => ({
          laneId: lane.id,
          stepNumber: s,
          indexValue: parseFloat(localIndices[idxKey(lane.id, s)] || "0").toFixed(4),
          isCapped: false,
        }))
    );

    upsertIndicesMutation.mutate(
      { scheduleId, data: { indices } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetIndexGridConfigQueryKey(scheduleId),
          });
          toast({ title: "Grid saved." });
          setIsDirty(false);
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to save indices.",
            variant: "destructive",
          }),
      }
    );
  };

  const handleAddLane = () => {
    const nextOrder =
      lanes.length > 0 ? Math.max(...lanes.map((l) => l.displayOrder)) + 1 : 0;
    createLaneMutation.mutate(
      {
        scheduleId,
        data: { name: `Lane ${lanes.length + 1}`, displayOrder: nextOrder },
      },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({
            queryKey: getListImportGridLanesQueryKey(scheduleId),
          }),
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to add lane.",
            variant: "destructive",
          }),
      }
    );
  };

  const handleDeleteLane = () => {
    if (!deleteLane) return;
    deleteLaneMutation.mutate(
      { id: deleteLane.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListImportGridLanesQueryKey(scheduleId),
          });
          queryClient.invalidateQueries({
            queryKey: getGetIndexGridConfigQueryKey(scheduleId),
          });
          setDeleteLane(null);
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to delete lane.",
            variant: "destructive",
          }),
      }
    );
  };

  const isLoading = configLoading || lanesLoading;
  const isSaving =
    upsertConfigMutation.isPending || upsertIndicesMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-card border-border max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{scheduleName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400"
              >
                Index-Based Grid
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Config bar */}
          <div className="flex items-end gap-4 pb-3 border-b border-border shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Base Anchor Salary ($)</Label>
              <Input
                type="number"
                min={0}
                step={500}
                value={baseAnchor}
                onChange={(e) => {
                  setBaseAnchor(e.target.value);
                  setIsDirty(true);
                }}
                className="h-8 w-36 font-mono text-right text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Steps</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxSteps}
                onChange={(e) => {
                  setMaxSteps(e.target.value);
                  setIsDirty(true);
                }}
                className="h-8 w-20 font-mono text-right text-sm"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={handleAddLane}
                disabled={createLaneMutation.isPending}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Lane
              </Button>
              {isDirty && (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {isSaving ? "Saving…" : "Save Grid"}
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-auto flex-1 min-h-0">
            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : lanes.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No lanes defined yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "+ Add Lane" to add columns (e.g. BA, MA, PhD).
                </p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card z-10 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1.5 w-16 border-b border-border">
                      Step
                    </th>
                    {lanes.map((lane) => (
                      <th
                        key={lane.id}
                        colSpan={2}
                        className="text-center px-1 py-1.5 border-b border-border"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <LaneHeaderCell
                            lane={lane}
                            onDelete={setDeleteLane}
                            onRenamed={() =>
                              queryClient.invalidateQueries({
                                queryKey: getListImportGridLanesQueryKey(scheduleId),
                              })
                            }
                          />
                          <div className="flex gap-2 text-[10px] text-muted-foreground font-normal">
                            <span className="w-20 text-center">Index</span>
                            <span className="w-24 text-right">= Salary</span>
                          </div>
                          <button
                            className="text-[10px] text-blue-400 hover:text-blue-300"
                            onClick={() => fillLane(lane.id)}
                            title="Auto-fill with geometric sequence"
                          >
                            <RefreshCw className="h-2.5 w-2.5 inline mr-0.5" />
                            auto-fill
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => (
                    <tr
                      key={step}
                      className="hover:bg-muted/20 group"
                    >
                      <td className="sticky left-0 bg-card z-10 text-xs font-mono text-muted-foreground px-2 py-0.5 border-b border-border/50">
                        {step}
                      </td>
                      {lanes.map((lane) => {
                        const key = idxKey(lane.id, step);
                        const val = localIndices[key] ?? "";
                        const salary = previewSalary(lane.id, step);
                        return (
                          <>
                            <td
                              key={`${lane.id}-idx`}
                              className="px-0.5 py-0.5 border-b border-border/50 w-20"
                            >
                              <Input
                                type="number"
                                min={0}
                                step={0.0001}
                                value={val}
                                onChange={(e) =>
                                  handleIndexChange(lane.id, step, e.target.value)
                                }
                                placeholder="—"
                                className={cn(
                                  "h-7 text-right font-mono text-xs px-1.5 border-0 bg-transparent w-20",
                                  "focus:bg-muted/40 focus:border focus:border-border",
                                  val
                                    ? "text-foreground"
                                    : "text-muted-foreground/40"
                                )}
                              />
                            </td>
                            <td
                              key={`${lane.id}-sal`}
                              className="px-2 py-0.5 border-b border-border/50 w-24 text-right"
                            >
                              <span
                                className={cn(
                                  "text-xs font-mono tabular-nums",
                                  salary !== null
                                    ? "text-muted-foreground"
                                    : "text-muted-foreground/30"
                                )}
                              >
                                {salary !== null ? formatSalary(salary) : "—"}
                              </span>
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {lanes.length > 0 && (
            <DialogFooter className="shrink-0 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground mr-auto">
                {lanes.length} lane{lanes.length !== 1 ? "s" : ""} ×{" "}
                {steps.length} steps · Base{" "}
                {parseFloat(baseAnchor) > 0
                  ? formatSalary(parseFloat(baseAnchor))
                  : "—"}
              </span>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {isDirty && (
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {isSaving ? "Saving…" : "Save Grid"}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteLane}
        onOpenChange={(v) => !v && setDeleteLane(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lane</AlertDialogTitle>
            <AlertDialogDescription>
              Delete lane "{deleteLane?.name}" and all its index values? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLane}
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
