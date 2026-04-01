import { useState, useCallback } from "react";
import { useImportEmployees, CreateEmployeeRequest } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { UploadCloud, CheckCircle2, AlertCircle, FileText, ChevronRight } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type ParsedRow = Record<string, string>;

type ColumnMapping = {
  firstName: string;
  lastName: string;
  employeeId: string;
  baseSalary: string;
  bargainingUnitId: string;
  currentStep: string;
  currentLaneId: string;
  status: string;
};

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["firstName", "lastName", "baseSalary"];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  employeeId: "Employee ID",
  baseSalary: "Base Salary",
  bargainingUnitId: "Bargaining Unit",
  currentStep: "Current Step",
  currentLaneId: "Current Lane",
  status: "Status",
};

const SKIP_VALUE = "__skip__";

function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const lower = headers.map(h => h.toLowerCase().trim());
  const find = (patterns: string[]) => {
    const idx = lower.findIndex(h => patterns.some(p => h.includes(p)));
    return idx >= 0 ? headers[idx] : SKIP_VALUE;
  };
  return {
    firstName: find(["first", "fname"]),
    lastName: find(["last", "lname", "surname"]),
    employeeId: find(["employee id", "emp id", "id", "eid"]),
    baseSalary: find(["salary", "base", "pay"]),
    bargainingUnitId: find(["unit", "bargain", "bu"]),
    currentStep: find(["step"]),
    currentLaneId: find(["lane", "column", "col"]),
    status: find(["status", "active"]),
  };
}

function rowToEmployee(row: ParsedRow, mapping: ColumnMapping, districtId: string): CreateEmployeeRequest {
  const get = (field: keyof ColumnMapping) => {
    const col = mapping[field];
    return col && col !== SKIP_VALUE ? (row[col] ?? "") : "";
  };
  const salaryStr = get("baseSalary").replace(/[$,]/g, "");
  const salaryNum = parseFloat(salaryStr);
  const stepStr = get("currentStep");
  const buId = get("bargainingUnitId");
  return {
    districtId,
    firstName: get("firstName"),
    lastName: get("lastName"),
    employeeNumber: get("employeeId") || undefined,
    bargainingUnitId: buId || districtId,
    currentAnnualSalary: isNaN(salaryNum) ? "0" : String(Math.round(salaryNum)),
    currentStep: stepStr ? parseInt(stepStr, 10) || undefined : undefined,
    currentLaneId: get("currentLaneId") || undefined,
    status: get("status").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

export default function EmployeeImport() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row?: number; message?: string }[] } | null>(null);

  const importMutation = useImportEmployees();

  const parseFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
        if (parsed.length > 0) {
          const hdrs = Object.keys(parsed[0]);
          setHeaders(hdrs);
          setRows(parsed.slice(0, 500));
          setMapping(guessMapping(hdrs));
          setStep(2);
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      Papa.parse<ParsedRow>(f, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const hdrs = result.meta.fields ?? [];
          setHeaders(hdrs);
          setRows(result.data.slice(0, 500));
          setMapping(guessMapping(hdrs));
          setStep(2);
        },
      });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    parseFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    parseFile(f);
  };

  const isMappingValid = REQUIRED_FIELDS.every(f => mapping[f] && mapping[f] !== SKIP_VALUE);

  const handleRunImport = () => {
    if (!districtId || !isMappingValid) return;
    const employees: CreateEmployeeRequest[] = rows
      .map(row => rowToEmployee(row, mapping as ColumnMapping, districtId))
      .filter(e => e.firstName && e.lastName);

    importMutation.mutate(
      { data: { districtId, employees } },
      {
        onSuccess: (result) => {
          setImportResult(result);
          setStep(4);
        },
        onError: () => {
          toast({ title: "Import Failed", description: "An error occurred while importing employees.", variant: "destructive" });
        },
      }
    );
  };

  const STEPS = ["Upload", "Map Columns", "Preview", "Complete"];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Employees</h1>
        <p className="text-muted-foreground text-sm">Upload roster data via CSV or Excel to bulk-add employees.</p>
      </div>

      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 flex-1 ${stepNum < 4 ? "border-b-2" : ""} pb-2 ${isDone ? "border-primary" : isActive ? "border-primary/60" : "border-border"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/20 text-primary border border-primary/50" : "bg-muted text-muted-foreground"}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                </div>
                <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </div>
              {stepNum < STEPS.length && <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <Card
          className="bg-card border-border border-dashed border-2 hover:border-primary/50 transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Drag & drop file here</h3>
            <p className="text-sm text-muted-foreground mb-6">Supports .csv and .xlsx files (max 500 rows)</p>
            <div className="relative">
              <Button>Browse Files</Button>
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {file?.name}
            </CardTitle>
            <CardDescription>{rows.length} rows detected. Map your columns to employee fields.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map(field => (
                <div key={field} className="grid gap-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field) && <span className="text-destructive">*</span>}
                  </label>
                  <Select
                    value={mapping[field] ?? SKIP_VALUE}
                    onValueChange={val => setMapping(prev => ({ ...prev, [field]: val }))}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP_VALUE}>— Skip —</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!isMappingValid && (
              <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Required fields: {REQUIRED_FIELDS.filter(f => !mapping[f] || mapping[f] === SKIP_VALUE).map(f => FIELD_LABELS[f]).join(", ")}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={!isMappingValid}>Preview Import</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Showing first 10 rows. {rows.length} employees will be imported.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded border border-border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border">
                    <TableHead>#</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead className="text-right">Base Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((row, i) => {
                    const emp = rowToEmployee(row, mapping as ColumnMapping, districtId ?? "");
                    const isValid = !!(emp.firstName && emp.lastName);
                    return (
                      <TableRow key={i} className={`border-border ${!isValid ? "opacity-50" : ""}`}>
                        <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{emp.firstName || <span className="text-destructive">—</span>}</TableCell>
                        <TableCell>{emp.lastName || <span className="text-destructive">—</span>}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{emp.employeeNumber || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{emp.currentAnnualSalary && emp.currentAnnualSalary !== "0" ? `$${parseInt(emp.currentAnnualSalary).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={emp.status === "active" ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-muted-foreground border-border"}>
                            {emp.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleRunImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? "Importing..." : `Import ${rows.length} Employees`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && importResult && (
        <Card className="bg-card border-green-500/30 bg-green-500/5">
          <CardContent className="flex flex-col items-center py-12 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <h2 className="text-xl font-bold">Import Complete</h2>
            <div className="flex gap-6 text-sm">
              <div className="flex flex-col items-center">
                <span className="text-3xl font-mono font-bold text-green-400">{importResult.imported}</span>
                <span className="text-muted-foreground">Imported</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl font-mono font-bold text-amber-400">{importResult.skipped}</span>
                <span className="text-muted-foreground">Skipped</span>
              </div>
              {importResult.errors.length > 0 && (
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-mono font-bold text-destructive">{importResult.errors.length}</span>
                  <span className="text-muted-foreground">Errors</span>
                </div>
              )}
            </div>
            {importResult.errors.length > 0 && (
              <div className="w-full max-w-md text-left space-y-1 mt-2">
                {importResult.errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="text-xs text-destructive flex gap-2 bg-destructive/10 px-3 py-1.5 rounded">
                    <span className="font-mono">Row {err.row}</span>
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => setLocation("/employees")} className="mt-4">View Employees</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
