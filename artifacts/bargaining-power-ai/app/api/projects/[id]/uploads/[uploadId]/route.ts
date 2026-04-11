import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import db from "@/lib/db";
import { unlinkSync } from "fs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, uploadId } = await params;

  const upload = await db.query<{ organization_id: string; file_path: string }>(
    "SELECT organization_id, file_path FROM bp_uploads WHERE id = $1 AND project_id = $2",
    [uploadId, projectId]
  );
  if (!upload.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await assertOrgAccess(session.user.id, upload.rows[0].organization_id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete the file from disk (best-effort)
  try { unlinkSync(upload.rows[0].file_path); } catch { /* ignore if already gone */ }

  await db.query("DELETE FROM bp_uploads WHERE id = $1", [uploadId]);

  return NextResponse.json({ ok: true });
}
