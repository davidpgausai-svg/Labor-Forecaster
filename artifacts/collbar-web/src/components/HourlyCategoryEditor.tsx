import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListHourlyCategories,
  getListHourlyCategoriesQueryKey,
  useCreateHourlyCategory,
  useUpdateHourlyCategory,
  useDeleteHourlyCategory,
  CompensationHourlyCategory,
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

function formatRate(rate: string): string {
  return parseFloat(rate).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatHours(hours: string): string {
  return `${parseFloat(hours).toLocaleString("en-US", { maximumFractionDigits: 2 })} hrs`;
}

function annualCost(rate: string, hours: string): string {
  const cost = parseFloat(rate) * parseFloat(hours);
  return cost.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ---------------------------------------------------------------------------
// CategoryFormDialog — Add / Edit a single hourly category
// ---------------------------------------------------------------------------

interface CategoryFormState {
  name: string;
  baseHourlyRate: string;
  annualHours: string;
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
  existing: CompensationHourlyCategory | null;
  nextDisplayOrder: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateHourlyCategory();
  const updateMutation = useUpdateHourlyCategory();

  const [form, setForm] = useState<CategoryFormState>(() =>
    existing
      ? {
          name: existing.name,
          baseHourlyRate: parseFloat(existing.baseHourlyRate).toFixed(4),
          annualHours: parseFloat(existing.annualHours).toFixed(2),
          displayOrder: String(existing.displayOrder),
        }
      : {
          name: "",
          baseHourlyRate: "",
          annualHours: "2080.00",
          displayOrder: String(nextDisplayOrder),
        }
  );

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setForm(
        existing
          ? {
              name: existing.name,
              baseHourlyRate: parseFloat(existing.baseHourlyRate).toFixed(4),
              annualHours: parseFloat(existing.annualHours).toFixed(2),
              displayOrder: String(existing.displayOrder),
            }
          : {
              name: "",
              baseHourlyRate: "",
              annualHours: "2080.00",
              displayOrder: String(nextDisplayOrder),
            }
      );
    }
    if (!v) onClose();
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required.", variant: "destructive" });
      return;
    }
    if (!form.baseHourlyRate || isNaN(parseFloat(form.baseHourlyRate))) {
      toast({ title: "Valid hourly rate is required.", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name.trim(),
      baseHourlyRate: parseFloat(form.baseHourlyRate).toFixed(4),
      annualHours: (parseFloat(form.annualHours) || 2080).toFixed(2),
      displayOrder: parseInt(form.displayOrder) || 0,
    };

    if (existing) {
      updateMutation.mutate(
        { id: existing.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: getListHourlyCategoriesQueryKey(scheduleId),
            });
            toast({ title: "Category updated." });
            onClose();
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to update category.",
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
              queryKey: getListHourlyCategoriesQueryKey(scheduleId),
            });
            toast({ title: "Category added." });
            onClose();
          },
          onError: () =>
            toast({
              title: "Error",
              description: "Failed to add category.",
              variant: "destructive",
            }),
        }
      );
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Category Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Custodian, Para-Professional"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Base Hourly Rate ($)</Label>
            <Input
              type="number"
              min={0}
              step={0.0001}
              value={form.baseHourlyRate}
              onChange={(e) =>
                setForm((p) => ({ ...p, baseHourlyRate: e.target.value }))
              }
              placeholder="0.0000"
              className="font-mono text-right"
            />
          </div>

          <div className="space-y-1">
            <Label>Annual Hours</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={form.annualHours}
              onChange={(e) =>
                setForm((p) => ({ ...p, annualHours: e.target.value }))
              }
              placeholder="2080.00"
              className="font-mono text-right"
            />
          </div>

          <div className="space-y-1">
            <Label>Display Order</Label>
            <Input
              type="number"
              min={0}
              value={form.displayOrder}
              onChange={(e) =>
                setForm((p) => ({ ...p, displayOrder: e.target.value }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isBusy || !form.name.trim() || !form.baseHourlyRate}
          >
            {existing ? "Save Changes" : "Add Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// HourlyCategoryEditor — main panel opened from ScheduleRow
// ---------------------------------------------------------------------------

export function HourlyCategoryEditor({
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
  const deleteMutation = useDeleteHourlyCategory();

  const [addOpen, setAddOpen] = useState(false);
  const [editCategory, setEditCategory] =
    useState<CompensationHourlyCategory | null>(null);
  const [deleteCategory, setDeleteCategory] =
    useState<CompensationHourlyCategory | null>(null);

  const { data: categories = [], isLoading } = useListHourlyCategories(
    scheduleId,
    {
      query: {
        enabled: open,
        queryKey: getListHourlyCategoriesQueryKey(scheduleId),
      },
    }
  );

  const handleDelete = () => {
    if (!deleteCategory) return;
    deleteMutation.mutate(
      { id: deleteCategory.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListHourlyCategoriesQueryKey(scheduleId),
          });
          toast({ title: "Category deleted." });
          setDeleteCategory(null);
        },
        onError: () =>
          toast({
            title: "Error",
            description: "Failed to delete category.",
            variant: "destructive",
          }),
      }
    );
  };

  const nextDisplayOrder =
    categories.length > 0
      ? Math.max(...categories.map((c) => c.displayOrder)) + 1
      : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{scheduleName}</span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-gray-500/30 text-gray-400"
              >
                Hourly Rate
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Categories
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" /> Add Category
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
                <p className="text-sm text-muted-foreground">
                  No categories defined yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click "+ Add Category" to define an hourly rate category.
                </p>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div className="grid grid-cols-[1fr_120px_100px_110px_64px] gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Category</span>
                  <span className="text-right">Hourly Rate</span>
                  <span className="text-right">Annual Hrs</span>
                  <span className="text-right">Annual Cost</span>
                  <span />
                </div>

                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className={cn(
                      "grid grid-cols-[1fr_120px_100px_110px_64px] gap-2 items-center px-2 py-1.5 rounded",
                      "hover:bg-muted/30 group"
                    )}
                  >
                    <span className="text-sm truncate">{cat.name}</span>
                    <span className="text-sm font-mono text-right tabular-nums">
                      {formatRate(cat.baseHourlyRate)}
                    </span>
                    <span className="text-sm font-mono text-right tabular-nums text-muted-foreground">
                      {formatHours(cat.annualHours)}
                    </span>
                    <span className="text-sm font-mono text-right tabular-nums">
                      {annualCost(cat.baseHourlyRate, cat.annualHours)}
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
                <div className="grid grid-cols-[1fr_120px_100px_110px_64px] gap-2 px-2 pt-2 mt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {categories.length} categor
                    {categories.length !== 1 ? "ies" : "y"}
                  </span>
                  <span />
                  <span />
                  <span className="text-xs font-mono text-right tabular-nums text-muted-foreground">
                    {categories
                      .reduce(
                        (s, c) =>
                          s + parseFloat(c.baseHourlyRate) * parseFloat(c.annualHours),
                        0
                      )
                      .toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{" "}
                    total
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
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteCategory?.name}"? This cannot be undone.
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
