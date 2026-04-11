"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { registerAction } from "./actions";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", orgName: "" });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const err = await registerAction(form);
      if (err) setError(err);
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">14-day free trial · No credit card required</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          {[
            { label: "Your Name", key: "name" as const, type: "text" },
            { label: "Work Email", key: "email" as const, type: "email" },
            { label: "Password", key: "password" as const, type: "password" },
            { label: "Organization / District Name", key: "orgName" as const, type: "text" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 uppercase tracking-wider">{label}</label>
              <input
                type={type} required
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg font-semibold transition-colors">
            {isPending ? "Creating account…" : "Start Free Trial"}
          </button>
        </form>
        <p className="text-center text-slate-500 text-sm mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
