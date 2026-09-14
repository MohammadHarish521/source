"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { shortId } from "@/lib/utils";

export function NeuronTypeahead({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const results = useQuery({
    queryKey: ["search", value],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(value)}`).then((r) => r.json()),
    enabled: value.trim().length >= 2,
  });

  return (
    <div className="relative">
      <input
        className="w-full border border-[var(--line)] bg-transparent px-3 py-3 font-mono outline-none"
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && value.trim().length >= 2 && (results.data?.results ?? []).length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto border border-[var(--line)] bg-[#f7f8f4]">
          {(results.data.results as Array<{ rootId: string; cellType: string | null }>).slice(0, 8).map((hit) => (
            <li key={hit.rootId}>
              <button
                type="button"
                className="flex w-full justify-between px-3 py-2 text-left hover:bg-[var(--paper)]/5"
                onClick={() => {
                  onChange(hit.rootId);
                  setOpen(false);
                }}
              >
                <span>{hit.cellType ?? shortId(hit.rootId)}</span>
                <span className="font-mono text-xs text-[var(--muted)]">{shortId(hit.rootId)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
