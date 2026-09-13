import type { PartnerEdge } from "@/lib/connectome/types";

const EDGES = [5, 10, 25, 50, 100, 250, 500, Infinity];

export function SynapseBars({ partners }: { partners: PartnerEdge[] }) {
  if (!partners.length) return null;
  const counts = EDGES.map(() => 0);
  for (const p of partners) {
    const idx = EDGES.findIndex((edge) => p.synapses <= edge);
    counts[idx === -1 ? counts.length - 1 : idx] += 1;
  }
  const max = Math.max(1, ...counts);
  return (
    <div>
      <p className="label">CONNECTIVITY DISTRIBUTION</p>
      <p className="label mt-1">DERIVED METRIC · synapse weight per partner</p>
      <ul className="mt-4 space-y-2">
        {EDGES.map((edge, i) => {
          const prev = i === 0 ? 5 : EDGES[i - 1] + 1;
          const label = edge === Infinity ? `${prev}+` : `${prev}–${edge}`;
          return (
            <li key={label} className="grid grid-cols-[72px_1fr_40px] items-center gap-3 text-xs font-mono">
              <span className="text-[var(--muted)]">{label}</span>
              <div className="h-px bg-[var(--line)]">
                <div
                  className="h-px bg-[var(--accent-2)]"
                  style={{ width: `${(counts[i] / max) * 100}%` }}
                />
              </div>
              <span>{counts[i]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
