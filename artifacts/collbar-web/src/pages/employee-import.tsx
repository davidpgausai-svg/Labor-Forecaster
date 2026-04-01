import { useState } from "react";
import { useImportEmployees } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { UploadCloud } from "lucide-react";

export default function EmployeeImport() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  const importMutation = useImportEmployees();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStep(2);
    }
  };

  const handleSimulateImport = () => {
    if (!districtId) return;
    toast({ title: "Importing...", description: "Simulating file upload..." });
    setTimeout(() => {
      toast({ title: "Success", description: "Import completed successfully." });
      setLocation("/employees");
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Employees</h1>
        <p className="text-muted-foreground text-sm">Upload roster data via CSV or Excel.</p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card className="bg-card border-border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Drag & Drop file here</h3>
            <p className="text-sm text-muted-foreground mb-6">Supports .csv, .xlsx</p>
            <div className="relative">
              <Button>Browse Files</Button>
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                accept=".csv, .xlsx" 
                onChange={handleFileChange}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>File Selected: {file?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground">
              In a full implementation, this step would map columns using Papaparse.
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(6)}>Skip to Import</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Ready to Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground">
              Click below to complete the import process.
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleSimulateImport}>Run Import</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
