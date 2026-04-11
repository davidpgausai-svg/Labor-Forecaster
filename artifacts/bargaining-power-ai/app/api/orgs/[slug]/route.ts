import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrgBySlug, assertOrgAccess } from "@/lib/orgs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await assertOrgAccess(session.user.id, org.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ id: org.id, name: org.name, slug: org.slug, plan: org.plan });
}
