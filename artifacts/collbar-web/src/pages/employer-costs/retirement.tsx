import { useState } from "react";
import {
  useListRetirementPlans,
  useCreateRetirementPlan,
  useUpdateRetirementPlan,
  useDeleteRetirementPlan,
  useListEmployeeGroups,
  useListGroupRetirementAssignments,
  useSetGroupRetirementAssignments,
  getListRetirementPlansQueryKey,
  getListGroupRetirementAssignmentsQueryKey,
  getListEmployeeGroupsQueryKey,
  type RetirementPlan,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react";
import { formatPercent } from "@/lib/format";

const BLANK_FORM = {
  planName: "",
  planType: "defined_benefit" as "defined_benefit" | "defined_contribution",
  employerRate: "0",
  employerMatchCapPercent: "",
  grossUpRate: "0",
  employeeRate: "0",
  isFicaExempt: false,
  displayOrder: 0,
  isActive: true,
  notes: "",
};

export default function RetirementPage() {
  const { districtId } = useDistrictContext();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading } = useListRetirementPlans(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListRetirementPlansQueryKey({ districtId: districtId! }) } }
  );

  const { data: groups = [] } = useListEmployeeGroups(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }) } }
  );

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<RetirementPlan | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [deleteTarget, setDeleteTarget] = useState<RetirementPlan | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const { data: groupAssignments = [] } = useListGroupRetirementAssignments(
    { employeeGroupId: selectedGroupId },
    { query: { enabled: !!selectedGroupId, queryKey: getListGroupRetirementAssignmentsQueryKey({ employeeGroupId: selectedGroupId }) } }
  );
  const [assignedPlanIds, setAssignedPlanIds] = useState<Set<string>>(new Set());

  function invalidatePlans() {
    queryClient.invalidateQueries({ queryKey: getListRetirementPlansQueryKey({ districtId: districtId! }) });
  }

  const createMutation = useCreateRetirementPlan({ mutation: { onSuccess: () => { invalidatePlans(); setShowDialog(false); } } });
  const updateMutation = useUpdateRetirementPlan({ mutation: { onSuccess: () => { invalidatePlans(); setShowDialog(false); setEditing(null); } } });
  const deleteMutation = useDeleteRetirementPlan({ mutation: { onSuccess: () => { invalidatePlans(); setDeleteTarget(null); } } });
  const assignMutation = useSetGroupRetirementAssignments({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupRetirementAssignmentsQueryKey({ employeeGroupId: selectedGroupId }) });
      },
    },
  });

  // Sync assignments when group changes
  const assignedIds = new Set(groupAssignments.map((a) => a.retirementPlanId));

  function openAdd() {
    setEditing(null);
    setForm({ ...BLANK_FORM, displayOrder: plans.length });
    setShowDialog(true);
  }

  function openEdit(plan: RetirementPlan) {
    setEditing(plan);
    setForm({
      planName: plan.planName,
      planType: plan.planType as "defined_benefit" | "defined_contribution",
      employerRate: plan.employerRate,
      employerMatchCapPercent: plan.employerMatchCapPercent ?? "",
      grossUpRate: plan.grossUpRate,
      employeeRate: plan.employeeRate,
      isFicaExempt: plan.isFicaExempt,
      displayOrder: plan.displayOrder,
      isActive: plan.isActive,
      notes: plan.notes ?? "",
    });
    setShowDialog(true);
  }

  function handleSave() {
    if (!districtId) return;
    const body = {
      ...form,
      employerMatchCapPercent: form.employerMatchCapPercent || null,
      notes: form.notes || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: { districtId, ...body } });
    } else {
      createMutation.mutate({ data: { districtId, ...body } });
    }
  }

  function handleSaveAssignments() {
    if (!selectedGroupId) return;
    assignMutation.mutate({
      data: { employeeGroupId: selectedGroupId, retirementPlanIds: [...assignedIds] },
    });
  }

  function toggleAssignment(planId: string) {
    const next = new Set(assignedIds);
    if (next.has(planId)) next.delete(planId); else next.add(planId);
    // Update local state via a derived set — handled directly via groupAssignments refetch on save
    setAssignedPlanIds(next);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Retirement Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure defined-benefit and defined-contribution retirement plans, then assign them to employee groups.
          </p>
        </div>
        <Button onClick={openAdd} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Plan
        </Button>
      </div>

      {/* Plans Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No retirement plans configured yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Plan Name</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-right px-4 py-3 font-medium font-mono">Employer Rate</th>
                  <th className="text-right px-4 py-3 font-medium font-mono">Gross-Up Rate</th>
                  <th className="text-center px-4 py-3 font-medium">FICA Exempt</th>
                  <th className="text-center px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{plan.planName}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {plan.planType === "defined_benefit" ? "Defined Benefit" : "Defined Contribution"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPercent(String(parseFloat(plan.employerRate ?? "0") * 100))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatPercent(String(parseFloat(plan.grossUpRate ?? "0") * 100))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {plan.isFicaExempt ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Exempt</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={plan.isActive ? "text-green-400 text-xs" : "text-muted-foreground text-xs"}>
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(plan)} className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Group Assignments */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Employee Group Assignments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Employee Group</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a group..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedGroupId && (
            <>
              <div className="space-y-2">
                {plans.filter((p) => p.isActive).map((plan) => {
                  const isChecked = (assignedPlanIds.size > 0 ? assignedPlanIds : assignedIds).has(plan.id);
                  return (
                    <label key={plan.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAssignment(plan.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{plan.planName}</span>
                      <span className="text-xs text-muted-foreground">
                        {plan.planType === "defined_benefit" ? "Defined Benefit" : "Defined Contribution"}
                        {" · "}Gross-Up: {formatPercent(String(parseFloat(plan.grossUpRate ?? "0") * 100))}
                      </span>
                    </label>
                  );
                })}
              </div>
              <Button onClick={handleSaveAssignments} disabled={assignMutation.isPending} size="sm">
                {assignMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Save Assignments
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Retirement Plan" : "Add Retirement Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan Name</Label>
              <Input value={form.planName} onChange={(e) => setForm((f) => ({ ...f, planName: e.target.value }))} placeholder="e.g. TRS, IMRF, 403(b) Match" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Plan Type</Label>
                <Select value={form.planType} onValueChange={(v) => setForm((f) => ({ ...f, planType: v as typeof form.planType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defined_benefit">Defined Benefit</SelectItem>
                    <SelectItem value="defined_contribution">Defined Contribution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Employer Rate (decimal)</Label>
                <Input value={form.employerRate} onChange={(e) => setForm((f) => ({ ...f, employerRate: e.target.value }))} className="font-mono" placeholder="e.g. 0.008901" />
              </div>
            </div>
            {form.planType === "defined_contribution" && (
              <div className="space-y-1.5">
                <Label>Match Cap % (decimal)</Label>
                <Input value={form.employerMatchCapPercent} onChange={(e) => setForm((f) => ({ ...f, employerMatchCapPercent: e.target.value }))} className="font-mono" placeholder="e.g. 0.06" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Gross-Up Rate (decimal)</Label>
                <Input value={form.grossUpRate} onChange={(e) => setForm((f) => ({ ...f, grossUpRate: e.target.value }))} className="font-mono" placeholder="e.g. 0.008901" />
                <p className="text-xs text-muted-foreground">Employer picks up employee share</p>
              </div>
              <div className="space-y-1.5">
                <Label>Employee Rate (reference only)</Label>
                <Input value={form.employeeRate} onChange={(e) => setForm((f) => ({ ...f, employeeRate: e.target.value }))} className="font-mono" placeholder="e.g. 0.09" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isFicaExempt} onCheckedChange={(v) => setForm((f) => ({ ...f, isFicaExempt: v }))} />
              <Label>FICA Exempt (Medicare only — e.g. TRS)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending || !form.planName}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.planName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the retirement plan and all group assignments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
