import db from "./db";

export async function getOrgBySlug(slug: string) {
  const r = await db.query<{ id: string; name: string; slug: string; plan: string }>(
    "SELECT id, name, slug, plan FROM bp_orgs WHERE slug = $1",
    [slug]
  );
  return r.rows[0] ?? null;
}

export async function getUserOrgs(userId: string) {
  const r = await db.query<{ id: string; name: string; slug: string; role: string }>(
    `SELECT o.id, o.name, o.slug, uo.role
     FROM bp_orgs o
     JOIN bp_org_members uo ON uo.organization_id = o.id
     WHERE uo.user_id = $1
     ORDER BY o.name`,
    [userId]
  );
  return r.rows;
}

export async function assertOrgAccess(userId: string, orgId: string) {
  const r = await db.query<{ role: string }>(
    "SELECT role FROM bp_org_members WHERE user_id = $1 AND organization_id = $2",
    [userId, orgId]
  );
  if (!r.rows[0]) throw new Error("Forbidden");
  return r.rows[0].role;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
