import { useState } from "react";
import { useListEmployees, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { formatCurrency } from "@/lib/format";
import { getBadgeColorClass } from "@/lib/badges";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Employees() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useListEmployees(
    { districtId: districtId!, page, pageSize },
    { query: { enabled: !!districtId, queryKey: getListEmployeesQueryKey({ districtId: districtId!, page, pageSize }) } }
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground text-sm">Manage roster and view projections.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/employees/import" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 gap-2">
            <Upload className="w-4 h-4" /> Import CSV/Excel
          </Link>
        </div>
      </div>

      <Card className="bg-card border-border">
        <div className="p-4 border-b border-border flex gap-4">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input placeholder="Search employees..." className="pl-9 bg-background/50 border-border" />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Step/Lane</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : data?.employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                data?.employees.map(emp => (
                  <TableRow 
                    key={emp.id} 
                    className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/employees/${emp.id}`)}
                  >
                    <TableCell className="font-medium">{emp.lastName}, {emp.firstName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getBadgeColorClass(emp.bargainingUnitName || "")}>
                        {emp.bargainingUnitName || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {emp.currentStep ? `Step ${emp.currentStep}` : "-"} 
                      {emp.laneName ? ` / ${emp.laneName}` : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(emp.currentAnnualSalary)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 capitalize">{emp.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {data && data.total > pageSize && (
          <div className="p-4 border-t border-border flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.total)} of {data.total}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-8 border-border">
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page * pageSize >= data.total} onClick={() => setPage(p => p + 1)} className="h-8 border-border">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
