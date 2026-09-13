export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

export function formatUm(nm: number | null | undefined) {
  if (valueIsEmpty(nm)) return "—";
  return `${(nm! / 1000).toFixed(1)} µm`;
}

function valueIsEmpty(value: number | null | undefined): value is null | undefined {
  return value == null || Number.isNaN(value);
}

export function hashDayNumber(day: string) {
  let n = 0;
  for (const ch of day) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return (n % 900) + 1;
}
