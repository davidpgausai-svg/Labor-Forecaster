import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import db from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  orgId: z.string().uuid(),
  state: z.string().length(2).optional(),
  pensionSystem: z.string().optional(),
  contractStartYear: z.number().int().optional(),
  contractEndYear: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  await assertOrgAccess(session.user.id, orgId);

  const r = await db.query(
    `SELECT p.*, u.name as created_by_name
     FROM bp_projects p
     LEFT JOIN bp_users u ON u.id = p.created_by
     WHERE p.organization_id = $1
     ORDER BY p.created_at DESC`,
    [orgId]
  );
  return NextResponse.json(r.rows);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { name, orgId, state, pensionSystem, contractStartYear, contractEndYear } = parsed.data;
  await assertOrgAccess(session.user.id, orgId);

  const r = await db.query<{ id: string }>(
    `INSERT INTO bp_projects (organization_id, name, state, pension_system, contract_start_year, contract_end_year, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [orgId, name, state ?? null, pensionSystem ?? null, contractStartYear ?? null, contractEndYear ?? null, session.user.id]
  );
  return NextResponse.json({ id: r.rows[0].id });
}
