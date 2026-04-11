"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function loginAction(
  data: { email: string; password: string; callbackUrl?: string }
): Promise<string | undefined> {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai";
  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirectTo: data.callbackUrl ?? `${basePath}/app`,
    });
  } catch (error) {
    if (error instanceof AuthError) return "Invalid email or password";
    throw error;
  }
}
