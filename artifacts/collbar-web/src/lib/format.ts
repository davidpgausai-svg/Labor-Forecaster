export function formatCurrency(amount: string | number | null | undefined, includeCents: boolean = false): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: includeCents ? 2 : 0,
    maximumFractionDigits: includeCents ? 2 : 0,
  }).format(num);
}

export function formatPercent(rate: string | number | null | undefined): string {
  if (rate === null || rate === undefined || rate === "") return "—";
  const num = typeof rate === "string" ? parseFloat(rate) : rate;
  if (isNaN(num)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num / 100);
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(num);
}
