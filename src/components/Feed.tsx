"use client";

import { useEffect, useRef, useState } from "react";
import { Face } from "@/components/Face";

export type Row = {
  id: string; src: string; who: string; ctx?: string; repo?: string;
  when: string; wish: string; url: string; avatar?: string | null;
};

const WHERE = (r: Row) =>
  r.src === "github" ? r.repo || "GitHub" : r.src === "youtube" ? r.ctx || "YouTube" : "Hacker News";

function ago(d: string | null) {
  if (!d) return "";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const days = Math.round(s / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/**
 * The stream, and the reason it is on the front page at all: the site proves
 * itself before asking for anything. No input, no account — you land on real
 * people wanting real things.
 */
export function Feed({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  /* Anything discovered after THIS moment is new to you. Comparing against the
     rows' own timestamps would mark everything new on day one, because the
     backfill stamped 1,900 rows within the same second. */
  const since = useRef(new Date().toISOString());
  const seen = useRef(new Set(initial.map((r) => r.id)));

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/feed?since=${encodeURIComponent(since.current)}&limit=10`);
        const d = (await r.json()) as { rows: Row[]; now: string };
        if (dead || !d.rows?.length) { if (d?.now) since.current = d.now; return; }
        const added = d.rows.filter((x) => !seen.current.has(x.id));
        for (const x of added) seen.current.add(x.id);
        if (added.length) {
          setRows((prev) => [...added, ...prev].slice(0, 40));
          setFresh((prev) => new Set([...prev, ...added.map((x) => x.id)]));
        }
        since.current = d.now;
      } catch { /* a quiet feed beats an error banner */ }
    };
    const id = setInterval(tick, 45_000);
    return () => { dead = true; clearInterval(id); };
  }, []);

  return (
    <ol className="mt-1">
      {rows.map((r) => {
        const isNew = fresh.has(r.id);
        return (
          <li
            key={r.id}
            className={`flex items-start gap-3 border-b border-rule py-3.5 ${isNew ? "land" : ""}`}
          >
            <span className="mt-0.5">
              <Face who={r.who} src={r.src} avatar={r.avatar ?? undefined} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="prose-tight leading-relaxed text-body">{r.wish}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {isNew && (
                  <span className="rounded-full border border-good/50 px-2 py-0.5 text-[10px] tracking-[0.1em] text-good uppercase">
                    new
                  </span>
                )}
                <span className="font-mono text-muted">{r.who}</span>
                <span className="text-faint">· {WHERE(r).slice(0, 46)}</span>
                <span className="text-faint">· {ago(r.when)}</span>
              </p>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noopener nofollow"
              className="mt-0.5 shrink-0 text-xs text-accent hover:underline"
            >
              reply ↗
            </a>
          </li>
        );
      })}
    </ol>
  );
}
