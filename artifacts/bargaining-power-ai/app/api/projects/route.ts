import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  await assertOrgAccess(session.user.id, orgId);

  const result = await db.query(
    "SELECT id, name, status, state, pension_system, contract_start_year, contract_end_year, created_at FROM bp_projects WHERE organization_id = $1 ORDER BY created_at DESC",
    [orgId]
  );
  return NextResponse.json({ projects: result.rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, orgId, state, pensionSystem, contractStartYear, contractEndYear } = body;

  if (!name || !orgId) return NextResponse.json({ error: "name and orgId required" }, { status: 400 });

  await assertOrgAccess(session.user.id, orgId);

  const result = await db.query<{ id: string }>(
    `INSERT INTO bp_projects (organization_id, name, state, pension_system, contract_start_year, contract_end_year, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [orgId, name, state ?? null, pensionSystem ?? null, contractStartYear ?? null, contractEndYear ?? null, session.user.id]
  );

  return NextResponse.json({ id: result.rows[0].id });
}
