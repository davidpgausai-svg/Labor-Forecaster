import {
  useListEmployees,
  getListEmployeesQueryKey,
  useGetCompensationSchedule,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDistrictContext } from "@/context/DistrictContext";

function formatDollars(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function IndividualSalaryViewer({
  open,
  onClose,
  scheduleId,
  scheduleName,
  employeeGroupId,
}: {
  open: boolean;
  onClose: () => void;
  scheduleId: string;
  scheduleName: string;
  employeeGroupId: string;
}) {
  const { districtId } = useDistrictContext();

  const { data: employeeList, isLoading } = useListEmployees(
    { districtId: districtId ?? undefined, employeeGroupId, pageSize: 500 },
    {
      query: {
        enabled: open && !!districtId,
        queryKey: getListEmployeesQueryKey({ districtId: districtId ?? undefined, employeeGroupId, pageSize: 500 }),
      },
    }
  );

  const employees = employeeList?.employees ?? [];
  const sorted = [...employees].sort(
    (a, b) => parseFloat(b.currentAnnualSalary) - parseFloat(a.currentAnnualSalary)
  );

  const total = sorted.reduce(
    (s, e) => s + parseFloat(e.currentAnnualSalary),
    0
  );
  const avg = sorted.length > 0 ? total / sorted.length : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{scheduleName}</span>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-gray-500/30 text-gray-400"
            >
              Individual Salary
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1 mb-2">
          Read-only. Salaries are set per-employee and updated on the employee
          record.
        </p>

        <div className="space-y-0.5 min-h-[80px]">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No employees in this group yet.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_140px] gap-2 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Employee</span>
                <span className="text-right">Current Salary</span>
              </div>

              <div className="max-h-[360px] overflow-y-auto space-y-0.5 pr-1">
                {sorted.map((emp) => (
                  <div
                    key={emp.id}
                    className="grid grid-cols-[1fr_140px] gap-2 items-center px-2 py-1.5 rounded hover:bg-muted/30"
                  >
                    <span className="text-sm truncate">
                      {emp.lastName}, {emp.firstName}
                    </span>
                    <span className="text-sm font-mono text-right tabular-nums">
                      {formatDollars(emp.currentAnnualSalary)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_140px] gap-2 px-2 pt-2 mt-1 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {sorted.length} employee{sorted.length !== 1 ? "s" : ""} —
                  avg {formatDollars(avg)}
                </span>
                <span className="text-xs font-mono text-right tabular-nums text-muted-foreground">
                  {formatDollars(total)} total
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
