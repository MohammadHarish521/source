import Link from "next/link";
import { formatNumber, shortId } from "@/lib/utils";

export type HopStop = {
  rootId: string;
  cellType?: string | null;
  synapsesFromPrev?: number | null;
};

export function HopRail({ hops }: { hops: HopStop[] }) {
  return (
    <ol className="relative ml-3 border-l border-[var(--accent)]/40 pl-6">
      {hops.map((hop, i) => (
        <li key={`${hop.rootId}-${i}`} className="relative pb-8 last:pb-0">
          <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border border-[var(--accent)] bg-[#070708]" />
          <Link href={`/neuron/${hop.rootId}`} className="block">
            <p className="label">{i === 0 ? "START" : `${formatNumber(hop.synapsesFromPrev)} synapses`}</p>
            <p className="mt-1 text-xl">{hop.cellType ?? shortId(hop.rootId)}</p>
            <p className="font-mono text-xs text-[var(--muted)]">{hop.rootId}</p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
