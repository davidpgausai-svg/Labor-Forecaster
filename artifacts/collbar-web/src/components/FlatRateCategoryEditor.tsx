import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFlatRateCategories,
  getListFlatRateCategoriesQueryKey,
  useCreateFlatRateCategory,
  useUpdateFlatRateCategory,
  useDeleteFlatRateCategory,
  FlatRateCategory,
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
    maximumFractionDigits: 2,
  });
}

function parseDollarsToCents(value: string): number {
  const cleaned = value.replace(/[^0-9.]/g, "");
  return Math.round(parseFloat(cleaned || "0") * 100);
}

// ---------------------------------------------------------------------------
// CategoryFormDialog — Add / Edit a single flat rate category
// ---------------------------------------------------------------------------

interface CategoryFormState {
  positionTitle: string;
  annualAmountDollars: string;
  displayOrder: string;
}

function CategoryFormDialog({
  open,
  onClose,
  scheduleId,
  existing,
  nextDisplayOrder,
}: {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  existing: FlatRateCategory | null;
  nextDisplayOrder: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateFlatRateCategory();
  const updateMutation = useUpdateFlatRateCategory();

  const [form, setForm] = useState<CategoryFormState>(() =>
    existing
      ? {
          positionTitle: existing.positionTitle,
          annualAmountDollars: (existing.annualAmountCents / 100).toFixed(2),
          displayOrder: String(existing.displayOrder),
        }
      : { positionTitle: "", annualAmountDollars: "", displayOrder: String(nextDisplayOrder) }
  );

  // Reset when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm(
        existing
          ? {
              positionTitle: existing.positionTitle,
              annualAmountDollars: (existing.annualAmountCents / 100).toFixed(2),
              displayOrder: String(existing.displayOrder),
            }
          : { positionTitle: "", annualAmountDollars: "", displayOrder: String(nextDisplayOrder) }
      );
    }
    if (!v) onClose();
  };

  const handleSave = () => {
    if (!form.positionTitle.trim()) {
      toast({ title: "Position title is required.", variant: "destructive" });
      return;
    }

    const payload = {
      positionTitle: form.positionTitle.trim(),
      annualAmountCents: parseDollarsToCents(form.annualAmountDollars),
      displayOrder: parseInt(form.displayOrder) || 0,
    };

    if (existing) {
      updateMutation.mutate(
        { id: existing.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListFlatRateCategoriesQueryKey(scheduleId),
            });
            toast({ title: "Position updated." });
            onClose();
          },
          onError: () =>
            toast({ title: "Error", description: "Failed to update position.", variant: "destructive" }),
        }
      );
    } else {
      createMutation.mutate(
        { scheduleId, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListFlatRateCategoriesQueryKey(scheduleId),
            });
            toast({ title: "Position added." });
            onClose();
          },
          onError: () =>
            toast({ title: "Error", description: "Failed to add position.", variant: "destructive" }),
        }
      );
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Position" : "Add Position"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Position Title</Label>
            <Input
              value={form.positionTitle}
              onChange={(e) => setForm((p) => ({ ...p, positionTitle: e.target.value }))}
              placeholder="e.g. Substitute Teacher, Para-Professional"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Annual Amount ($)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.annualAmountDollars}
              onChange={(e) => setForm((p) => ({ ...p, annualAmountDollars: e.target.value }))}
              placeholder="0.00"
              className="font-mono text-right"
            />
          </div>

          <div className="space-y-1">
            <Label>Display Order</Label>
            <Input
              type="number"
              min={0}
              value={form.displayOrder}
              onChange={(e) => setForm((p) => ({ ...p, displayOrder: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isBusy || !form.positionTitle.trim()}>
            {existing ? "Save Changes" : "Add Position"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// FlatRateCategoryEditor — main panel opened from ScheduleRow
// ---------------------------------------------------------------------------

export function FlatRateCategoryEditor({
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
  const deleteMutation = useDeleteFlatRateCategory();

  const [addOpen, setAddOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<FlatRateCategory | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<FlatRateCategory | null>(null);

  const { data: categories = [], isLoading } = useListFlatRateCategories(scheduleId, {
    query: {
      enabled: open,
      queryKey: getListFlatRateCategoriesQueryKey(scheduleId),
    },
  });

  const handleDelete = () => {
    if (!deleteCategory) return;
    deleteMutation.mutate(
      { id: deleteCategory.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListFlatRateCategoriesQueryKey(scheduleId),
          });
          toast({ title: "Position deleted." });
          setDeleteCategory(null);
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to delete position.", variant: "destructive" }),
      }
    );
  };

  const nextDisplayOrder = categories.length > 0
    ? Math.max(...categories.map((c) => c.displayOrder)) + 1
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-card border-border max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{scheduleName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-gray-500/30 text-gray-400"
              >
                Flat Rate
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Positions
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Position
            </Button>
          </div>

          <div className="space-y-0.5 min-h-[80px]">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : categories.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No positions defined yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "+ Add Position" to define a flat rate amount.
                </p>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div className="grid grid-cols-[1fr_160px_64px] gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Position Title</span>
                  <span className="text-right">Annual Amount</span>
                  <span />
                </div>

                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={cn(
                      "grid grid-cols-[1fr_160px_64px] gap-2 items-center px-2 py-1.5 rounded",
                      "hover:bg-muted/30 group"
                    )}
                  >
                    <span className="text-sm truncate">{cat.positionTitle}</span>
                    <span className="text-sm font-mono text-right tabular-nums">
                      {formatDollars(cat.annualAmountCents)}
                    </span>
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setEditCategory(cat)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-400 hover:text-red-300"
                        onClick={() => setDeleteCategory(cat)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Totals footer */}
                <div className="grid grid-cols-[1fr_160px_64px] gap-2 px-2 pt-2 mt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {categories.length} position{categories.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-xs font-mono text-right tabular-nums text-muted-foreground">
                    avg {formatDollars(
                      Math.round(
                        categories.reduce((s, c) => s + c.annualAmountCents, 0) / categories.length
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

      <CategoryFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        scheduleId={scheduleId}
        existing={null}
        nextDisplayOrder={nextDisplayOrder}
      />

      {editCategory && (
        <CategoryFormDialog
          open={!!editCategory}
          onClose={() => setEditCategory(null)}
          scheduleId={scheduleId}
          existing={editCategory}
          nextDisplayOrder={nextDisplayOrder}
        />
      )}

      <AlertDialog
        open={!!deleteCategory}
        onOpenChange={(v) => !v && setDeleteCategory(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteCategory?.positionTitle}"? This cannot be undone.
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
