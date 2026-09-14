"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MoveDots, ShareCard } from "@/components/share-card";
import { PartnerList, type PickablePartner } from "@/components/partner-list";
import { playShareText } from "@/lib/share";
import { formatNumber, shortId } from "@/lib/utils";

type Puzzle = {
  number: number;
  start?: { rootId: string; cellType: string | null };
  target?: { rootId: string; cellType: string | null };
  shortest?: number | null;
  error?: string;
  stats?: { players: number; completions: number; averageMoves: number | null; completionRate: number | null };
  user?: { handle: string; streak: number; bestSixDegrees: number | null };
  history?: Array<{ day: string; moves: number | null; completed: number }>;
  play?: { completed: number; moves: number | null; path: string | null };
};

export default function PlayPage() {
  const today = useQuery({
    queryKey: ["play"],
    queryFn: () => fetch("/api/play/today").then((r) => r.json() as Promise<Puzzle>),
  });
  const [path, setPath] = useState<string[]>([]);
  const [partners, setPartners] = useState<PickablePartner[]>([]);
  const [done, setDone] = useState<{ moves: number; shortest: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const puzzle = today.data;
  const restored = useMemo(() => {
    if (done || path.length) return null;
    if (puzzle?.play?.completed && puzzle.play.path) {
      try {
        return JSON.parse(puzzle.play.path) as string[];
      } catch {
        return null;
      }
    }
    return null;
  }, [puzzle, done, path.length]);

  const start = useMutation({
    mutationFn: async () => {
      await fetch("/api/play/move", { method: "PUT" });
      const startId = today.data?.start?.rootId;
      if (!startId) throw new Error("No start neuron yet.");
      setPath([startId]);
      setDone(null);
      setFailed(false);
      setMoveError(null);
      const p = await fetch(`/api/neuron/${startId}/partners`).then((r) => r.json());
      setPartners([...(p.downstream ?? []), ...(p.upstream ?? [])]);
    },
  });

  const move = useMutation({
    mutationFn: async (next: string) => {
      const res = await fetch("/api/play/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: path[path.length - 1], next, path }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      const nextPath = [...path, next];
      setPath(nextPath);
      if (res.completed) {
        setDone({ moves: res.moves, shortest: res.shortest });
        today.refetch();
      } else if (nextPath.length > 6) {
        setFailed(true);
        await fetch("/api/play/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ failed: true, path: nextPath }),
        });
      } else {
        const p = res.partners;
        setPartners([...(p.downstream ?? []), ...(p.upstream ?? [])]);
      }
      return res;
    },
    onError: (err: Error) => setMoveError(err.message),
  });

  if (puzzle?.error) {
    return (
      <main className="px-5 py-16">
        <p className="label">{puzzle.error}</p>
      </main>
    );
  }

  const used = done?.moves ?? Math.max(0, path.length - 1);
  const showResult = done || (puzzle?.play?.completed && !path.length);
  const resultMoves = done?.moves ?? puzzle?.play?.moves ?? 0;
  const resultShortest = done?.shortest ?? puzzle?.shortest ?? null;
  const share = playShareText({
    number: puzzle?.number ?? 0,
    moves: resultMoves,
    status: failed ? "FAILED" : "CONNECTED",
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="label">SIX DEGREES OF FLY · #{puzzle?.number ?? "—"}</p>
      <h1 className="mt-3 text-5xl">Cross the brain in six hops.</h1>
      <p className="mt-4 max-w-xl text-[var(--muted)]">
        Same start. Same target. Real partners only. The shortest path stays hidden until you connect.
      </p>

      <div className="mt-6 flex flex-wrap gap-4 label">
        <span>STREAK {formatNumber(puzzle?.user?.streak)}</span>
        <span>BEST {puzzle?.user?.bestSixDegrees ?? "—"}</span>
        <span>PLAYERS {formatNumber(puzzle?.stats?.players)}</span>
        <span>DONE {formatNumber(puzzle?.stats?.completions)}</span>
        <span>
          AVG {puzzle?.stats?.averageMoves != null ? puzzle.stats.averageMoves.toFixed(1) : "—"}
        </span>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card title="START" id={puzzle?.start?.rootId} type={puzzle?.start?.cellType} />
        <Card title="TARGET" id={puzzle?.target?.rootId} type={puzzle?.target?.cellType} />
      </div>
      {puzzle?.number && !puzzle.start ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Today’s pair is reserved, but those cells are not in the live index yet. Play unlocks as soon as they resolve.
        </p>
      ) : null}

      {showResult && !failed ? (
        <div className="mt-10">
          <ShareCard
            kicker={`FLY #${String(puzzle?.number ?? 0).padStart(3, "0")}`}
            title={`CONNECTED IN ${resultMoves}.`}
            text={share}
            body={
              <div>
                <MoveDots used={resultMoves} />
                <p className="mt-4 font-mono text-sm">
                  {resultMoves} / 6
                  {resultShortest != null ? ` · best possible ${resultShortest}` : ""}
                </p>
              </div>
            }
          />
          <button className="mt-4 label border border-[var(--line)] px-4 py-2" onClick={() => start.mutate()}>
            PLAY AGAIN
          </button>
        </div>
      ) : !path.length ? (
        <div className="mt-8">
          {restored ? (
            <p className="mb-4 text-sm text-[var(--muted)]">You already connected today. Open the card or try a cleaner path.</p>
          ) : null}
          <button
            className="border border-[var(--accent)] bg-[var(--accent)] px-6 py-3 font-medium text-white disabled:opacity-40"
            disabled={!puzzle?.start?.rootId || start.isPending}
            onClick={() => start.mutate()}
          >
            START TODAY’S FLY
          </button>
        </div>
      ) : (
        <div className="mt-8">
          <MoveDots used={used} failed={failed} />
          <p className="mt-4 font-mono text-sm">{path.map(shortId).join(" → ")}</p>
          <p className="label mt-2">{used} / 6</p>
          {failed ? (
            <div className="panel mt-6 p-6">
              <h2 className="text-3xl text-[var(--danger)]">OUT OF MOVES.</h2>
              <p className="mt-3 text-[var(--muted)]">The wiring is still real. Shortest path stays hidden until someone connects.</p>
              <button className="mt-4 border border-[var(--paper)] px-4 py-2" onClick={() => start.mutate()}>
                TRY AGAIN
              </button>
            </div>
          ) : (
            <>
              {moveError ? <p className="mt-4 text-sm text-[var(--danger)]">{moveError}</p> : null}
              <div className="mt-6">
                <PartnerList
                  partners={partners}
                  targetId={puzzle?.target?.rootId}
                  disabled={move.isPending}
                  onPick={(id) => move.mutate(id)}
                />
              </div>
            </>
          )}
        </div>
      )}

      {(puzzle?.history ?? []).length ? (
        <section className="mt-14">
          <p className="label">PERSONAL HISTORY</p>
          <ul className="mt-4 space-y-2">
            {puzzle?.history?.map((row, i) => (
              <li key={`${row.day}-${i}`} className="flex justify-between border-b border-[var(--line)] py-2 font-mono text-sm">
                <span>{row.day}</span>
                <span>{row.completed ? `${row.moves} hops` : "unfinished"}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Card({ title, id, type }: { title: string; id?: string; type?: string | null }) {
  if (!id) return <div className="panel p-4 label">Loading official pair…</div>;
  return (
    <Link href={`/neuron/${id}`} className="panel block p-4">
      <p className="label">{title}</p>
      <p className="mt-2 text-xl">{type ?? "Unnamed"}</p>
      <p className="font-mono text-xs text-[var(--muted)]">{id}</p>
    </Link>
  );
}
