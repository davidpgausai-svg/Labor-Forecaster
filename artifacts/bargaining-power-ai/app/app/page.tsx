import { auth } from "@/lib/auth";
import { getUserOrgs } from "@/lib/orgs";
import { redirect } from "next/navigation";

export default async function AppRoot() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgs = await getUserOrgs(session.user.id);
  if (orgs.length === 0) redirect("/register");
  redirect(`/app/${orgs[0].slug}`);
}
