export function getBadgeColorClass(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("licensed") || lower.includes("teacher")) {
    return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  }
  if (lower.includes("esp") || lower.includes("support")) {
    return "bg-purple-500/10 text-purple-500 border-purple-500/20";
  }
  if (lower.includes("cm") || lower.includes("custodial") || lower.includes("maintenance")) {
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  }
  return "bg-slate-500/10 text-slate-500 border-slate-500/20";
}

export function getStatusBadgeClass(status: string) {
  switch (status) {
    case "draft":
      return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    case "active":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "final":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "archived":
      return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
    default:
      return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
}
