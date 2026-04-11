"use server";

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
    const e = error as { type?: string; digest?: string };
    if (e.digest?.startsWith("NEXT_REDIRECT")) throw error;
    if (e.type === "CredentialsSignin") return "Invalid email or password";
    throw error;
  }
}
