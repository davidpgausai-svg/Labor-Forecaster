import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { anthropic, EXTRACTION_MODEL } from "@/lib/anthropic";
import { getExtractionSystemPrompt } from "@/lib/skills";
import { readFile } from "@/lib/python-executor";
import db from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { uploadId } = await req.json();

  const upload = await db.query<{ file_path: string; mime_type: string; organization_id: string }>(
    "SELECT file_path, mime_type, organization_id FROM bp_uploads WHERE id = $1 AND project_id = $2",
    [uploadId, projectId]
  );
  if (!upload.rows[0]) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

  const { file_path, mime_type } = upload.rows[0];
  const fileBuffer = readFile(file_path);
  const base64 = fileBuffer.toString("base64");

  const mediaType = mime_type === "application/pdf" ? "application/pdf" : "text/plain";

  const response = await anthropic.messages.create({
    model: EXTRACTION_MODEL,
    max_tokens: 8000,
    system: getExtractionSystemPrompt(),
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: mediaType as "application/pdf", data: base64 },
        } as { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } },
        {
          type: "text",
          text: `Extract the following from this CBA and return as JSON only (no markdown, no preamble):
{
  "district_name": "",
  "union_name": "",
  "contract_start": "",
  "contract_end": "",
  "contract_years": 0,
  "state": "",
  "salary_schedule": {
    "lanes": [],
    "steps": {}
  },
  "contract_days": [],
  "pay_distribution_months": 12,
  "annual_increases": [],
  "retirement": {
    "system": "",
    "employee_rate": 0,
    "employer_rate": 0,
    "district_pays_employee": false,
    "social_security_exempt": true
  },
  "insurance": {
    "medical_sharing": {},
    "dental_sharing": {},
    "life_coverage": 0,
    "ltd_provided": false
  },
  "stipend_schedule": null
}`,
        },
      ],
    }],
  });

  const content = response.content[0];
  let extracted: Record<string, unknown> = {};
  if (content.type === "text") {
    try {
      extracted = JSON.parse(content.text.trim());
    } catch {
      extracted = { raw: content.text };
    }
  }

  await db.query(
    "UPDATE bp_uploads SET extracted_data = $1, processed = TRUE WHERE id = $2",
    [JSON.stringify(extracted), uploadId]
  );
  await db.query(
    "UPDATE bp_projects SET metadata = metadata || $1::jsonb WHERE id = $2",
    [JSON.stringify({ extracted: extracted }), projectId]
  );

  return NextResponse.json({ extracted });
}
