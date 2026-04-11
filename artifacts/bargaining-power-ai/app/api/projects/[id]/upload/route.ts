import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import { saveFile } from "@/lib/python-executor";
import db from "@/lib/db";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = ["application/pdf", "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const fileType = formData.get("fileType") as string ?? "other";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "File type not allowed" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = saveFile(buf, filename);

  const r = await db.query<{ id: string }>(
    `INSERT INTO bp_uploads (project_id, organization_id, file_name, file_type, file_path, file_size, mime_type, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [projectId, project.rows[0].organization_id, file.name, fileType, filePath, file.size, file.type, session.user.id]
  );
  return NextResponse.json({ uploadId: r.rows[0].id });
}
