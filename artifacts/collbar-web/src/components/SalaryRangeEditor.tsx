import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSalaryRanges,
  getListSalaryRangesQueryKey,
  useCreateSalaryRange,
  useUpdateSalaryRange,
  useDeleteSalaryRange,
  SalaryRangeRow,
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function parseDollarsToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  return Math.round(parseFloat(cleaned || "0") * 100);
}

// ---------------------------------------------------------------------------
// RangeFormDialog — Add / Edit a single salary range row
// ---------------------------------------------------------------------------

interface RangeFormState {
  positionTitle: string;
  minDollars: string;
  midDollars: string;
  maxDollars: string;
  displayOrder: string;
}

function RangeFormDialog({
  open,
  onClose,
  scheduleId,
  existing,
  nextDisplayOrder,
}: {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  existing: SalaryRangeRow | null;
  nextDisplayOrder: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSalaryRange();
  const updateMutation = useUpdateSalaryRange();

  function formFromExisting(row: SalaryRangeRow): RangeFormState {
    return {
      positionTitle: row.positionTitle,
      minDollars: (row.minSalaryCents / 100).toFixed(0),
      midDollars: (row.midSalaryCents / 100).toFixed(0),
      maxDollars: (row.maxSalaryCents / 100).toFixed(0),
      displayOrder: String(row.displayOrder),
    };
  }

  const [form, setForm] = useState<RangeFormState>(() =>
    existing
      ? formFromExisting(existing)
      : { positionTitle: "", minDollars: "", midDollars: "", maxDollars: "", displayOrder: String(nextDisplayOrder) }
  );

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm(
        existing
          ? formFromExisting(existing)
          : { positionTitle: "", minDollars: "", midDollars: "", maxDollars: "", displayOrder: String(nextDisplayOrder) }
      );
    }
    if (!v) onClose();
  };

  const set = (field: keyof RangeFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSave = () => {
    if (!form.positionTitle.trim()) {
      toast({ title: "Position title is required.", variant: "destructive" });
      return;
    }

    const payload = {
      positionTitle: form.positionTitle.trim(),
      minSalaryCents: parseDollarsToCents(form.minDollars),
      midSalaryCents: parseDollarsToCents(form.midDollars),
      maxSalaryCents: parseDollarsToCents(form.maxDollars),
      displayOrder: parseInt(form.displayOrder) || 0,
    };

    if (existing) {
      updateMutation.mutate(
        { id: existing.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSalaryRangesQueryKey(scheduleId) });
            toast({ title: "Range updated." });
            onClose();
          },
          onError: () =>
            toast({ title: "Error", description: "Failed to update range.", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { scheduleId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSalaryRangesQueryKey(scheduleId) });
            toast({ title: "Range added." });
            onClose();
          },
          onError: () =>
            toast({ title: "Error", description: "Failed to add range.", variant: "destructive" }),
        }
      );
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const isValid =
    form.positionTitle.trim() &&
    form.minDollars &&
    form.midDollars &&
    form.maxDollars;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Range" : "Add Range"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Position Title</Label>
            <Input
              value={form.positionTitle}
              onChange={set("positionTitle")}
              placeholder="e.g. Director of Curriculum"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-green-400">Min ($)</Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={form.minDollars}
                onChange={set("minDollars")}
                placeholder="0"
                className="font-mono text-right"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-yellow-400">Mid ($)</Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={form.midDollars}
                onChange={set("midDollars")}
                placeholder="0"
                className="font-mono text-right"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-red-400">Max ($)</Label>
              <Input
                type="number"
                min={0}
                step={1000}
                value={form.maxDollars}
                onChange={set("maxDollars")}
                placeholder="0"
                className="font-mono text-right"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Display Order</Label>
            <Input
              type="number"
              min={0}
              value={form.displayOrder}
              onChange={set("displayOrder")}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isBusy || !isValid}>
            {existing ? "Save Changes" : "Add Range"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SalaryRangeEditor — main panel opened from ScheduleRow
// ---------------------------------------------------------------------------

export function SalaryRangeEditor({
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
  const deleteMutation = useDeleteSalaryRange();

  const [addOpen, setAddOpen] = useState(false);
  const [editRange, setEditRange] = useState<SalaryRangeRow | null>(null);
  const [deleteRange, setDeleteRange] = useState<SalaryRangeRow | null>(null);

  const { data: ranges = [], isLoading } = useListSalaryRanges(scheduleId, {
    query: {
      enabled: open,
      queryKey: getListSalaryRangesQueryKey(scheduleId),
    },
  });

  const handleDelete = () => {
    if (!deleteRange) return;
    deleteMutation.mutate(
      { id: deleteRange.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSalaryRangesQueryKey(scheduleId) });
          toast({ title: "Range deleted." });
          setDeleteRange(null);
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to delete range.", variant: "destructive" }),
      }
    );
  };

  const nextDisplayOrder =
    ranges.length > 0 ? Math.max(...ranges.map((r) => r.displayOrder)) + 1 : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-card border-border max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{scheduleName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-gray-500/30 text-gray-400"
              >
                Range-Based
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Position Ranges
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Range
            </Button>
          </div>

          <div className="space-y-0.5 min-h-[80px]">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : ranges.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No ranges defined yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "+ Add Range" to define a min/mid/max salary band.
                </p>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div className="grid grid-cols-[1fr_120px_120px_120px_80px_64px] gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Position</span>
                  <span className="text-right text-green-400">Min</span>
                  <span className="text-right text-yellow-400">Mid</span>
                  <span className="text-right text-red-400">Max</span>
                  <span className="text-right">Spread</span>
                  <span />
                </div>

                {ranges.map((r) => {
                  const spread = r.maxSalaryCents - r.minSalaryCents;
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "grid grid-cols-[1fr_120px_120px_120px_80px_64px] gap-2 items-center px-2 py-1.5 rounded",
                        "hover:bg-muted/30 group"
                      )}
                    >
                      <span className="text-sm truncate">{r.positionTitle}</span>
                      <span className="text-sm font-mono text-right tabular-nums text-green-400">
                        {formatDollars(r.minSalaryCents)}
                      </span>
                      <span className="text-sm font-mono text-right tabular-nums text-yellow-400">
                        {formatDollars(r.midSalaryCents)}
                      </span>
                      <span className="text-sm font-mono text-right tabular-nums text-red-400">
                        {formatDollars(r.maxSalaryCents)}
                      </span>
                      <span className="text-xs font-mono text-right tabular-nums text-muted-foreground">
                        {formatDollars(spread)}
                      </span>
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditRange(r)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-400 hover:text-red-300"
                          onClick={() => setDeleteRange(r)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Footer */}
                <div className="grid grid-cols-[1fr_120px_120px_120px_80px_64px] gap-2 px-2 pt-2 mt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {ranges.length} position{ranges.length !== 1 ? "s" : ""}
                  </span>
                  <span />
                  <span />
                  <span />
                  <span className="text-xs font-mono text-right tabular-nums text-muted-foreground">
                    avg{" "}
                    {formatDollars(
                      Math.round(
                        ranges.reduce((s, r) => s + (r.maxSalaryCents - r.minSalaryCents), 0) /
                          ranges.length
                      )
                    )}
                  </span>
                  <span />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RangeFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scheduleId={scheduleId}
        existing={null}
        nextDisplayOrder={nextDisplayOrder}
      />

      {editRange && (
        <RangeFormDialog
          open={!!editRange}
          onClose={() => setEditRange(null)}
          scheduleId={scheduleId}
          existing={editRange}
          nextDisplayOrder={nextDisplayOrder}
        />
      )}

      <AlertDialog
        open={!!deleteRange}
        onOpenChange={(v) => !v && setDeleteRange(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Range</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteRange?.positionTitle}"? This cannot be undone.
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
