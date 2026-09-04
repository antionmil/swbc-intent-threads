"use client";

import { useEffect, useState } from "react";

/**
 * The room, at the top of the page.
 *
 * Every number here is counted, never estimated. Until the heartbeat comes
 * back nothing is claimed at all — an activity strip that renders "1 here" on
 * the server and then corrects itself is the stale-flash this project bans, and
 * the honest version of "we do not know yet" is to say nothing.
 *
 * "You are the only one here" is a real answer and it gets shown. A site with
 * one reader that says "12 online" is lying, and this one will have days with
 * one reader.
 */
export function Here({ found, when }: { found: number; when: string | null }) {
  const [here, setHere] = useState<number | null>(null);

  useEffect(() => {
    let dead = false;
    const beat = async () => {
      try {
        const r = await fetch("/api/here", { method: "POST" });
        const d = (await r.json()) as { here: number };
        if (!dead && typeof d.here === "number" && d.here > 0) setHere(d.here);
      } catch { /* silence beats a wrong number */ }
    };
    beat();
    const id = setInterval(beat, 20_000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  const parts: string[] = [];
  if (here !== null) {
    parts.push(here === 1 ? "just you here right now" : `${here} people here right now`);
  }
  if (found > 0) {
    parts.push(`${found} new ${found === 1 ? "ask" : "asks"} found ${when ?? "recently"}`);
  }
  if (parts.length === 0) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-good opacity-70 pulse" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
      </span>
      {parts.join(" · ")}
    </p>
  );
}
