import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListImportGridLanes,
  getListImportGridLanesQueryKey,
  useCreateImportGridLane,
  useUpdateImportGridLane,
  useDeleteImportGridLane,
  useListImportGridCells,
  getListImportGridCellsQueryKey,
  useBulkUpsertImportGridCells,
  ImportGridLane,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centsToDisplay(cents: number): string {
  return cents === 0 ? "" : (cents / 100).toFixed(0);
}

function displayToCents(val: string): number {
  const cleaned = val.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  return Math.round(parseFloat(cleaned) * 100);
}

// ---------------------------------------------------------------------------
// LaneHeaderCell — inline-editable lane name
// ---------------------------------------------------------------------------

function LaneHeaderCell({
  lane,
  onRename,
  onDelete,
}: {
  lane: ImportGridLane;
  onRename: (id: string, name: string) => void;
  onDelete: (lane: ImportGridLane) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lane.name);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== lane.name) onRename(lane.id, trimmed);
    else setValue(lane.name);
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(lane.name); setEditing(false); }
        }}
        className="h-6 text-xs font-semibold text-center px-1 w-full"
        autoFocus
      />
    );
  }

  return (
    <div
      className="group flex items-center justify-center gap-1 cursor-pointer"
      onClick={() => setEditing(true)}
    >
      <span className="text-xs font-semibold truncate">{lane.name}</span>
      <button
        className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-400"
        onClick={(e) => { e.stopPropagation(); onDelete(lane); }}
        title="Delete lane"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImportGridEditor
// ---------------------------------------------------------------------------

// Local cell map: "laneId:stepNumber" -> cents string (what the user typed)
type CellMap = Record<string, string>;

export function ImportGridEditor({
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

  const createLaneMutation = useCreateImportGridLane();
  const updateLaneMutation = useUpdateImportGridLane();
  const deleteLaneMutation = useDeleteImportGridLane();
  const bulkUpsertMutation = useBulkUpsertImportGridCells();

  const [deleteLane, setDeleteLane] = useState<ImportGridLane | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [localCells, setLocalCells] = useState<CellMap>({});
  const [stepCount, setStepCount] = useState(10);

  const { data: lanes = [], isLoading: lanesLoading } = useListImportGridLanes(
    scheduleId,
    { query: { enabled: open, queryKey: getListImportGridLanesQueryKey(scheduleId) } }
  );

  const { data: cells = [], isLoading: cellsLoading } = useListImportGridCells(
    scheduleId,
    { query: { enabled: open, queryKey: getListImportGridCellsQueryKey(scheduleId) } }
  );

  // Sync remote cells → local state when data arrives (or dialog re-opens)
  useEffect(() => {
    if (!open) return;
    const map: CellMap = {};
    cells.forEach((c) => {
      map[`${c.laneId}:${c.stepNumber}`] = centsToDisplay(c.salaryCents);
    });
    setLocalCells(map);
    setIsDirty(false);
    // Set step count to max of existing cells or default 10
    const maxStep = cells.reduce((m, c) => Math.max(m, c.stepNumber), 0);
    if (maxStep > 0) setStepCount(maxStep);
  }, [open, cells]);

  const cellKey = (laneId: string, step: number) => `${laneId}:${step}`;

  const handleCellChange = (laneId: string, step: number, val: string) => {
    setLocalCells((prev) => ({ ...prev, [cellKey(laneId, step)]: val }));
    setIsDirty(true);
  };

  const handleSave = () => {
    const payload: { laneId: string; stepNumber: number; salaryCents: number }[] = [];
    lanes.forEach((lane) => {
      for (let s = 1; s <= stepCount; s++) {
        const raw = localCells[cellKey(lane.id, s)] ?? "";
        const cents = displayToCents(raw);
        if (cents > 0) {
          payload.push({ laneId: lane.id, stepNumber: s, salaryCents: cents });
        }
      }
    });

    bulkUpsertMutation.mutate(
      { scheduleId, data: { cells: payload } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListImportGridCellsQueryKey(scheduleId) });
          toast({ title: "Grid saved." });
          setIsDirty(false);
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to save grid.", variant: "destructive" }),
      }
    );
  };

  const handleAddLane = () => {
    const nextOrder = lanes.length > 0 ? Math.max(...lanes.map((l) => l.displayOrder)) + 1 : 0;
    createLaneMutation.mutate(
      { scheduleId, data: { name: `Lane ${lanes.length + 1}`, displayOrder: nextOrder } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListImportGridLanesQueryKey(scheduleId) });
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to add lane.", variant: "destructive" }),
      }
    );
  };

  const handleRenameLane = (id: string, name: string) => {
    updateLaneMutation.mutate(
      { id, data: { name } },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({ queryKey: getListImportGridLanesQueryKey(scheduleId) }),
        onError: () =>
          toast({ title: "Error", description: "Failed to rename lane.", variant: "destructive" }),
      }
    );
  };

  const handleDeleteLane = () => {
    if (!deleteLane) return;
    deleteLaneMutation.mutate(
      { id: deleteLane.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListImportGridLanesQueryKey(scheduleId) });
          queryClient.invalidateQueries({ queryKey: getListImportGridCellsQueryKey(scheduleId) });
          setDeleteLane(null);
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to delete lane.", variant: "destructive" }),
      }
    );
  };

  const isLoading = lanesLoading || cellsLoading;
  const steps = Array.from({ length: stepCount }, (_, i) => i + 1);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-card border-border max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{scheduleName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-gray-500/30 text-gray-400"
              >
                Direct Import Grid
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Salary Matrix
              </span>
              <span className="text-xs text-muted-foreground">
                Click a lane name to rename · Enter salaries in dollars
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleAddLane}
                disabled={createLaneMutation.isPending}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Lane
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStepCount((n) => n + 5)}
              >
                <Plus className="h-3 w-3 mr-1" /> 5 Rows
              </Button>
              {isDirty && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSave}
                  disabled={bulkUpsertMutation.isPending}
                >
                  <Save className="h-3 w-3 mr-1" />
                  {bulkUpsertMutation.isPending ? "Saving…" : "Save Grid"}
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
                <p className="text-sm text-muted-foreground">No lanes defined yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "+ Add Lane" to add columns, then enter salary values.
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
                        className="text-center px-1 py-1.5 min-w-[110px] border-b border-border"
                      >
                        <LaneHeaderCell
                          lane={lane}
                          onRename={handleRenameLane}
                          onDelete={setDeleteLane}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {steps.map((step) => (
                    <tr key={step} className="hover:bg-muted/20 group">
                      <td className="sticky left-0 bg-card z-10 text-xs font-mono text-muted-foreground px-2 py-0.5 border-b border-border/50">
                        {step}
                      </td>
                      {lanes.map((lane) => {
                        const key = cellKey(lane.id, step);
                        const val = localCells[key] ?? "";
                        return (
                          <td key={lane.id} className="px-0.5 py-0.5 border-b border-border/50">
                            <Input
                              type="number"
                              min={0}
                              step={500}
                              value={val}
                              onChange={(e) =>
                                handleCellChange(lane.id, step, e.target.value)
                              }
                              placeholder="—"
                              className={cn(
                                "h-7 text-right font-mono text-xs px-1.5 border-0 bg-transparent",
                                "focus:bg-muted/40 focus:border focus:border-border",
                                val ? "text-foreground" : "text-muted-foreground/40"
                              )}
                            />
                          </td>
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
                {stepCount} steps
              </span>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {isDirty && (
                <Button
                  onClick={handleSave}
                  disabled={bulkUpsertMutation.isPending}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {bulkUpsertMutation.isPending ? "Saving…" : "Save Grid"}
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
              Delete lane "{deleteLane?.name}" and all its salary values? This
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
