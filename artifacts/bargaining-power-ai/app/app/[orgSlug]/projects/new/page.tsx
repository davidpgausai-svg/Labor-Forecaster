"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
];

const PENSION_SYSTEMS: Record<string, string> = {
  IL: "TRS (Illinois)", OH: "STRS Ohio", CA: "CalSTRS", TX: "TRS (Texas)",
  NY: "NYSTRS", PA: "PSERS", MI: "MPSERS", WI: "WRS", MN: "TRA", NJ: "TPAF",
  CT: "CTRB", MA: "MTRS",
};

const currentYear = new Date().getFullYear();

export default function NewProjectPage() {
  const router = useRouter();
  const params = useParams<{ orgSlug: string }>();
  const [form, setForm] = useState({
    name: "",
    state: "",
    pension_system: "",
    contract_start_year: String(currentYear),
    contract_end_year: String(currentYear + 3),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleStateChange(state: string) {
    setForm((f) => ({
      ...f,
      state,
      pension_system: PENSION_SYSTEMS[state] ?? "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Resolve org slug → id
      const orgRes = await fetch(`/api/orgs/${params.orgSlug}`);
      if (!orgRes.ok) throw new Error("Organization not found");
      const { id: orgId } = await orgRes.json();

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          orgId,
          state: form.state || undefined,
          pensionSystem: form.pension_system || undefined,
          contractStartYear: parseInt(form.contract_start_year) || undefined,
          contractEndYear: parseInt(form.contract_end_year) || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to create project");
      }
      const { id } = await res.json();
      router.push(`/app/${params.orgSlug}/projects/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  const labelCls = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";
  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">New Project</h1>
        <p className="text-slate-400 text-sm mt-1">
          Set up your CBA cost model project. You'll upload the CBA PDF and employee roster next.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelCls}>Project Name</label>
          <input
            type="text"
            required
            placeholder="e.g., Elmwood Teachers' Union 2025–2028"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>State</label>
            <select
              value={form.state}
              onChange={(e) => handleStateChange(e.target.value)}
              className={inputCls + " cursor-pointer"}
            >
              <option value="">Select state…</option>
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Pension System</label>
            <input
              type="text"
              placeholder="e.g., TRS, STRS"
              value={form.pension_system}
              onChange={(e) => setForm((f) => ({ ...f, pension_system: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>CBA Start Year</label>
            <input
              type="number"
              required
              min={2000}
              max={2040}
              value={form.contract_start_year}
              onChange={(e) => setForm((f) => ({ ...f, contract_start_year: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>CBA End Year</label>
            <input
              type="number"
              required
              min={2000}
              max={2045}
              value={form.contract_end_year}
              onChange={(e) => setForm((f) => ({ ...f, contract_end_year: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? "Creating…" : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
