import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileDown, Presentation, Table as TableIcon, FileText } from "lucide-react";

export default function Reports() {
  const { toast } = useToast();
  const handleGenerate = () => toast({ title: "Coming in Task 3", description: "Report generation will be implemented later." });
  
  const cards = [
    { title: "Board Presentation PDF", desc: "High-level summary of the final agreement", icon: Presentation },
    { title: "Negotiation Summary PDF", desc: "Detailed breakdown of changes by unit", icon: FileText },
    { title: "Employee Detail Excel", desc: "Line-by-line cost projection per employee", icon: TableIcon },
    { title: "Budget Impact PDF", desc: "Fiscal year cost impact for the district budget", icon: FileDown },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">Generate final board presentations and analytical datasets.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c, i) => (
          <Card key={i} className="bg-card border-border hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><c.icon className="w-5 h-5 text-primary" />{c.title}</CardTitle>
              <CardDescription>{c.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleGenerate} variant="outline" className="w-full border-border">Generate</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
