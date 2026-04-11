"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const err = await loginAction({ email: form.email, password: form.password });
      if (err) setError(err);
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Bargaining Power AI</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Email</label>
            <input
              type="email" required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider">Password</label>
            <input
              type="password" required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg font-semibold transition-colors">
            {isPending ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="text-center text-slate-500 text-sm mt-4">
          No account?{" "}
          <Link href="/register" className="text-blue-400 hover:text-blue-300">Start free trial</Link>
        </p>
      </div>
    </div>
  );
}
