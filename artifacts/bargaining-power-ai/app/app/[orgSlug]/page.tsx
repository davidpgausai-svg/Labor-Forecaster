import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrgBySlug, assertOrgAccess } from "@/lib/orgs";
import db from "@/lib/db";
import Link from "next/link";

export default async function OrgDashboard({ params }: { params: Promise<{ orgSlug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) redirect("/app");
  await assertOrgAccess(session.user.id, org.id).catch(() => redirect("/app"));

  const projects = await db.query<{
    id: string; name: string; status: string;
    contract_start_year: number; contract_end_year: number;
    created_at: string; state: string;
  }>(
    "SELECT id, name, status, contract_start_year, contract_end_year, created_at, state FROM bp_projects WHERE organization_id = $1 ORDER BY created_at DESC",
    [org.id]
  );

  const statusColor = (s: string) =>
    s === "complete" ? "text-green-400 bg-green-400/10 border-green-400/20"
    : s === "processing" ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : s === "error" ? "text-red-400 bg-red-400/10 border-red-400/20"
    : "text-slate-400 bg-white/5 border-white/10";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{projects.rows.length} project{projects.rows.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href={`/app/${orgSlug}/projects/new`}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          + New Project
        </Link>
      </div>

      {projects.rows.length === 0 ? (
        <div className="text-center py-20 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-slate-400 text-lg mb-4">No projects yet</p>
          <Link href={`/app/${orgSlug}/projects/new`}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors">
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.rows.map((p) => (
            <Link key={p.id} href={`/app/${orgSlug}/projects/${p.id}`}
              className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-5 py-4 hover:border-blue-500/40 transition-colors group">
              <div>
                <p className="font-semibold group-hover:text-blue-400 transition-colors">{p.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.state && `${p.state} · `}
                  {p.contract_start_year && p.contract_end_year
                    ? `CBA ${p.contract_start_year}–${p.contract_end_year} · `
                    : ""}
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs border px-2 py-0.5 rounded-full capitalize ${statusColor(p.status)}`}>
                {p.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
