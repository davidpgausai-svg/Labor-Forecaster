import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import db from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const pResult = await db.query<{
    id: string; name: string; status: string; state: string;
    pension_system: string; contract_start_year: number; contract_end_year: number;
    organization_id: string; metadata: Record<string, unknown>;
  }>(
    "SELECT * FROM bp_projects WHERE id = $1",
    [projectId]
  );
  const project = pResult.rows[0];
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await assertOrgAccess(session.user.id, project.organization_id).catch(() => {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  });

  const uploadsResult = await db.query(
    "SELECT id, file_name, file_type, file_size, processed, extracted_data, created_at FROM bp_uploads WHERE project_id = $1 ORDER BY created_at DESC",
    [projectId]
  );

  const modelsResult = await db.query(
    "SELECT id, version, status, summary, error_message, output_file_path, created_at FROM bp_cost_models WHERE project_id = $1 ORDER BY version DESC",
    [projectId]
  );

  return NextResponse.json({
    project,
    uploads: uploadsResult.rows,
    models: modelsResult.rows,
  });
}
