import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertOrgAccess } from "@/lib/orgs";
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

  try {
    await assertOrgAccess(session.user.id, upload.rows[0].organization_id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
          text: `First, classify this CBA as one of: "k12", "healthcare", "building_trades", "hospitality", or "other".

Then extract ALL compensation-relevant data and return as a single JSON object only (no markdown, no preamble, no explanation).

Use this structure — populate the fields relevant to the sector and leave irrelevant sections null:

{
  "sector": "k12 | healthcare | building_trades | hospitality | other",
  "employer_name": "",
  "union_name": "",
  "contract_start": "",
  "contract_end": "",
  "contract_years": 0,
  "state": "",

  "k12": {
    "salary_schedule": { "lanes": [], "steps": {} },
    "contract_days": [],
    "pay_distribution_months": 12,
    "annual_increases": [],
    "stipend_schedule": null,
    "retirement": {
      "system": "",
      "employee_rate": 0,
      "employer_rate": 0,
      "district_pays_employee": false,
      "social_security_exempt": true,
      "this_employee_rate": 0,
      "this_employer_rate": 0
    },
    "insurance": {
      "medical_sharing": {},
      "dental_sharing": {},
      "vision_sharing": {},
      "life_coverage_amount": 0,
      "ltd_provided": false,
      "hsa_contribution_single": 0,
      "hsa_contribution_family": 0
    }
  },

  "healthcare": {
    "rate_table": [],
    "annual_increases": [],
    "longevity_provisions": [],
    "funds": {
      "benefit_fund": { "type": "pmpy | pct_wages", "rate": 0, "notes": "" },
      "pension_fund": { "rate_pct": 0, "employee_contribution": 0, "notes": "" },
      "training_fund": { "rate_pct": 0 },
      "job_security_fund": { "rate_pct": 0, "balance_cap": null },
      "child_care_fund": { "rate_pct": 0 },
      "other_funds": []
    },
    "employee_health_premium": 0,
    "social_security_exempt": false,
    "hours_per_week": 35,
    "specialty_pay": []
  },

  "lump_sum_payments": [],
  "red_flags": []
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
