import { useState, useMemo } from "react";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useListBargainingUnits,
  getListBargainingUnitsQueryKey,
  type Employee,
} from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { getBadgeColorClass } from "@/lib/badges";
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
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";

const ALL = "__all__";

export default function Employees() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [sorting, setSorting] = useState<SortingState>([]);

  const { data: units } = useListBargainingUnits(
    { districtId: districtId! },
    {
      query: {
        enabled: !!districtId,
        queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }),
      },
    }
  );

  const params = useMemo(
    () => ({
      districtId: districtId!,
      bargainingUnitId: unitFilter !== ALL ? unitFilter : undefined,
      status: statusFilter !== ALL ? statusFilter : undefined,
      page,
      pageSize,
    }),
    [districtId, unitFilter, statusFilter, page, pageSize]
  );

  const { data, isLoading } = useListEmployees(params, {
    query: {
      enabled: !!districtId,
      queryKey: getListEmployeesQueryKey(params),
    },
  });

  const filtered = useMemo(() => {
    if (!data?.employees) return [];
    const q = search.toLowerCase();
    return q
      ? data.employees.filter(
          (e) =>
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            (e.bargainingUnitName || "").toLowerCase().includes(q)
        )
      : data.employees;
  }, [data, search]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<Employee, any>[]>(
    () => [
      {
        accessorFn: (row) => `${row.lastName}, ${row.firstName}`,
        id: "name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting()}
          >
            Name <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.lastName}, {row.original.firstName}
          </span>
        ),
      },
      {
        accessorKey: "bargainingUnitName",
        header: "Unit",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={getBadgeColorClass(row.original.bargainingUnitName || "")}
          >
            {row.original.bargainingUnitName || "Unknown"}
          </Badge>
        ),
      },
      {
        id: "stepLane",
        header: "Step / Lane",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.currentStep ? `Step ${row.original.currentStep}` : "—"}
            {row.original.laneName ? ` / ${row.original.laneName}` : ""}
          </span>
        ),
      },
      {
        accessorKey: "currentAnnualSalary",
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
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.status === "active"
                ? "bg-green-500/10 text-green-500 border-green-500/20 capitalize"
                : "bg-muted text-muted-foreground capitalize"
            }
          >
            {row.original.status}
          </Badge>
        ),
      },
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

  const hasFilters = unitFilter !== ALL || statusFilter !== ALL || search;

  const clearFilters = () => {
    setSearch("");
    setUnitFilter(ALL);
    setStatusFilter(ALL);
    setPage(1);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground text-sm">
            Manage roster and view projections. {data?.total ? `${data.total} employees.` : ""}
          </p>
        </div>
        <Link
          href="/employees/import"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 gap-2"
        >
          <Upload className="w-4 h-4" /> Import CSV/Excel
        </Link>
      </div>

      <Card className="bg-card border-border">
        <div className="p-4 border-b border-border flex flex-wrap gap-3 items-center">
          <div className="relative w-56">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-background/50 border-border h-9 text-sm pr-3"
            />
          </div>

          <Select
            value={unitFilter}
            onValueChange={(v) => { setUnitFilter(v); setPage(1); }}
          >
            <SelectTrigger className="w-44 h-9 bg-background/50 border-border text-sm">
              <SelectValue placeholder="All Units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Units</SelectItem>
              {units?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); setPage(1); }}
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

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="border-border hover:bg-transparent">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    {hasFilters ? "No employees match the current filters." : "No employees found."}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/employees/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} of {data.total}
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
    </div>
  );
}
