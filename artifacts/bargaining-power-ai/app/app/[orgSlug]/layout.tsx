"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { use } from "react";

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0a0e14] text-white flex flex-col">
      {/* Top nav */}
      <header className="border-b border-white/10 bg-[#0d1117]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/app/${orgSlug}`} className="font-bold text-blue-400 text-sm tracking-wide">
              Bargaining Power AI
            </Link>
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
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
