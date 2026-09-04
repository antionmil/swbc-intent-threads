"use client";

import { useEffect, useState } from "react";

type Counts = { here: number; week: number; ever: number };

/* 1,240 -> "1.2k". Under a thousand keeps its exact figure, because rounding a
   real small number is the first step towards inflating it. */
const short = (n: number) =>
  n < 1000 ? String(n) : n < 10_000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;

/* A weekly or all-time figure only appears once it means something. The house
   rule allows holding a small real number back; it does not allow inflating one,
   so nothing here is ever rounded up to look busier. "Online now" is always
   shown, including when it is 1 — that is a true and useful thing to say. */
const WEEK_FLOOR = 25;
const EVER_FLOOR = 50;

/**
 * The room, at the top of the page.
 *
 * Nothing is claimed until the first heartbeat returns. A bar that renders on
 * the server and then corrects itself is the stale flash this project bans, and
 * the honest form of "not known yet" is to show nothing.
 */
export function Here({ found, when }: { found: number; when: string | null }) {
  const [c, setC] = useState<Counts | null>(null);

  useEffect(() => {
    let dead = false;
    const beat = async () => {
      try {
        const r = await fetch("/api/here", { method: "POST" });
        const d = (await r.json()) as Counts;
        if (!dead && typeof d.here === "number" && d.here > 0) setC(d);
      } catch { /* silence beats a wrong number */ }
    };
    beat();
    const id = setInterval(beat, 20_000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  const stats: { n: string; label: string }[] = [];
  if (c) {
    if (c.week >= WEEK_FLOOR) stats.push({ n: short(c.week), label: "visitors this week" });
    if (c.ever >= EVER_FLOOR) stats.push({ n: short(c.ever), label: "visitors all-time" });
  }
  if (found > 0) {
    stats.push({ n: String(found), label: `new ${found === 1 ? "ask" : "asks"} ${when ?? "recently"}` });
  }
  if (!c && stats.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-full border border-rule px-4 py-2 text-xs">
      {c && (
        <span className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-good opacity-70 pulse" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
          </span>
          <span className="font-medium text-ink">{c.here}</span>
          <span className="text-muted">{c.here === 1 ? "here now" : "online now"}</span>
        </span>
      )}
      {stats.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span className="font-medium text-ink">{s.n}</span>
          <span className="text-muted">{s.label}</span>
        </span>
      ))}
    </div>
  );
}
