import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DistrictProvider } from "@/context/DistrictContext";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Employees from "@/pages/employees";
import EmployeeImport from "@/pages/employee-import";
import EmployeeDetail from "@/pages/employee-detail";
import Schedules from "@/pages/schedules";
import Heatmap from "@/pages/heatmap";
import Scenarios from "@/pages/scenarios";
import ScenarioNew from "@/pages/scenario-new";
import ScenarioDetail from "@/pages/scenario-detail";
import ScenarioCompare from "@/pages/scenario-compare";
import ScenarioApply from "@/pages/scenario-apply";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/employees" component={Employees} />
        <Route path="/employees/import" component={EmployeeImport} />
        <Route path="/employees/:id" component={EmployeeDetail} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/heatmap" component={Heatmap} />
        <Route path="/scenarios" component={Scenarios} />
        <Route path="/scenarios/new" component={ScenarioNew} />
        <Route path="/scenarios/compare" component={ScenarioCompare} />
        <Route path="/scenarios/:id" component={ScenarioDetail} />
        <Route path="/scenarios/:id/apply" component={ScenarioApply} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DistrictProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </DistrictProvider>
    </QueryClientProvider>
  );
}

export default App;
