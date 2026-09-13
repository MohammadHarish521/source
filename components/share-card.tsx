"use client";

import { useState, type ReactNode } from "react";
import { shareOrCopy } from "@/lib/share";

export function ShareCard({
  kicker,
  title,
  body,
  text,
}: {
  kicker: string;
  title: string;
  body: ReactNode;
  text: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  return (
    <div className="share-card panel overflow-hidden">
      <div className="share-card-inner p-6">
        <p className="label">{kicker}</p>
        <h2 className="mt-3 text-4xl leading-none tracking-tight">{title}</h2>
        <div className="mt-6">{body}</div>
      </div>
      <div className="flex border-t border-[var(--line)]">
        <button
          className="flex-1 px-4 py-3 text-left label text-[var(--accent)]"
          onClick={async () => {
            const result = await shareOrCopy(text);
            setStatus(result);
          }}
        >
          {status === "copied" ? "COPIED" : status === "shared" ? "SHARED" : "COPY / SHARE"}
        </button>
      </div>
    </div>
  );
}

export function MoveDots({ used, failed }: { used: number; failed?: boolean }) {
  return (
    <div className="flex gap-2 text-2xl leading-none" aria-label={`${used} of 6 moves`}>
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={
            i < used
              ? failed
                ? "text-[var(--danger)]"
                : "text-[var(--accent)]"
              : "text-[var(--paper)]/20"
          }
        >
          ●
        </span>
      ))}
    </div>
  );
}
