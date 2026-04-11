"use server";

import { signOut } from "@/lib/auth";

export async function signOutAction() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai";
  await signOut({ redirectTo: `${basePath}/login` });
}
