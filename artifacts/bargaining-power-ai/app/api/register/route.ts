import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import db from "@/lib/db";
import { slugify } from "@/lib/orgs";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { name, email, password, orgName } = parsed.data;

  const existing = await db.query("SELECT id FROM bp_users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, 12);

  const userRes = await db.query<{ id: string }>(
    "INSERT INTO bp_users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [name, email, hash]
  );
  const userId = userRes.rows[0].id;

  // Generate unique slug
  let slug = slugify(orgName);
  const slugCheck = await db.query("SELECT id FROM bp_organizations WHERE slug = $1", [slug]);
  if (slugCheck.rows.length > 0) slug = `${slug}-${Date.now()}`;

  const orgRes = await db.query<{ id: string }>(
    "INSERT INTO bp_organizations (name, slug) VALUES ($1, $2) RETURNING id",
    [orgName, slug]
  );
  const orgId = orgRes.rows[0].id;

  await db.query(
    "INSERT INTO bp_user_organizations (user_id, organization_id, role, accepted_at) VALUES ($1, $2, $3, NOW())",
    [userId, orgId, "owner"]
  );

  return NextResponse.json({ orgSlug: slug });
}
