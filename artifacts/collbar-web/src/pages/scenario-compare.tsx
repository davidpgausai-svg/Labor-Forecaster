import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function ScenarioCompare() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="p-8 max-w-5xl mx-auto text-center space-y-6">
      <h1 className="text-2xl font-bold">Compare Scenarios</h1>
      <p className="text-muted-foreground">Select multiple scenarios from the scenarios list to compare them side-by-side.</p>
      <Button onClick={() => setLocation("/scenarios")}>Back to Scenarios</Button>
    </div>
  );
}
