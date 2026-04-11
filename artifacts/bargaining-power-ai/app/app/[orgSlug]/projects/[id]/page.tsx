"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/api";

type Upload = {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  processed: boolean;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
};

type CostModel = {
  id: string;
  version: number;
  status: string;
  summary: Record<string, unknown> | null;
  error_message: string | null;
  output_file_path: string | null;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  status: string;
  state: string | null;
  pension_system: string | null;
  contract_start_year: number | null;
  contract_end_year: number | null;
  metadata: Record<string, unknown>;
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const statusColor = (s: string) =>
  s === "complete" ? "text-green-400 bg-green-400/10 border-green-400/20"
  : s === "processing" || s === "generating" ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
  : s === "error" ? "text-red-400 bg-red-400/10 border-red-400/20"
  : "text-slate-400 bg-white/5 border-white/10";

export default function ProjectPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [models, setModels] = useState<CostModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [error, setError] = useState("");
  const [userInstructions, setUserInstructions] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchProject() {
    const res = await fetch(apiPath(`/api/projects/${id}`));
    if (!res.ok) return;
    const data = await res.json();
    setProject(data.project);
    setUploads(data.uploads ?? []);
    setModels(data.models ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll while any model is generating
  useEffect(() => {
    const hasActive = models.some((m) => m.status === "queued" || m.status === "generating");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(fetchProject, 5000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("fileType", file.name.toLowerCase().includes("roster") ? "roster" : "cba");
      const res = await fetch(apiPath(`/api/projects/${id}/upload`), { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Upload failed");
      }
      await fetchProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

async function handleGenerate() {
    setGenLoading(true);
    setError("");
    try {
      const res = await fetch(apiPath(`/api/projects/${id}/generate`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInstructions: userInstructions.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Generation failed");
      }
      await fetchProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenLoading(false);
    }
  }

  function handleDownload(modelId: string) {
    window.location.href = apiPath(`/api/projects/${id}/download?modelId=${modelId}`);
  }

  const cbaUploads = uploads.filter((u) => u.file_type === "cba");
  const rosterUploads = uploads.filter((u) => u.file_type === "roster");
  const latestModel = models[0] ?? null;
  const canGenerate = cbaUploads.length > 0 && (!latestModel || latestModel.status === "error" || latestModel.status === "complete");

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-slate-400 text-sm">Loading…</div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-slate-400 text-sm">Project not found.</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push(`/app/${orgSlug}`)}
            className="text-xs text-slate-500 hover:text-white transition-colors mb-2"
          >
            ← Back to projects
          </button>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-slate-400 text-sm mt-1">
            {project.state && `${project.state} · `}
            {project.pension_system && `${project.pension_system} · `}
            {project.contract_start_year && project.contract_end_year
              ? `CBA ${project.contract_start_year}–${project.contract_end_year}`
              : ""}
          </p>
        </div>
        <span className={`text-xs border px-2 py-0.5 rounded-full capitalize mt-1 ${statusColor(project.status)}`}>
          {project.status}
        </span>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Step 1: Upload Files */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">1</span>
            Upload Files
          </h2>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,.xlsx"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`cursor-pointer text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
              uploadLoading
                ? "bg-white/10 text-slate-500"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
            }`}
          >
            {uploadLoading ? "Uploading…" : "Upload File"}
          </label>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Upload the CBA PDF and optionally an employee roster (CSV or XLSX). Max 25 MB.
        </p>

        {uploads.length === 0 ? (
          <div
            className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500/40 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <p className="text-slate-400 text-sm">Click or drag files here</p>
            <p className="text-slate-600 text-xs mt-1">PDF, CSV, XLSX · Max 25 MB</p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-3 border border-white/5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.file_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {u.file_type.toUpperCase()} · {formatBytes(u.file_size ?? 0)} · {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full ml-4 flex-shrink-0">
                  Ready
                </span>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-slate-500 hover:text-white transition-colors mt-1"
            >
              + Upload another file
            </button>
          </div>
        )}
      </section>

      {/* Instructions */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h2 className="font-semibold flex items-center gap-2 mb-1">
          <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">2</span>
          Instructions for Collbar
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Tell Collbar what to model. Add context the PDF won&apos;t capture — pension details, headcount, scenarios, focus areas.
        </p>
        <textarea
          value={userInstructions}
          onChange={(e) => setUserInstructions(e.target.value)}
          placeholder={`Examples:\n• The district pays the employee's 9% TRS contribution\n• There are 142 full-time teachers and 18 part-time (0.5 FTE)\n• Model the union's proposal: 4% increase Year 1, 3.5% Year 2, 3% Year 3\n• Use Family tier for 60% of employees, Single for 40%\n• Focus the incremental analysis on Years 1 and 2\n• The BA Step 1 salary is $42,500 — use this as the base\n• This is a 1199SEIU healthcare contract — pension fund rate is 11.3%`}
          rows={7}
          className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-y font-mono leading-relaxed"
        />
        <p className="text-xs text-slate-600 mt-2">
          Injected directly into Collbar&apos;s engine. You can fill this in before or after uploading the CBA.
        </p>
      </section>

      {/* Step 3: Generate Cost Model */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${canGenerate ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-slate-600"}`}>3</span>
            Generate Excel Cost Model
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {canGenerate
            ? "Ready. Collbar will read the full CBA, apply your instructions, and generate a 7-tab Excel workbook."
            : "Upload a CBA PDF in Step 1 before generating."}
        </p>

        {rosterUploads.length === 0 && canGenerate && (
          <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 mb-4">
            No roster uploaded — Collbar will synthesize a representative employee roster from the CBA data.
          </div>
        )}

        {canGenerate && (
          <button
            onClick={handleGenerate}
            disabled={genLoading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto"
          >
            {genLoading ? "Queuing…" : "Generate Excel Model"}
          </button>
        )}

        {/* Model history */}
        {models.length > 0 && (
          <div className="space-y-2 mt-4">
            {models.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-3 border border-white/5">
                <div>
                  <p className="text-sm font-medium">
                    Version {m.version}
                    <span className={`ml-2 text-xs border px-2 py-0.5 rounded-full capitalize ${statusColor(m.status)}`}>
                      {m.status}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
                  {m.status === "error" && m.error_message && (
                    <p className="text-xs text-red-400 mt-1">{m.error_message}</p>
                  )}
                  {m.status === "generating" && (
                    <p className="text-xs text-amber-400 mt-1 animate-pulse">
                      Collbar is building your cost model… this takes 60–120 seconds.
                    </p>
                  )}
                  {m.summary && Object.keys(m.summary).length > 0 && (
                    <ModelSummary summary={m.summary} />
                  )}
                </div>
                {m.status === "complete" && m.output_file_path && (
                  <button
                    onClick={() => handleDownload(m.id)}
                    className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex-shrink-0 ml-4"
                  >
                    Download Excel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ExtractedDataView({ data }: { data: Record<string, unknown> }) {
  const sector = data.sector as string | undefined;
  const sectorLabel =
    sector === "k12" ? "K-12 School District"
    : sector === "healthcare" ? "Healthcare / Private Union"
    : sector === "building_trades" ? "Building Trades"
    : sector === "hospitality" ? "Hospitality / Service"
    : sector ?? "Unknown";

  const sectorColor =
    sector === "k12" ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
    : sector === "healthcare" ? "text-purple-400 bg-purple-400/10 border-purple-400/20"
    : "text-slate-400 bg-white/5 border-white/10";

  const topFields: [string, string][] = [
    ["Employer", "employer_name"],
    ["Union", "union_name"],
    ["State", "state"],
    ["Contract Start", "contract_start"],
    ["Contract End", "contract_end"],
    ["Contract Years", "contract_years"],
  ];

  const k12 = data.k12 as Record<string, unknown> | undefined;
  const hc = data.healthcare as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${sectorColor}`}>
          {sectorLabel}
        </span>
        {(data.red_flags as unknown[])?.length > 0 && (
          <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
            {(data.red_flags as unknown[]).length} flag{(data.red_flags as unknown[]).length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        {topFields.map(([label, key]) => {
          const val = data[key];
          if (val == null || val === "") return null;
          return (
            <div key={key}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm text-white mt-0.5">{String(val)}</p>
            </div>
          );
        })}
      </div>

      {sector === "k12" && k12 && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 pt-2 border-t border-white/5">
          {!!k12.retirement && (
            <div>
              <p className="text-xs text-slate-500">Pension System</p>
              <p className="text-sm text-white mt-0.5">
                {String((k12.retirement as Record<string, unknown>).system || "—")}
                {(k12.retirement as Record<string, unknown>).district_pays_employee
                  ? " (district-paid EE share)"
                  : ""}
              </p>
            </div>
          )}
          {!!k12.annual_increases && (
            <div>
              <p className="text-xs text-slate-500">Annual Increases</p>
              <p className="text-sm text-white mt-0.5 truncate">
                {JSON.stringify(k12.annual_increases)}
              </p>
            </div>
          )}
          {!!k12.contract_days && (
            <div>
              <p className="text-xs text-slate-500">Contract Days</p>
              <p className="text-sm text-white mt-0.5">{JSON.stringify(k12.contract_days)}</p>
            </div>
          )}
        </div>
      )}

      {sector === "healthcare" && hc && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 pt-2 border-t border-white/5">
          {!!hc.funds && (
            <>
              <div>
                <p className="text-xs text-slate-500">Pension Fund Rate</p>
                <p className="text-sm text-white mt-0.5">
                  {String((hc.funds as Record<string, unknown> & { pension_fund?: { rate_pct?: number } }).pension_fund?.rate_pct ?? "—")}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Employee Health Premium</p>
                <p className="text-sm text-white mt-0.5">
                  ${String(hc.employee_health_premium ?? 0)}/yr
                </p>
              </div>
            </>
          )}
          {!!hc.annual_increases && (
            <div>
              <p className="text-xs text-slate-500">Annual Increases</p>
              <p className="text-sm text-white mt-0.5 truncate">
                {JSON.stringify(hc.annual_increases)}
              </p>
            </div>
          )}
        </div>
      )}

      {(data.lump_sum_payments as unknown[])?.length > 0 && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-xs text-amber-400 font-medium">
            Lump sum payments detected (non-recurring, non-pensionable) — modeled separately
          </p>
        </div>
      )}
    </div>
  );
}

function ModelSummary({ summary }: { summary: Record<string, unknown> }) {
  const fmt = (v: unknown) => {
    if (typeof v === "number") {
      if (Math.abs(v) > 10000) return `$${v.toLocaleString()}`;
      return v.toLocaleString();
    }
    return String(v);
  };

  const highlights = [
    ["Total Current Payroll", "total_current_payroll"],
    ["Total ER Cost (Current)", "total_er_cost_current"],
    ["Total ER Cost (Projected)", "total_er_cost_projected"],
    ["Incremental ER Cost", "incremental_er_cost"],
    ["Cost Multiplier", "cost_multiplier"],
    ["Headcount", "headcount"],
  ];

  const shown = highlights.filter(([, k]) => summary[k] != null);
  if (shown.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {shown.map(([label, key]) => (
        <div key={key} className="bg-white/5 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-sm font-semibold text-white">{fmt(summary[key])}</p>
        </div>
      ))}
    </div>
  );
}
