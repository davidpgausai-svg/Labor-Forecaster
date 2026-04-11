"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import db from "@/lib/db";
import { slugify } from "@/lib/orgs";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  orgName: z.string().min(1, "Organization name is required"),
});

export async function registerAction(
  data: { name: string; email: string; password: string; orgName: string }
): Promise<string | undefined> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) return parsed.error.errors[0].message;

  const { name, email, password, orgName } = parsed.data;

  const existing = await db.query("SELECT id FROM bp_users WHERE email = $1", [email]);
  if (existing.rows.length > 0) return "Email already registered";

  const hash = await bcrypt.hash(password, 12);

  const userRes = await db.query<{ id: string }>(
    "INSERT INTO bp_users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [name, email, hash]
  );
  const userId = userRes.rows[0].id;

  let slug = slugify(orgName);
  const slugCheck = await db.query("SELECT id FROM bp_orgs WHERE slug = $1", [slug]);
  if (slugCheck.rows.length > 0) slug = `${slug}-${Date.now()}`;

  const orgRes = await db.query<{ id: string }>(
    "INSERT INTO bp_orgs (name, slug) VALUES ($1, $2) RETURNING id",
    [orgName, slug]
  );
  const orgId = orgRes.rows[0].id;

  await db.query(
    "INSERT INTO bp_org_members (user_id, organization_id, role, accepted_at) VALUES ($1, $2, $3, NOW())",
    [userId, orgId, "owner"]
  );

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai";
  try {
    await signIn("credentials", { email, password, redirectTo: `${basePath}/app/${slug}` });
  } catch (error) {
    if (error instanceof AuthError) return "Login after registration failed. Please sign in manually.";
    throw error;
  }
}
