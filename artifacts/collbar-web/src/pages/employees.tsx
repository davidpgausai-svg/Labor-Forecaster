import { useState, useMemo, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useListEmployeeGroups,
  getListEmployeeGroupsQueryKey,
  useCreateEmployee,
  type Employee,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUpDown,
  Filter,
  Clock,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  createColumnHelper,
  type SortingState,
  flexRender,
} from "@tanstack/react-table";

const ALL = "__all__";
const columnHelper = createColumnHelper<Employee>();

export default function Employees() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: "", lastName: "", employeeNumber: "",
    employeeGroupId: "",
    currentAnnualSalary: "",
    status: "active", contractYear: 0,
  });

  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(searchTimeout.current), []);
  const [rosterFilter, setRosterFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [laneFilter, setLaneFilter] = useState(ALL);
  const [insuranceFilter, setInsuranceFilter] = useState(ALL);
  const [retirementFilter, setRetirementFilter] = useState(ALL);
  const [stepMin, setStepMin] = useState("");
  const [stepMax, setStepMax] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: employeeGroups } = useListEmployeeGroups(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListEmployeeGroupsQueryKey({ districtId: districtId! }),
      },
    }
  );

  const filteredGroupId = rosterFilter.startsWith("g:") ? rosterFilter.slice(2) : undefined;

  const params = useMemo(
    () => ({
      districtId: districtId!,
      employeeGroupId: filteredGroupId,
      status: statusFilter !== ALL ? statusFilter : undefined,
      search: search.trim() || undefined,
      page,
      pageSize,
    }),
    [districtId, filteredGroupId, statusFilter, search, page, pageSize]
  );

  const queryClient = useQueryClient();
  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        setShowAddDialog(false);
        // Reset roster filter to show all employees so the new one is visible
        setRosterFilter(ALL);
        setAddForm({ firstName: "", lastName: "", employeeNumber: "", employeeGroupId: "", currentAnnualSalary: "", status: "active", contractYear: 0 });
      },
    },
  });

  const { data, isLoading } = useListEmployees(params, {
    query: {
      enabled: !!districtId,
      queryKey: getListEmployeesQueryKey(params),
    },
  });

  const allLanes = useMemo(() => {
    if (!data?.employees) return [];
    const lanes = [...new Set(data.employees.map((e) => e.laneName).filter(Boolean) as string[])];
    return lanes.sort();
  }, [data]);

  const allInsuranceElections = useMemo(() => {
    if (!data?.employees) return [];
    const elections = [...new Set(data.employees.map((e) => e.insuranceElection).filter(Boolean))];
    return elections.sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data?.employees) return [];
    const stepMinNum = stepMin !== "" ? parseInt(stepMin, 10) : null;
    const stepMaxNum = stepMax !== "" ? parseInt(stepMax, 10) : null;
    const salaryMinNum = salaryMin !== "" ? parseFloat(salaryMin.replace(/,/g, "")) : null;
    const salaryMaxNum = salaryMax !== "" ? parseFloat(salaryMax.replace(/,/g, "")) : null;
    return data.employees.filter((e) => {
      if (laneFilter !== ALL && e.laneName !== laneFilter) return false;
      if (insuranceFilter !== ALL && e.insuranceElection !== insuranceFilter) return false;
      if (retirementFilter !== ALL) {
        const isEligible = retirementFilter === "eligible";
        if (!!e.retirementEligible !== isEligible) return false;
      }
      if (stepMinNum !== null && e.currentStep !== null && e.currentStep !== undefined && e.currentStep < stepMinNum) return false;
      if (stepMaxNum !== null && e.currentStep !== null && e.currentStep !== undefined && e.currentStep > stepMaxNum) return false;
      const salary = parseFloat(e.currentAnnualSalary) || 0;
      if (salaryMinNum !== null && salary < salaryMinNum) return false;
      if (salaryMaxNum !== null && salary > salaryMaxNum) return false;
      return true;
    });
  }, [data, laneFilter, insuranceFilter, retirementFilter, stepMin, stepMax, salaryMin, salaryMax]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => `${row.lastName}, ${row.firstName}`, {
        id: "name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Name <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => {
          const hasPending = (row.original as unknown as Record<string, unknown>).pendingEffectiveContractYear != null;
          return (
            <span className="inline-flex items-center gap-1.5 font-medium">
              {row.original.lastName}, {row.original.firstName}
              {hasPending && (
                <span title="Has a pending future position change">
                  <Clock className="w-3 h-3 text-amber-400" />
                </span>
              )}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "group",
        header: "Group",
        cell: ({ row }) => {
          const groupName = (row.original as unknown as Record<string, unknown>).employeeGroupName as string | undefined;
          return (
            <div className="flex flex-col gap-0.5">
              {groupName ? (
                <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20 w-fit text-xs">
                  {groupName}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "stepLane",
        header: "Step / Lane",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.currentStep ? `Step ${row.original.currentStep}` : "—"}
            {row.original.laneName ? ` / ${row.original.laneName}` : ""}
          </span>
        ),
      }),
      columnHelper.accessor("insuranceElection", {
        header: "Insurance",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground capitalize">
            {getValue() || "—"}
          </span>
        ),
      }),
      columnHelper.accessor("retirementEligible", {
        header: "Retirement",
        cell: ({ getValue }) => (
          getValue()
            ? <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">Eligible</Badge>
            : <span className="text-muted-foreground text-sm">—</span>
        ),
      }),
      columnHelper.accessor("currentAnnualSalary", {
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Salary <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-sm">
            {formatCurrency(row.original.currentAnnualSalary)}
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <Badge
            variant="outline"
            className={
              getValue() === "active"
                ? "bg-green-500/10 text-green-500 border-green-500/20 capitalize"
                : "bg-muted text-muted-foreground capitalize"
            }
          >
            {getValue()}
          </Badge>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const hasFilters =
    rosterFilter !== ALL ||
    statusFilter !== ALL ||
    laneFilter !== ALL ||
    insuranceFilter !== ALL ||
    retirementFilter !== ALL ||
    stepMin !== "" ||
    stepMax !== "" ||
    salaryMin !== "" ||
    salaryMax !== "" ||
    !!search;

  const clearFilters = () => {
    setInputValue("");
    setSearch("");
    setRosterFilter(ALL);
    setStatusFilter(ALL);
    setLaneFilter(ALL);
    setInsuranceFilter(ALL);
    setRetirementFilter(ALL);
    setStepMin("");
    setStepMax("");
    setSalaryMin("");
    setSalaryMax("");
    setPage(1);
  };

  const handleAddEmployee = () => {
    const payload: Record<string, unknown> = {
      districtId,
      firstName: addForm.firstName,
      lastName: addForm.lastName,
      employeeNumber: addForm.employeeNumber || undefined,
      currentAnnualSalary: addForm.currentAnnualSalary || "0",
      status: addForm.status,
      contractYear: addForm.contractYear || 0,
    };
    if (addForm.employeeGroupId) {
      payload.employeeGroupId = addForm.employeeGroupId;
    }
    createMutation.mutate({ data: payload as unknown as Parameters<typeof createMutation.mutate>[0]["data"] });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground text-sm">
            Manage roster and view projections.{" "}
            {data?.total ? `${data.total} employees.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setShowAddDialog(true)} className="h-9 gap-2">
            + Add Employee
          </Button>
          <Link
            href="/employees/import"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 gap-2"
          >
            <Upload className="w-4 h-4" /> Import CSV/Excel
          </Link>
        </div>
      </div>

      <Card className="bg-card border-border">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative w-56">
              <Input
                placeholder="Search by name or group..."
                value={inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setInputValue(value);
                  clearTimeout(searchTimeout.current);
                  searchTimeout.current = setTimeout(() => {
                    setSearch(value);
                    setPage(1);
                  }, 300);
                }}
                className="bg-background/50 border-border h-9 text-sm pr-3"
              />
            </div>

            <Select
              value={rosterFilter}
              onValueChange={(v) => { setRosterFilter(v); setPage(1); }}
            >
              <SelectTrigger className="w-56 h-9 bg-background/50 border-border text-sm">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Employees</SelectItem>
                {(employeeGroups?.length ?? 0) > 0 && (
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee Groups</div>
                )}
                {employeeGroups?.map((g) => (
                  <SelectItem key={g.id} value={`g:${g.id}`}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36 h-9 bg-background/50 border-border text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="leave">On Leave</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showAdvanced ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAdvanced((v) => !v)}
              className="h-9 gap-1 text-sm"
            >
              <Filter className="w-3.5 h-3.5" />
              More Filters
            </Button>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 px-3 text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="w-4 h-4" /> Clear
              </Button>
            )}
          </div>

          {showAdvanced && (
            <div className="flex flex-wrap gap-3 pt-1 border-t border-border/50">
              <Select
                value={laneFilter}
                onValueChange={(v) => {
                  setLaneFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40 h-8 bg-background/50 border-border text-xs">
                  <SelectValue placeholder="All Lanes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Lanes</SelectItem>
                  {allLanes.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={insuranceFilter}
                onValueChange={(v) => {
                  setInsuranceFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40 h-8 bg-background/50 border-border text-xs">
                  <SelectValue placeholder="Insurance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Insurance</SelectItem>
                  {allInsuranceElections.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={retirementFilter}
                onValueChange={(v) => {
                  setRetirementFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44 h-8 bg-background/50 border-border text-xs">
                  <SelectValue placeholder="Retirement Eligibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Employees</SelectItem>
                  <SelectItem value="eligible">Retirement Eligible</SelectItem>
                  <SelectItem value="not-eligible">Not Eligible</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Step:</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="Min"
                  value={stepMin}
                  onChange={(e) => { setStepMin(e.target.value); setPage(1); }}
                  className="h-8 w-16 bg-background/50 border-border text-xs"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="Max"
                  value={stepMax}
                  onChange={(e) => { setStepMax(e.target.value); setPage(1); }}
                  className="h-8 w-16 bg-background/50 border-border text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Salary $:</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={salaryMin}
                  onChange={(e) => { setSalaryMin(e.target.value); setPage(1); }}
                  className="h-8 w-24 bg-background/50 border-border text-xs"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={salaryMax}
                  onChange={(e) => { setSalaryMax(e.target.value); setPage(1); }}
                  className="h-8 w-24 bg-background/50 border-border text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  className="border-border hover:bg-transparent"
                >
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24 ml-auto" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-10 text-muted-foreground"
                  >
                    {hasFilters
                      ? "No employees match the current filters."
                      : "No employees found."}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() =>
                      setLocation(`/employees/${row.original.id}`)
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {data && data.total > pageSize && (
          <div className="p-4 border-t border-border flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, data.total)} of {data.total}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 border-border"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * pageSize >= data.total}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 border-border"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">First Name</Label>
                <Input className="bg-background/50 h-9 text-sm" value={addForm.firstName} onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input className="bg-background/50 h-9 text-sm" value={addForm.lastName} onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Employee Number (optional)</Label>
              <Input className="bg-background/50 h-9 text-sm" value={addForm.employeeNumber} onChange={e => setAddForm(f => ({ ...f, employeeNumber: e.target.value }))} placeholder="e.g. EMP-001" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Employee Group</Label>
              <Select value={addForm.employeeGroupId} onValueChange={v => setAddForm(f => ({ ...f, employeeGroupId: v }))}>
                <SelectTrigger className="bg-background/50 h-9 text-sm"><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>
                  {employeeGroups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Annual Salary</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input className="bg-background/50 h-9 text-sm pl-6" value={addForm.currentAnnualSalary} onChange={e => setAddForm(f => ({ ...f, currentAnnualSalary: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={addForm.status} onValueChange={v => setAddForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-background/50 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="new_hire">New Hire</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAddEmployee}
              disabled={!addForm.firstName || !addForm.lastName || createMutation.isPending}
            >
              {createMutation.isPending ? "Adding..." : "Add Employee"}
            </Button>
          </DialogFooter>
          {createMutation.isError && (
            <p className="text-xs text-red-400 px-1">{String((createMutation.error as unknown as Record<string, unknown>)?.message ?? "Failed to add employee")}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
