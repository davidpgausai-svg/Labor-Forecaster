import { useState, useEffect } from "react";
import {
  useListBenefitPlans,
  useCreateBenefitPlan,
  useUpdateBenefitPlan,
  useDeleteBenefitPlan,
  useUpsertBenefitPlanTiers,
  useUpsertBenefitPlanRate,
  useListBenefitEligibilityRules,
  useUpsertBenefitEligibilityRules,
  useListHsaHraContributions,
  useUpsertHsaHraContributions,
  useListEmployerFlatCosts,
  useCreateEmployerFlatCost,
  useUpdateEmployerFlatCost,
  useDeleteEmployerFlatCost,
  useListGroupBenefitAssignments,
  useSetGroupBenefitAssignments,
  useListEmployeeGroups,
  getListBenefitPlansQueryKey,
  getListBenefitEligibilityRulesQueryKey,
  getListHsaHraContributionsQueryKey,
  getListEmployerFlatCostsQueryKey,
  getListGroupBenefitAssignmentsQueryKey,
  getListEmployeeGroupsQueryKey,
  type BenefitPlanWithDetails,
  type EmployerFlatCost,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Pencil, Trash2, Plus, Loader2, Save } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const FLAT_CATEGORIES = ["health", "dental", "vision"] as const;
const RATE_CATEGORIES = ["life", "add", "ltd", "std", "other"] as const;
const TIERS = ["ee_only", "ee_spouse", "ee_child", "family"] as const;
const TIER_LABELS: Record<string, string> = {
  ee_only: "EE Only",
  ee_spouse: "EE + Spouse",
  ee_child: "EE + Child",
  family: "Family",
};

const ELIGIBILITY_CATEGORIES = [
  "health", "dental", "vision", "life", "add", "ltd", "std",
  "retirement", "fica", "futa", "suta", "workers_comp",
];

const DEFAULT_CALC_METHOD: Record<string, string> = {
  health: "flat_dollar", dental: "flat_dollar", vision: "flat_dollar",
  life: "rate_per_1000", add: "rate_per_1000",
  ltd: "rate_per_100", std: "rate_per_100", other: "flat_dollar",
};

const BLANK_PLAN_FORM = {
  category: "health",
  planName: "",
  calculationMethod: "flat_dollar",
  displayOrder: 0,
  isActive: true,
  notes: "",
  tiers: { ee_only: "0", ee_spouse: "0", ee_child: "0", family: "0" } as { ee_only: string; ee_spouse: string; ee_child: string; family: string },
  rate: "",
  coveredEarningsCap: "",
  benefitMultiplier: "",
  flatBenefitAmount: "",
};

type PlanForm = typeof BLANK_PLAN_FORM;

const BLANK_FLAT_COST = { costName: "", annualCostPerEmployee: "0", isActive: true, notes: "" };

export default function BenefitsPage() {
  const { districtId } = useDistrictContext();
  const queryClient = useQueryClient();

  const { data: allPlans = [], isLoading } = useListBenefitPlans(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListBenefitPlansQueryKey({ districtId: districtId! }) } }
  );
  const { data: eligibilityRules = [] } = useListBenefitEligibilityRules(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListBenefitEligibilityRulesQueryKey({ districtId: districtId! }) } }
  );
  const { data: hsaHraContribs = [] } = useListHsaHraContributions(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListHsaHraContributionsQueryKey({ districtId: districtId! }) } }
  );
  const { data: flatCosts = [] } = useListEmployerFlatCosts(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListEmployerFlatCostsQueryKey({ districtId: districtId! }) } }
  );
  const { data: groups = [] } = useListEmployeeGroups(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }) } }
  );

  const flatPlans = allPlans.filter((p) => (FLAT_CATEGORIES as readonly string[]).includes(p.category));
  const ratePlans = allPlans.filter((p) => (RATE_CATEGORIES as readonly string[]).includes(p.category));

  // ── Plan dialog state ────────────────────────────────────────────────────
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BenefitPlanWithDetails | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(BLANK_PLAN_FORM);
  const [planCategory, setPlanCategory] = useState<"flat" | "rate">("flat");
  const [deleteTarget, setDeleteTarget] = useState<BenefitPlanWithDetails | null>(null);

  // ── Eligibility rules state ──────────────────────────────────────────────
  const [eligibilityForm, setEligibilityForm] = useState<
    Record<string, { minFteThreshold: string; includePartTime: boolean; includeSeasonal: boolean }>
  >({});

  const eligibilityRulesKey = eligibilityRules
    .map((r) => `${r.category}:${r.minFteThreshold}:${r.includePartTime}:${r.includeSeasonal}`)
    .join("|");
  useEffect(() => {
    const m: typeof eligibilityForm = {};
    for (const cat of ELIGIBILITY_CATEGORIES) {
      const existing = eligibilityRules.find((r) => r.category === cat);
      m[cat] = {
        minFteThreshold: existing?.minFteThreshold ?? "1.0000",
        includePartTime: existing?.includePartTime ?? false,
        includeSeasonal: existing?.includeSeasonal ?? false,
      };
    }
    setEligibilityForm(m);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibilityRulesKey]);

  // ── HSA/HRA state ────────────────────────────────────────────────────────
  const [hsaHraTab, setHsaHraTab] = useState<"hsa" | "hra">("hsa");
  const [hsaForm, setHsaForm] = useState<Record<string, string>>({});
  const [hraForm, setHraForm] = useState<Record<string, string>>({});

  const hsaHraKey = hsaHraContribs
    .map((c) => `${c.accountType}:${c.tier}:${c.employerContributionAnnual}`)
    .join("|");
  useEffect(() => {
    const hsa: Record<string, string> = {};
    const hra: Record<string, string> = {};
    for (const tier of TIERS) {
      const hsaRow = hsaHraContribs.find((c) => c.accountType === "hsa" && c.tier === tier);
      const hraRow = hsaHraContribs.find((c) => c.accountType === "hra" && c.tier === tier);
      hsa[tier] = hsaRow?.employerContributionAnnual ?? "0";
      hra[tier] = hraRow?.employerContributionAnnual ?? "0";
    }
    setHsaForm(hsa);
    setHraForm(hra);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsaHraKey]);

  // ── Flat cost state ──────────────────────────────────────────────────────
  const [showFlatCostDialog, setShowFlatCostDialog] = useState(false);
  const [editingFlatCost, setEditingFlatCost] = useState<EmployerFlatCost | null>(null);
  const [flatCostForm, setFlatCostForm] = useState(BLANK_FLAT_COST);
  const [deleteFlatTarget, setDeleteFlatTarget] = useState<EmployerFlatCost | null>(null);

  // ── Group assignments state ──────────────────────────────────────────────
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const { data: groupAssignments = [] } = useListGroupBenefitAssignments(
    { employeeGroupId: selectedGroupId },
    { query: { enabled: !!selectedGroupId, queryKey: getListGroupBenefitAssignmentsQueryKey({ employeeGroupId: selectedGroupId }) } }
  );
  const [localAssigned, setLocalAssigned] = useState<Set<string>>(new Set());
  const assignedIdsKey = groupAssignments.map((a) => a.benefitPlanTypeId).join(",");
  useEffect(() => {
    setLocalAssigned(new Set(groupAssignments.map((a) => a.benefitPlanTypeId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedIdsKey, selectedGroupId]);

  // ── Mutations ────────────────────────────────────────────────────────────
  function invalidatePlans() {
    queryClient.invalidateQueries({ queryKey: getListBenefitPlansQueryKey({ districtId: districtId! }) });
  }

  const createPlan = useCreateBenefitPlan({ mutation: { onSuccess: () => { invalidatePlans(); setShowPlanDialog(false); } } });
  const updatePlan = useUpdateBenefitPlan({ mutation: { onSuccess: () => { invalidatePlans(); setShowPlanDialog(false); setEditingPlan(null); } } });
  const deletePlan = useDeleteBenefitPlan({ mutation: { onSuccess: () => { invalidatePlans(); setDeleteTarget(null); } } });
  const upsertTiers = useUpsertBenefitPlanTiers();
  const upsertRate = useUpsertBenefitPlanRate();
  const upsertEligibility = useUpsertBenefitEligibilityRules({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBenefitEligibilityRulesQueryKey({ districtId: districtId! }) }) },
  });
  const upsertHsaHra = useUpsertHsaHraContributions({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListHsaHraContributionsQueryKey({ districtId: districtId! }) }) },
  });
  const createFlatCost = useCreateEmployerFlatCost({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEmployerFlatCostsQueryKey({ districtId: districtId! }) }); setShowFlatCostDialog(false); } } });
  const updateFlatCost = useUpdateEmployerFlatCost({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEmployerFlatCostsQueryKey({ districtId: districtId! }) }); setShowFlatCostDialog(false); setEditingFlatCost(null); } } });
  const deleteFlatCost = useDeleteEmployerFlatCost({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEmployerFlatCostsQueryKey({ districtId: districtId! }) }); setDeleteFlatTarget(null); } } });
  const setGroupAssignments = useSetGroupBenefitAssignments({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGroupBenefitAssignmentsQueryKey({ employeeGroupId: selectedGroupId }) }) },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  function openAddPlan(cat: "flat" | "rate") {
    setPlanCategory(cat);
    setEditingPlan(null);
    const defaultCat = cat === "flat" ? "health" : "life";
    setPlanForm({ ...BLANK_PLAN_FORM, category: defaultCat, calculationMethod: DEFAULT_CALC_METHOD[defaultCat], displayOrder: allPlans.length });
    setShowPlanDialog(true);
  }

  function openEditPlan(plan: BenefitPlanWithDetails) {
    setPlanCategory((FLAT_CATEGORIES as readonly string[]).includes(plan.category) ? "flat" : "rate");
    setEditingPlan(plan);
    const tiers = { ee_only: "0", ee_spouse: "0", ee_child: "0", family: "0" };
    for (const t of plan.tiers ?? []) {
      if (t.tier in tiers) (tiers as Record<string, string>)[t.tier] = t.employerContributionAnnual;
    }
    setPlanForm({
      category: plan.category,
      planName: plan.planName,
      calculationMethod: plan.calculationMethod,
      displayOrder: plan.displayOrder,
      isActive: plan.isActive,
      notes: plan.notes ?? "",
      tiers,
      rate: plan.rate?.rate ?? "",
      coveredEarningsCap: plan.rate?.coveredEarningsCap ?? "",
      benefitMultiplier: plan.rate?.benefitMultiplier ?? "",
      flatBenefitAmount: plan.rate?.flatBenefitAmount ?? "",
    });
    setShowPlanDialog(true);
  }

  async function handleSavePlan() {
    if (!districtId || !planForm.planName) return;
    const body = {
      category: planForm.category,
      planName: planForm.planName,
      calculationMethod: planForm.calculationMethod as "flat_dollar" | "rate_per_100" | "rate_per_1000" | "percent_of_salary",
      displayOrder: planForm.displayOrder,
      isActive: planForm.isActive,
      notes: planForm.notes || null,
    };

    let planId: string;

    if (editingPlan) {
      const updated = await updatePlan.mutateAsync({ id: editingPlan.id, data: { ...body, districtId } });
      planId = updated.id;
    } else {
      const created = await createPlan.mutateAsync({ data: { districtId, ...body } });
      planId = created.id;
    }

    if (planCategory === "flat") {
      await upsertTiers.mutateAsync({
        id: planId,
        data: TIERS.map((t) => ({ tier: t, employerContributionAnnual: planForm.tiers[t] ?? "0" })),
      });
    } else if (planForm.rate) {
      await upsertRate.mutateAsync({
        id: planId,
        data: {
          rate: planForm.rate,
          coveredEarningsCap: planForm.coveredEarningsCap || null,
          benefitMultiplier: planForm.benefitMultiplier || null,
          flatBenefitAmount: planForm.flatBenefitAmount || null,
          notes: null,
        },
      });
    }

    invalidatePlans();
    setShowPlanDialog(false);
    setEditingPlan(null);
  }

  function handleSaveEligibility() {
    if (!districtId) return;
    upsertEligibility.mutate({
      data: {
        districtId,
        rules: ELIGIBILITY_CATEGORIES.map((cat) => ({
          category: cat,
          minFteThreshold: eligibilityForm[cat]?.minFteThreshold ?? "1.0000",
          includePartTime: eligibilityForm[cat]?.includePartTime ?? false,
          includeSeasonal: eligibilityForm[cat]?.includeSeasonal ?? false,
        })),
      },
    });
  }

  function handleSaveHsaHra() {
    if (!districtId) return;
    const contribs = [
      ...TIERS.map((t) => ({ accountType: "hsa" as const, tier: t, employerContributionAnnual: hsaForm[t] ?? "0" })),
      ...TIERS.map((t) => ({ accountType: "hra" as const, tier: t, employerContributionAnnual: hraForm[t] ?? "0" })),
    ];
    upsertHsaHra.mutate({ data: { districtId, contributions: contribs } });
  }

  function handleSaveGroupAssignments() {
    if (!selectedGroupId) return;
    setGroupAssignments.mutate({ data: { employeeGroupId: selectedGroupId, benefitPlanTypeIds: [...localAssigned] } });
  }

  const isPlanPending = createPlan.isPending || updatePlan.isPending || upsertTiers.isPending || upsertRate.isPending;

  if (isLoading) return <div className="text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Benefits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure employer-paid benefit plans, HSA/HRA contributions, eligibility rules, and group assignments.
        </p>
      </div>

      {/* Health, Dental & Vision */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Health, Dental &amp; Vision Plans</CardTitle>
          <Button size="sm" onClick={() => openAddPlan("flat")} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Plan
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {flatPlans.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No plans configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Plan Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Category</th>
                  <th className="text-right px-4 py-2.5 font-medium font-mono">EE Only</th>
                  <th className="text-right px-4 py-2.5 font-medium font-mono">EE+Spouse</th>
                  <th className="text-right px-4 py-2.5 font-medium font-mono">EE+Child</th>
                  <th className="text-right px-4 py-2.5 font-medium font-mono">Family</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {flatPlans.map((plan) => {
                  const tierMap: Record<string, string> = {};
                  for (const t of plan.tiers ?? []) tierMap[t.tier] = t.employerContributionAnnual;
                  return (
                    <tr key={plan.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{plan.planName}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs capitalize">{plan.category}</Badge>
                      </td>
                      {TIERS.map((t) => (
                        <td key={t} className="px-4 py-2.5 text-right font-mono text-sm">
                          {formatCurrency(tierMap[t] ?? "0")}
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEditPlan(plan)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(plan)} className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Life, AD&D, LTD, STD */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Life, AD&amp;D, LTD &amp; STD Plans</CardTitle>
          <Button size="sm" onClick={() => openAddPlan("rate")} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Plan
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {ratePlans.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No plans configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Plan Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Category</th>
                  <th className="text-left px-4 py-2.5 font-medium">Method</th>
                  <th className="text-right px-4 py-2.5 font-medium font-mono">Rate</th>
                  <th className="text-right px-4 py-2.5 font-medium font-mono">Earnings Cap</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {ratePlans.map((plan) => (
                  <tr key={plan.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{plan.planName}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs uppercase">{plan.category}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{plan.calculationMethod}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{plan.rate?.rate ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {plan.rate?.coveredEarningsCap ? formatCurrency(plan.rate.coveredEarningsCap) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEditPlan(plan)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(plan)} className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* HSA / HRA */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">HSA / HRA Employer Contributions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={hsaHraTab} onValueChange={(v) => setHsaHraTab(v as "hsa" | "hra")}>
            <TabsList className="bg-muted/40">
              <TabsTrigger value="hsa">HSA</TabsTrigger>
              <TabsTrigger value="hra">HRA</TabsTrigger>
            </TabsList>
            {(["hsa", "hra"] as const).map((type) => (
              <TabsContent key={type} value={type} className="mt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {TIERS.map((tier) => (
                    <div key={tier} className="space-y-1.5">
                      <Label>{TIER_LABELS[tier]}</Label>
                      <Input
                        value={type === "hsa" ? (hsaForm[tier] ?? "0") : (hraForm[tier] ?? "0")}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (type === "hsa") setHsaForm((f) => ({ ...f, [tier]: v }));
                          else setHraForm((f) => ({ ...f, [tier]: v }));
                        }}
                        className="font-mono"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
          <Button size="sm" onClick={handleSaveHsaHra} disabled={upsertHsaHra.isPending}>
            {upsertHsaHra.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Save HSA/HRA
          </Button>
        </CardContent>
      </Card>

      {/* Other Flat Costs */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Other Flat Costs (EAP, Wellness, etc.)</CardTitle>
          <Button size="sm" onClick={() => { setEditingFlatCost(null); setFlatCostForm(BLANK_FLAT_COST); setShowFlatCostDialog(true); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {flatCosts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No flat costs configured.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Cost Name</th>
                  <th className="text-right px-4 py-2.5 font-medium font-mono">Annual Per Employee</th>
                  <th className="text-center px-4 py-2.5 font-medium">Active</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {flatCosts.map((cost) => (
                  <tr key={cost.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{cost.costName}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(cost.annualCostPerEmployee)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cost.isActive ? "text-green-400 text-xs" : "text-muted-foreground text-xs"}>
                        {cost.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingFlatCost(cost);
                          setFlatCostForm({ costName: cost.costName, annualCostPerEmployee: cost.annualCostPerEmployee, isActive: cost.isActive, notes: cost.notes ?? "" });
                          setShowFlatCostDialog(true);
                        }}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteFlatTarget(cost)} className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Eligibility Rules */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Benefit Eligibility Rules</CardTitle>
          <Button size="sm" variant="outline" onClick={handleSaveEligibility} disabled={upsertEligibility.isPending}>
            {upsertEligibility.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save All
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-center px-4 py-2.5 font-medium">Min FTE</th>
                <th className="text-center px-4 py-2.5 font-medium">Include Part-Time</th>
                <th className="text-center px-4 py-2.5 font-medium">Include Seasonal</th>
              </tr>
            </thead>
            <tbody>
              {ELIGIBILITY_CATEGORIES.map((cat) => (
                <tr key={cat} className="border-b border-border/50">
                  <td className="px-4 py-2 font-medium capitalize">{cat.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2 text-center">
                    <Input
                      className="w-24 mx-auto h-7 text-center font-mono text-sm"
                      value={eligibilityForm[cat]?.minFteThreshold ?? "1.0000"}
                      onChange={(e) => setEligibilityForm((f) => ({ ...f, [cat]: { ...f[cat], minFteThreshold: e.target.value } }))}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={eligibilityForm[cat]?.includePartTime ?? false}
                      onChange={(e) => setEligibilityForm((f) => ({ ...f, [cat]: { ...f[cat], includePartTime: e.target.checked } }))}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={eligibilityForm[cat]?.includeSeasonal ?? false}
                      onChange={(e) => setEligibilityForm((f) => ({ ...f, [cat]: { ...f[cat], includeSeasonal: e.target.checked } }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <SelectTrigger className="w-64"><SelectValue placeholder="Select a group..." /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedGroupId && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {allPlans.filter((p) => p.isActive).map((plan) => (
                  <label key={plan.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={localAssigned.has(plan.id)}
                      onChange={() => setLocalAssigned((prev) => {
                        const next = new Set(prev);
                        if (next.has(plan.id)) next.delete(plan.id); else next.add(plan.id);
                        return next;
                      })}
                    />
                    <span>{plan.planName}</span>
                    <span className="text-xs text-muted-foreground capitalize">({plan.category})</span>
                  </label>
                ))}
              </div>
              <Button size="sm" onClick={handleSaveGroupAssignments} disabled={setGroupAssignments.isPending}>
                {setGroupAssignments.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Save Assignments
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Plan Add/Edit Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : `Add ${planCategory === "flat" ? "Health/Dental/Vision" : "Life/AD&D/LTD/STD"} Plan`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={planForm.category}
                  onValueChange={(v) => setPlanForm((f) => ({
                    ...f, category: v,
                    calculationMethod: DEFAULT_CALC_METHOD[v] ?? "flat_dollar",
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(planCategory === "flat" ? FLAT_CATEGORIES : RATE_CATEGORIES).map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan Name</Label>
                <Input value={planForm.planName} onChange={(e) => setPlanForm((f) => ({ ...f, planName: e.target.value }))} placeholder="e.g. PPO Blue, HDHP Gold" />
              </div>
            </div>

            {planCategory === "flat" && (
              <div className="space-y-2">
                <Label>Tier Employer Contributions (Annual)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {TIERS.map((t) => (
                    <div key={t} className="space-y-1">
                      <span className="text-xs text-muted-foreground">{TIER_LABELS[t]}</span>
                      <Input
                        value={planForm.tiers[t]}
                        onChange={(e) => setPlanForm((f) => ({ ...f, tiers: { ...f.tiers, [t]: e.target.value } }))}
                        className="font-mono h-8"
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {planCategory === "rate" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Rate</Label>
                  <Input value={planForm.rate} onChange={(e) => setPlanForm((f) => ({ ...f, rate: e.target.value }))} className="font-mono" placeholder="e.g. 0.25" />
                  <p className="text-xs text-muted-foreground">{planForm.calculationMethod === "rate_per_1000" ? "$ per $1,000 of benefit" : "$ per $100 of payroll"}</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Covered Earnings Cap (optional)</Label>
                  <Input value={planForm.coveredEarningsCap} onChange={(e) => setPlanForm((f) => ({ ...f, coveredEarningsCap: e.target.value }))} className="font-mono" placeholder="e.g. 200000" />
                </div>
                {["life", "add"].includes(planForm.category) && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Salary Multiplier (e.g. 1.0 for 1x)</Label>
                      <Input value={planForm.benefitMultiplier} onChange={(e) => setPlanForm((f) => ({ ...f, benefitMultiplier: e.target.value }))} className="font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Flat Benefit Amount (or leave blank)</Label>
                      <Input value={planForm.flatBenefitAmount} onChange={(e) => setPlanForm((f) => ({ ...f, flatBenefitAmount: e.target.value }))} className="font-mono" placeholder="e.g. 50000" />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={planForm.isActive} onCheckedChange={(v) => setPlanForm((f) => ({ ...f, isActive: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePlan} disabled={isPlanPending || !planForm.planName}>
              {isPlanPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flat Cost Dialog */}
      <Dialog open={showFlatCostDialog} onOpenChange={setShowFlatCostDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFlatCost ? "Edit Flat Cost" : "Add Flat Cost"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cost Name</Label>
              <Input value={flatCostForm.costName} onChange={(e) => setFlatCostForm((f) => ({ ...f, costName: e.target.value }))} placeholder="e.g. EAP, Wellness Program" />
            </div>
            <div className="space-y-1.5">
              <Label>Annual Cost Per Employee</Label>
              <Input value={flatCostForm.annualCostPerEmployee} onChange={(e) => setFlatCostForm((f) => ({ ...f, annualCostPerEmployee: e.target.value }))} className="font-mono" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={flatCostForm.isActive} onCheckedChange={(v) => setFlatCostForm((f) => ({ ...f, isActive: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFlatCostDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!districtId || !flatCostForm.costName) return;
                const body = { ...flatCostForm, notes: null };
                if (editingFlatCost) updateFlatCost.mutate({ id: editingFlatCost.id, data: { districtId, ...body } });
                else createFlatCost.mutate({ data: { districtId, ...body } });
              }}
              disabled={createFlatCost.isPending || updateFlatCost.isPending || !flatCostForm.costName}
            >
              {(createFlatCost.isPending || updateFlatCost.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingFlatCost ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.planName}?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the plan and all tier/rate data. Cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deletePlan.mutate({ id: deleteTarget.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Flat Cost Confirm */}
      <AlertDialog open={!!deleteFlatTarget} onOpenChange={(o) => !o && setDeleteFlatTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteFlatTarget?.costName}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteFlatTarget && deleteFlatCost.mutate({ id: deleteFlatTarget.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
