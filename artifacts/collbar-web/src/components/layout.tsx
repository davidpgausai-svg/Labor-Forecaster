import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Calendar, Grid, FileText, Settings, Layers, Building2, DollarSign, HeartPulse, PiggyBank, Receipt, ChevronDown, ChevronRight } from "lucide-react";
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
];

const EMPLOYER_COSTS_ITEMS = [
  { href: "/employer-costs/benefits", label: "Benefits", icon: HeartPulse },
  { href: "/employer-costs/retirement", label: "Retirement", icon: PiggyBank },
  { href: "/employer-costs/taxes", label: "Taxes", icon: Receipt },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isEmployerCostsActive = location.startsWith("/employer-costs");
  const [employerCostsOpen, setEmployerCostsOpen] = useState(isEmployerCostsActive);
  const {
    districtId,
    districtName,
    scenarioId,
    setScenarioId,
    activeContractYear,
    setActiveContractYear,
    contractYears,
    yearLabelMap,
    isLoading: districtLoading,
  } = useDistrictContext();

  const { data: scenarios, isLoading: scenariosLoading } = useListScenarios(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListScenariosQueryKey({ districtId: districtId! }) } }
  );

  const currentPageLabel =
    location === "/"
      ? "Overview"
      : NAV_ITEMS.find((n) => location.startsWith(n.href) && n.href !== "/")?.label || "Page";

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            C
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-primary leading-tight">CollBar</div>
            {districtName && (
              <div className="text-[10px] text-sidebar-foreground/50 font-medium tracking-wide truncate max-w-[160px]">
                {districtName}
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Employer Costs collapsible group */}
          <button
            onClick={() => setEmployerCostsOpen((o) => !o)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isEmployerCostsActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span className="flex-1 text-left">Employer Costs</span>
            {employerCostsOpen
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {employerCostsOpen && (
            <div className="ml-3 pl-3 border-l border-sidebar-border/50 space-y-0.5">
              {EMPLOYER_COSTS_ITEMS.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              location.startsWith("/settings")
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-sidebar-border mt-auto">
          {districtLoading ? (
            <Skeleton className="h-4 w-32 bg-sidebar-accent" />
          ) : (
            <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
              <Building2 className="w-3 h-3" />
              <span className="uppercase tracking-wider font-semibold truncate">
                {districtName ?? "District Active"}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-foreground">{currentPageLabel}</div>
            {districtName && (
              <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="text-muted-foreground/50">•</span>
                <Building2 className="w-3 h-3" />
                <span>{districtName}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {contractYears.length > 0 && (
              <Select
                value={activeContractYear?.toString() ?? ""}
                onValueChange={(v) => setActiveContractYear(v ? parseInt(v) : null)}
              >
                <SelectTrigger className="w-[160px] h-9 border-border bg-background text-sm">
                  <SelectValue placeholder="Contract Year">
                    {activeContractYear !== null
                      ? (yearLabelMap.get(activeContractYear) ?? `Year ${activeContractYear}`)
                      : "Contract Year"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {contractYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {yearLabelMap.get(y) ?? `Year ${y}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {scenariosLoading ? (
              <Skeleton className="h-9 w-48" />
            ) : (
              <Select
                value={scenarioId || "default"}
                onValueChange={(val) =>
                  setScenarioId(val === "default" ? null : val)
                }
              >
                <SelectTrigger className="w-[240px] h-9 border-border bg-background">
                  <SelectValue placeholder="Select Scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default / Baseline</SelectItem>
                  {scenarios?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.isFinal ? "(Final)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        {/* Scrollable Page */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
