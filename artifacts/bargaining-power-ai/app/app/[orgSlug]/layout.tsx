import { getOrgBySlug } from "@/lib/orgs";
import AppNav from "./AppNav";
import { notFound } from "next/navigation";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white flex flex-col">
      <AppNav orgSlug={orgSlug} orgName={org.name} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
