import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0e14] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <span className="text-xl font-bold text-blue-400">Bargaining Power AI</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 py-24 text-center">
        <div className="inline-block bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs px-3 py-1 rounded-full mb-6">
          AI-Powered · Board-Ready · Excel Output
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-6 leading-tight">
          Know the True Cost of Every Contract
          <span className="text-blue-400"> Before You Sign</span>
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
          Upload your collective bargaining agreement and employee roster. Get a complete total cost of employment model — employer impact, employee impact, year-over-year projections — as a professional Excel workbook in minutes.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/register" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors">
            Get Started
          </Link>
          <Link href="/login" className="border border-white/20 hover:border-white/40 text-white px-8 py-3 rounded-lg text-lg transition-colors">
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "Employer Cost", desc: "Total cost of employment: salary, retirement, taxes, insurance — line by line, employee by employee." },
          { title: "Employee Impact", desc: "Net take-home pay analysis so you can answer: 'What does this actually mean for our teachers?'" },
          { title: "Multi-Year Projections", desc: "Step advancement, schedule increases, benefits trend, lane movement — all five cost drivers modeled." },
        ].map((f) => (
          <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="font-semibold text-lg mb-2 text-blue-400">{f.title}</h3>
            <p className="text-slate-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Social proof */}
      <section className="text-center py-12 text-slate-500 text-sm border-t border-white/10">
        Built by a 19-year HR Technology leader · Designed for K-12 CSBOs and HR Directors
      </section>
    </main>
  );
}
