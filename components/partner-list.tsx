"use client";

import { useMemo, useState } from "react";
import { formatNumber, shortId } from "@/lib/utils";

export type PickablePartner = {
  rootId: string;
  cellType: string | null;
  synapses: number;
  direction: string;
};

export function PartnerList({
  partners,
  targetId,
  disabled,
  onPick,
}: {
  partners: PickablePartner[];
  targetId?: string;
  disabled?: boolean;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"all" | "downstream" | "upstream">("all");

  const rows = useMemo(() => {
    const filtered = partners.filter((p) => {
      if (dir !== "all" && p.direction !== dir) return false;
      if (!q.trim()) return true;
      const hay = `${p.rootId} ${p.cellType ?? ""}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
    return filtered.sort((a, b) => {
      if (a.rootId === targetId) return -1;
      if (b.rootId === targetId) return 1;
      return b.synapses - a.synapses;
    });
  }, [partners, q, dir, targetId]);

  const maxSyn = Math.max(1, ...rows.map((p) => p.synapses));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="filter partners"
          className="min-w-[180px] flex-1 border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-xs outline-none"
        />
        {(["all", "downstream", "upstream"] as const).map((key) => (
          <button
            key={key}
            className={`label border px-3 py-2 ${dir === key ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)]"}`}
            onClick={() => setDir(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <ul className="mt-4 max-h-[52vh] space-y-2 overflow-auto pr-1">
        {rows.map((p) => {
          const isTarget = p.rootId === targetId;
          return (
            <li key={`${p.rootId}-${p.direction}`}>
              <button
                disabled={disabled}
                onClick={() => onPick(p.rootId)}
                className={`w-full border px-3 py-2 text-left ${
                  isTarget
                    ? "border-[var(--accent)] bg-[var(--accent)]/10"
                    : "border-[var(--line)] hover:border-[var(--paper)]/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {p.cellType ?? shortId(p.rootId)}
                    <span className="ml-2 label">{p.direction}</span>
                    {isTarget ? <span className="ml-2 label text-[var(--accent)]">TARGET</span> : null}
                  </span>
                  <span className="font-mono text-[var(--accent)]">{formatNumber(p.synapses)}</span>
                </div>
                <div className="mt-2 h-px bg-[var(--line)]">
                  <div
                    className="h-px bg-[var(--accent)]"
                    style={{ width: `${Math.max(6, (p.synapses / maxSyn) * 100)}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {!rows.length ? <p className="mt-4 label">No partners match that filter.</p> : null}
    </div>
  );
}
