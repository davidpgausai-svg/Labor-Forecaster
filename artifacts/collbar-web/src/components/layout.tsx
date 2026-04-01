import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Calendar, Grid, FileText, Settings, Layers } from "lucide-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useListScenarios, getListScenariosQueryKey } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/schedules", label: "Schedules", icon: Calendar },
  { href: "/heatmap", label: "Heatmap", icon: Grid },
  { href: "/scenarios", label: "Scenarios", icon: Layers },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { districtId, scenarioId, setScenarioId, isLoading: districtLoading } = useDistrictContext();

  const { data: scenarios, isLoading: scenariosLoading } = useListScenarios(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListScenariosQueryKey({ districtId: districtId! }) } }
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="font-bold text-xl tracking-tight text-primary flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">C</div>
            CollBar
          </div>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border mt-auto">
          {districtLoading ? (
            <Skeleton className="h-4 w-32 bg-sidebar-accent" />
          ) : (
            <div className="text-xs text-sidebar-foreground/50 uppercase tracking-wider font-semibold">
              District Active
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 flex-shrink-0">
          <div className="text-sm font-medium text-muted-foreground">
            {location === "/" ? "Overview" : NAV_ITEMS.find(n => location.startsWith(n.href) && n.href !== "/")?.label || "Page"}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Contract Years: 2024-2028
            </div>
            {scenariosLoading ? (
              <Skeleton className="h-9 w-48" />
            ) : (
              <Select value={scenarioId || "default"} onValueChange={(val) => setScenarioId(val === "default" ? null : val)}>
                <SelectTrigger className="w-[240px] h-9 border-border bg-background">
                  <SelectValue placeholder="Select Scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default / Baseline</SelectItem>
                  {scenarios?.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} {s.isFinal ? "(Final)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        {/* Scrollable Page */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
