import { useState, useCallback } from "react";
import { useImportEmployees, CreateEmployeeRequest } from "@workspace/api-client-react";
import { useDistrictContext } from "@/context/DistrictContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { UploadCloud, CheckCircle2, AlertCircle, FileText, ChevronRight, Pencil, X } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type ParsedRow = Record<string, string>;

type ColumnMapping = {
  firstName: string;
  lastName: string;
  employeeId: string;
  baseSalary: string;
  currentStep: string;
  currentLaneId: string;
  status: string;
};

type ValidationRow = {
  rowNum: number;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  baseSalary: string;
  status: string;
  errors: string[];
};

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["firstName", "lastName", "baseSalary"];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  employeeId: "Employee ID",
  baseSalary: "Base Salary",
  currentStep: "Current Step",
  currentLaneId: "Current Lane",
  status: "Status",
};

const SKIP_VALUE = "__skip__";
const CONTRACT_YEARS = [2024, 2025, 2026, 2027, 2028];

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
    currentStep: find(["step"]),
    currentLaneId: find(["lane", "column", "col"]),
    status: find(["status", "active"]),
  };
}

function rowToEmployee(
  row: ParsedRow,
  mapping: ColumnMapping,
  districtId: string,
): CreateEmployeeRequest {
  const get = (field: keyof ColumnMapping) => {
    const col = mapping[field];
    return col && col !== SKIP_VALUE ? (row[col] ?? "") : "";
  };
  const salaryStr = get("baseSalary").replace(/[$,]/g, "");
  const salaryNum = parseFloat(salaryStr);
  const stepStr = get("currentStep");
  return {
    districtId,
    firstName: get("firstName"),
    lastName: get("lastName"),
    employeeNumber: get("employeeId") || undefined,
    bargainingUnitId: "" as string,
    currentAnnualSalary: isNaN(salaryNum) ? "0" : String(Math.round(salaryNum)),
    currentStep: stepStr ? parseInt(stepStr, 10) || undefined : undefined,
    currentLaneId: get("currentLaneId") || undefined,
    status: get("status").toLowerCase() === "inactive" ? "inactive" : "active",
  };
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEPS = ["Upload", "Year & Options", "Map Columns", "Validate", "Preview", "Import"];

export default function EmployeeImport() {
  const { districtId } = useDistrictContext();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { row?: number; message?: string }[] } | null>(null);
  const [contractYear, setContractYear] = useState<number>(2025);
  const [incrementalMode, setIncrementalMode] = useState(false);
  const [validationRows, setValidationRows] = useState<ValidationRow[]>([]);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<ValidationRow>>({});
  const [importProgress, setImportProgress] = useState(0);

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

  const buildValidationRows = () => {
    if (!districtId) return;
    const vrows: ValidationRow[] = rows.slice(0, 200).map((row, i) => {
      const emp = rowToEmployee(row, mapping as ColumnMapping, districtId);
      const errors: string[] = [];
      if (!emp.firstName) errors.push("Missing first name");
      if (!emp.lastName) errors.push("Missing last name");
      if (!emp.currentAnnualSalary || emp.currentAnnualSalary === "0") errors.push("Missing salary");
      return {
        rowNum: i + 1,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeNumber: emp.employeeNumber ?? "",
        baseSalary: emp.currentAnnualSalary ?? "0",
        status: emp.status ?? "active",
        errors,
      };
    });
    setValidationRows(vrows);
    setStep(4);
  };

  const startEditRow = (rowNum: number) => {
    const vr = validationRows.find(r => r.rowNum === rowNum);
    if (!vr) return;
    setEditingRow(rowNum);
    setEditValues({ firstName: vr.firstName, lastName: vr.lastName, baseSalary: vr.baseSalary, status: vr.status });
  };

  const saveEditRow = (rowNum: number) => {
    setValidationRows(prev => prev.map(r => {
      if (r.rowNum !== rowNum) return r;
      const updated = { ...r, ...editValues };
      const errors: string[] = [];
      if (!updated.firstName) errors.push("Missing first name");
      if (!updated.lastName) errors.push("Missing last name");
      if (!updated.baseSalary || updated.baseSalary === "0") errors.push("Missing salary");
      return { ...updated, errors };
    }));
    setEditingRow(null);
    setEditValues({});
  };

  const dismissRow = (rowNum: number) => {
    setValidationRows(prev => prev.filter(r => r.rowNum !== rowNum));
  };

  const handleRunImport = () => {
    if (!districtId || !isMappingValid) return;

    const validRows = validationRows.filter(vr => vr.errors.length === 0);
    const employees: CreateEmployeeRequest[] = validRows.map(vr => ({
      districtId,
      firstName: vr.firstName,
      lastName: vr.lastName,
      employeeNumber: vr.employeeNumber || undefined,
      bargainingUnitId: "" as string,
      currentAnnualSalary: vr.baseSalary,
      status: vr.status as "active" | "inactive",
    }));

    if (employees.length === 0) {
      toast({ title: "No valid rows", description: "All rows have validation errors.", variant: "destructive" });
      return;
    }

    setImportProgress(10);
    const progressTimer = setInterval(() => {
      setImportProgress(p => Math.min(p + 15, 85));
    }, 300);

    const importPayload = {
      districtId,
      employees,
      contractYear,
      incremental: incrementalMode,
    };

    importMutation.mutate(
      { data: importPayload },
      {
        onSuccess: (result) => {
          clearInterval(progressTimer);
          setImportProgress(100);
          setImportResult(result);
          setTimeout(() => setStep(6), 400);
        },
        onError: () => {
          clearInterval(progressTimer);
          setImportProgress(0);
          toast({ title: "Import Failed", description: "An error occurred while importing employees.", variant: "destructive" });
        },
      }
    );
    setStep(5);
  };

  const errorRows = validationRows.filter(r => r.errors.length > 0);
  const validCount = validationRows.filter(r => r.errors.length === 0).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Employees</h1>
        <p className="text-muted-foreground text-sm">Upload roster data via CSV or Excel to bulk-add employees.</p>
      </div>

      <div className="flex items-center gap-0 mb-8 overflow-x-auto">
        {STEPS.map((label, i) => {
          const stepNum = (i + 1) as Step;
          const isActive = stepNum === step;
          const isDone = stepNum < step;
          return (
            <div key={label} className="flex items-center gap-0 flex-shrink-0">
              <div className={`flex flex-col items-center gap-1 px-1 ${isDone ? "opacity-80" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/20 text-primary border border-primary/50" : "bg-muted text-muted-foreground"}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : stepNum}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mb-4 ${isDone ? "bg-primary" : "bg-border"}`} />
              )}
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
              Import Options
            </CardTitle>
            <CardDescription>
              {file?.name} — {rows.length} rows detected. Configure import settings before mapping columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contract Year</label>
                <Select value={String(contractYear)} onValueChange={v => setContractYear(parseInt(v))}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_YEARS.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}–{y + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Employees are associated with the selected contract year.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium">Incremental Import</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, only adds new employees. Duplicate Employee IDs will be skipped.
                  When disabled, existing employees with matching IDs will be updated.
                </p>
              </div>
              <Switch
                checked={incrementalMode}
                onCheckedChange={setIncrementalMode}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Map Columns</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
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
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={buildValidationRows} disabled={!isMappingValid}>Validate Rows</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Validation & Inline Correction</CardTitle>
            <CardDescription>
              Review all rows. Rows with errors must be corrected or dismissed before import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                {validCount} valid
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                  {errorRows.length} rows with errors
                </Badge>
              )}
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                Contract Year: {contractYear}–{contractYear + 1}
              </Badge>
              {incrementalMode && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  Incremental Mode On
                </Badge>
              )}
            </div>

            <div className="overflow-x-auto rounded border border-border max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow className="border-border">
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Emp ID</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationRows.map(({ rowNum, firstName, lastName, employeeNumber, baseSalary, status, errors }) => {
                    const isEditing = editingRow === rowNum;
                    return (
                      <TableRow key={rowNum} className={`border-border ${errors.length > 0 ? "bg-destructive/5" : ""}`}>
                        <TableCell className="font-mono text-muted-foreground text-xs">{rowNum}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editValues.firstName ?? ""} onChange={e => setEditValues(p => ({ ...p, firstName: e.target.value }))} className="h-7 text-xs w-28" />
                          ) : (
                            <span className={!firstName ? "text-destructive" : ""}>{firstName || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input value={editValues.lastName ?? ""} onChange={e => setEditValues(p => ({ ...p, lastName: e.target.value }))} className="h-7 text-xs w-28" />
                          ) : (
                            <span className={!lastName ? "text-destructive" : ""}>{lastName || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{employeeNumber || "—"}</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <Input value={editValues.baseSalary ?? ""} onChange={e => setEditValues(p => ({ ...p, baseSalary: e.target.value }))} className="h-7 text-xs w-24 text-right" />
                          ) : (
                            <span className={`font-mono ${(!baseSalary || baseSalary === "0") ? "text-destructive" : ""}`}>
                              {baseSalary && baseSalary !== "0" ? `$${parseInt(baseSalary).toLocaleString()}` : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={status === "active" ? "text-green-400 border-green-500/30 bg-green-500/10 text-xs" : "text-muted-foreground border-border text-xs"}>
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {errors.length === 0 ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              {errors.map((err, ei) => (
                                <span key={ei} className="text-xs text-destructive flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0" />{err}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => saveEditRow(rowNum)}>Save</Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditRow(rowNum)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => dismissRow(rowNum)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                {errorRows.length > 0 ? `${errorRows.length} rows with errors will be skipped.` : "All rows are valid and ready to import."}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
                <Button onClick={() => setStep(5)} disabled={validCount === 0}>Preview {validCount} Valid Rows</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Preview & Confirm</CardTitle>
            <CardDescription>
              {validationRows.filter(r => r.errors.length === 0).length} valid rows ready to import for contract year {contractYear}–{contractYear + 1}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-full max-w-xs">
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-muted-foreground mt-3">
                    Importing {validCount} employees… {importProgress}%
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded border border-border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="border-border">
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>First Name</TableHead>
                        <TableHead>Last Name</TableHead>
                        <TableHead>Emp ID</TableHead>
                        <TableHead className="text-right">Salary</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationRows.filter(r => r.errors.length === 0).slice(0, 20).map(vr => (
                        <TableRow key={vr.rowNum} className="border-border">
                          <TableCell className="font-mono text-muted-foreground text-xs">{vr.rowNum}</TableCell>
                          <TableCell>{vr.firstName}</TableCell>
                          <TableCell>{vr.lastName}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{vr.employeeNumber || "—"}</TableCell>
                          <TableCell className="text-right font-mono">
                            {vr.baseSalary && vr.baseSalary !== "0" ? `$${parseInt(vr.baseSalary).toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={vr.status === "active" ? "text-green-400 border-green-500/30 bg-green-500/10 text-xs" : "text-muted-foreground border-border text-xs"}>
                              {vr.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {validCount > 20 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + {validCount - 20} more rows not shown in preview
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setStep(4)}>Back</Button>
                  <Button onClick={handleRunImport} disabled={importMutation.isPending}>
                    {importMutation.isPending ? "Importing..." : `Import ${validCount} Employees`}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 6 && importResult && (
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
            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => { setStep(1); setFile(null); setRows([]); setImportResult(null); }}>
                Import Another File
              </Button>
              <Button onClick={() => setLocation("/employees")}>View Employees</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
