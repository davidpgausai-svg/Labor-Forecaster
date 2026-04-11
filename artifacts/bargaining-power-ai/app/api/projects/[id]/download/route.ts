import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import { readFile } from "@/lib/python-executor";
import db from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;

  const project = await db.query<{ organization_id: string }>(
    "SELECT organization_id FROM bp_projects WHERE id = $1", [projectId]
  );
  if (!project.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await assertOrgAccess(session.user.id, project.rows[0].organization_id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const modelId = req.nextUrl.searchParams.get("modelId");

  const q = modelId
    ? await db.query<{ output_file_path: string; project_id: string }>(
        "SELECT output_file_path, project_id FROM bp_cost_models WHERE id = $1 AND project_id = $2 AND status = 'complete'",
        [modelId, projectId]
      )
    : await db.query<{ output_file_path: string; project_id: string }>(
        "SELECT output_file_path, project_id FROM bp_cost_models WHERE project_id = $1 AND status = 'complete' ORDER BY created_at DESC LIMIT 1",
        [projectId]
      );

  const model = q.rows[0];
  if (!model?.output_file_path) return NextResponse.json({ error: "No model available" }, { status: 404 });

  const buf = readFile(model.output_file_path);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cost_model.xlsx"`,
      "Content-Length": String(buf.length),
    },
  });
}
