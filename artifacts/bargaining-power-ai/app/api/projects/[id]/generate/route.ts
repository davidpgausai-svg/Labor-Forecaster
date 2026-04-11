import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import { anthropic, MODELING_MODEL } from "@/lib/anthropic";
import { getModelingSystemPrompt } from "@/lib/skills";
import { executePythonModel, saveFile, readFile } from "@/lib/python-executor";
import db from "@/lib/db";
import { randomUUID } from "crypto";

export const maxDuration = 180;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { assumptions = {} } = await req.json().catch(() => ({ assumptions: {} }));

  const project = await db.query<{ organization_id: string; metadata: Record<string, unknown>; name: string }>(
    "SELECT organization_id, metadata, name FROM bp_projects WHERE id = $1", [projectId]
  );
  if (!project.rows[0]) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { organization_id, metadata } = project.rows[0];

  try {
    await assertOrgAccess(session.user.id, organization_id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rosterUpload = await db.query<{ file_path: string }>(
    "SELECT file_path FROM bp_uploads WHERE project_id = $1 AND file_type = 'roster' ORDER BY created_at DESC LIMIT 1",
    [projectId]
  );
  let rosterContent = "No roster provided — generate 100 realistic employees per SKILL.md rules.";
  if (rosterUpload.rows[0]) {
    try {
      rosterContent = readFile(rosterUpload.rows[0].file_path).toString("utf-8").slice(0, 50_000);
    } catch { /* use default */ }
  }

  const modelRes = await db.query<{ id: string }>(
    `INSERT INTO bp_cost_models (project_id, organization_id, status, assumptions, generated_by)
     VALUES ($1, $2, 'generating', $3, $4) RETURNING id`,
    [projectId, organization_id, JSON.stringify(assumptions), session.user.id]
  );
  const modelId = modelRes.rows[0].id;
  const startMs = Date.now();

  await db.query("UPDATE bp_projects SET status = 'processing' WHERE id = $1", [projectId]);

  try {
    const extractedData = (metadata as { extracted?: unknown }).extracted ?? metadata;

    const response = await anthropic.messages.create({
      model: MODELING_MODEL,
      max_tokens: 16000,
      system: getModelingSystemPrompt(),
      messages: [{
        role: "user",
        content: `Build a complete cost model workbook for this CBA.

CBA EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

EMPLOYEE ROSTER:
${rosterContent}

ASSUMPTIONS OVERRIDES:
${JSON.stringify(assumptions, null, 2)}

INSTRUCTIONS:
- Output ONLY executable Python code using openpyxl
- The script must save the workbook to /tmp/output.xlsx
- Follow all formatting rules in OUTPUT-EXCEL-SPEC.md
- Include all 7 required tabs
- Use Excel formulas for all calculations
- Do not include any explanation — only the Python code
- Start with imports, end with wb.save('/tmp/output.xlsx')
- Wrap the entire script in a single code block with \`\`\`python\`\`\``,
      }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type from Claude");

    const excelBuffer = await executePythonModel(content.text);
    const filename = `${randomUUID()}_cost_model.xlsx`;
    const filePath = saveFile(excelBuffer, filename);
    const genMs = Date.now() - startMs;

    const summary = {
      generated: true,
      model: MODELING_MODEL,
      generationTimeMs: genMs,
    };

    await db.query(
      `UPDATE bp_cost_models SET status='complete', output_file_path=$1, generation_time_ms=$2, summary=$3, updated_at=NOW() WHERE id=$4`,
      [filePath, genMs, JSON.stringify(summary), modelId]
    );
    await db.query("UPDATE bp_projects SET status='complete', updated_at=NOW() WHERE id=$1", [projectId]);

    return NextResponse.json({ modelId, status: "complete" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.query(
      "UPDATE bp_cost_models SET status='error', error_message=$1, updated_at=NOW() WHERE id=$2",
      [msg, modelId]
    );
    await db.query("UPDATE bp_projects SET status='error', updated_at=NOW() WHERE id=$1", [projectId]);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
