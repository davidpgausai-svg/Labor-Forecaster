import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
import { anthropic, MODELING_MODEL } from "@/lib/anthropic";
import { getModelingSystemPrompt } from "@/lib/skills";
import { executePythonModel, saveFile, readFile } from "@/lib/python-executor";
import db from "@/lib/db";
import { randomUUID } from "crypto";
import { PDFParse } from "pdf-parse";

export const maxDuration = 180;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const assumptions = body.assumptions ?? {};
  const userInstructions: string = body.userInstructions ?? "";

  const project = await db.query<{ organization_id: string; name: string }>(
    "SELECT organization_id, name FROM bp_projects WHERE id = $1", [projectId]
  );
  if (!project.rows[0]) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { organization_id } = project.rows[0];

  try {
    await assertOrgAccess(session.user.id, organization_id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load all CBA uploads as document blocks
  const cbaUploads = await db.query<{ file_path: string; file_name: string; mime_type: string }>(
    "SELECT file_path, file_name, mime_type FROM bp_uploads WHERE project_id = $1 AND file_type = 'cba' ORDER BY created_at ASC",
    [projectId]
  );

  if (cbaUploads.rows.length === 0) {
    return NextResponse.json({ error: "No CBA uploaded. Upload a CBA PDF before generating." }, { status: 400 });
  }

  // Load optional roster
  const rosterUpload = await db.query<{ file_path: string }>(
    "SELECT file_path FROM bp_uploads WHERE project_id = $1 AND file_type = 'roster' ORDER BY created_at DESC LIMIT 1",
    [projectId]
  );
  let rosterContent = "No roster provided — generate a realistic employee roster per SKILL.md rules.";
  if (rosterUpload.rows[0]) {
    try {
      rosterContent = readFile(rosterUpload.rows[0].file_path).toString("utf-8").slice(0, 50_000);
    } catch { /* use default */ }
  }

  // Create model record
  const modelRes = await db.query<{ id: string }>(
    `INSERT INTO bp_cost_models (project_id, organization_id, status, assumptions, generated_by)
     VALUES ($1, $2, 'generating', $3, $4) RETURNING id`,
    [projectId, organization_id, JSON.stringify(assumptions), session.user.id]
  );
  const modelId = modelRes.rows[0].id;
  const startMs = Date.now();

  await db.query("UPDATE bp_projects SET status = 'processing' WHERE id = $1", [projectId]);

  try {
    // Build message content: extract text from each CBA PDF, then append instructions
    const contentBlocks: { type: "text"; text: string }[] = [];

    for (const upload of cbaUploads.rows) {
      try {
        const buf = readFile(upload.file_path);
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        const [infoResult, textResult] = await Promise.all([
          parser.getInfo(),
          parser.getText(),
        ]);
        await parser.destroy();
        const pageCount = infoResult.total;
        const text = textResult.text.trim();
        contentBlocks.push({
          type: "text",
          text: `=== CBA DOCUMENT: ${upload.file_name} (${pageCount} pages) ===\n\n${text}`,
        });
      } catch {
        // File missing or parse failed — skip but don't fail
      }
    }

    contentBlocks.push({
      type: "text",
      text: `Build a complete cost model workbook for this CBA. Read the full document above carefully before modeling.

EMPLOYEE ROSTER:
${rosterContent}

USER INSTRUCTIONS:
${userInstructions || "No additional instructions — use the CBA document and skill files to make all modeling decisions."}

ASSUMPTIONS OVERRIDES:
${Object.keys(assumptions).length ? JSON.stringify(assumptions, null, 2) : "None."}

OUTPUT REQUIREMENTS:
- Output ONLY executable Python code using openpyxl
- The script must save the workbook to /tmp/output.xlsx
- Follow all formatting rules in OUTPUT-EXCEL-SPEC.md exactly
- Include all 7 required tabs
- Use Excel formulas for all calculations — never hardcode computed values
- Do not include any explanation, comments, or preamble — only the Python code
- Start with imports, end with wb.save('/tmp/output.xlsx')
- Wrap the entire script in a single \`\`\`python\`\`\` code block`,
    });

    const response = await anthropic.messages.create({
      model: MODELING_MODEL,
      max_tokens: 16000,
      system: getModelingSystemPrompt(),
      messages: [{ role: "user", content: contentBlocks as { type: "text"; text: string }[] }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response type from model");

    const excelBuffer = await executePythonModel(content.text);
    const filename = `${randomUUID()}_cost_model.xlsx`;
    const filePath = saveFile(excelBuffer, filename);
    const genMs = Date.now() - startMs;

    await db.query(
      `UPDATE bp_cost_models SET status='complete', output_file_path=$1, generation_time_ms=$2, summary=$3, updated_at=NOW() WHERE id=$4`,
      [filePath, genMs, JSON.stringify({ generated: true, model: MODELING_MODEL, generationTimeMs: genMs }), modelId]
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
