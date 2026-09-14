"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  ["ENTER", "/explore"],
  ["FIND", "/find"],
  ["TODAY", "/today"],
  ["PLAY", "/play"],
  ["CONNECT", "/connect"],
  ["BOARDS", "/leaderboards"],
  ["REGIONS", "/regions"],
  ["YOU", "/collection"],
  ["LIVE", "/activity"],
  ["DATA", "/data"],
];

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#f7f8f4]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center border border-[var(--accent)] text-[var(--accent)]">
              F
            </span>
            <span className="leading-none">
              <b className="block text-sm tracking-[0.28em]">FLY</b>
              <span className="label">the internet’s fly cns</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-5 lg:flex">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className={`label ${pathname === href ? "text-[var(--accent)]" : ""}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form
            className="ml-auto hidden min-w-[200px] flex-1 max-w-md border border-[var(--line)] md:flex"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="body id / type / region / archetype"
              className="w-full bg-transparent px-3 py-2 font-mono text-xs outline-none placeholder:text-[var(--muted)]"
            />
            <button className="label px-3 text-[var(--accent)]">SEARCH</button>
          </form>
          <button className="ml-auto label border border-[var(--line)] px-3 py-2 lg:hidden" onClick={() => setOpen((v) => !v)}>
            {open ? "CLOSE" : "MENU"}
          </button>
        </div>
        {open ? (
          <div className="border-t border-[var(--line)] px-5 py-4 lg:hidden">
            <nav className="grid grid-cols-2 gap-3">
              {links.map(([label, href]) => (
                <Link key={href} href={href} className="label" onClick={() => setOpen(false)}>
                  {label}
                </Link>
              ))}
            </nav>
            <form
              className="mt-4 border border-[var(--line)]"
              onSubmit={(e) => {
                e.preventDefault();
                if (q.trim()) {
                  router.push(`/search?q=${encodeURIComponent(q.trim())}`);
                  setOpen(false);
                }
              }}
            >
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="search"
                className="w-full bg-transparent px-3 py-2 font-mono text-xs outline-none"
              />
            </form>
          </div>
        ) : null}
      </header>
      {children}
    </div>
  );
}
