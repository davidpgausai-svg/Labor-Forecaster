"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { signOutAction } from "./actions";

export default function AppNav({
  orgSlug,
  orgName,
}: {
  orgSlug: string;
  orgName: string;
}) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <header className="border-b border-white/10 bg-[#0d1117]">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={`/app/${orgSlug}`} className="font-bold text-blue-400 text-sm tracking-wide">
            Bargaining Power AI
          </Link>
          <span className="text-white/20">|</span>
          <span className="text-sm text-slate-300 font-medium">{orgName}</span>
          <span className="text-white/20">|</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href={`/app/${orgSlug}`}
              className={pathname === `/app/${orgSlug}` ? "text-white font-medium" : "text-slate-400 hover:text-white transition-colors"}
            >
              Projects
            </Link>
          </nav>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isPending}
          className="text-xs text-slate-500 hover:text-white transition-colors disabled:opacity-50"
        >
          {isPending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
