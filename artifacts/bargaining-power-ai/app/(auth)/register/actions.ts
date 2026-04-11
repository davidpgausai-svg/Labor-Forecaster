"use server";

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

  const hash = await bcrypt.hash(password, 12);

  let slug = slugify(orgName);

  const client = await db.connect();
  let orgSlug = slug;
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM bp_users WHERE email = $1 FOR UPDATE", [email]);
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return "Email already registered";
    }

    const userRes = await client.query<{ id: string }>(
      "INSERT INTO bp_users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [name, email, hash]
    );
    const userId = userRes.rows[0].id;

    const slugCheck = await client.query("SELECT id FROM bp_orgs WHERE slug = $1 FOR UPDATE", [slug]);
    if (slugCheck.rows.length > 0) slug = `${slug}-${Date.now()}`;
    orgSlug = slug;

    const orgRes = await client.query<{ id: string }>(
      "INSERT INTO bp_orgs (name, slug) VALUES ($1, $2) RETURNING id",
      [orgName, slug]
    );
    const orgId = orgRes.rows[0].id;

    await client.query(
      "INSERT INTO bp_org_members (user_id, organization_id, role, accepted_at) VALUES ($1, $2, $3, NOW())",
      [userId, orgId, "owner"]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai";
  try {
    await signIn("credentials", { email, password, redirectTo: `${basePath}/app/${orgSlug}` });
  } catch (error) {
    const e = error as { type?: string; digest?: string };
    if (e.digest?.startsWith("NEXT_REDIRECT")) throw error;
    if (e.type === "CredentialsSignin") return "Login after registration failed. Please sign in manually.";
    throw error;
  }
}
