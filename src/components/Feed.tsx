"use client";

import { useEffect, useRef, useState } from "react";
import { Face } from "@/components/Face";

export type Row = {
  id: string; src: string; who: string; ctx?: string; repo?: string;
  when: string; wish: string; url: string; avatar?: string | null;
};

/* The platform first, then what it was under. Printing only the video title
   meant not one YouTube row on the site said it came from YouTube. */
const WHERE = (r: Row) =>
  r.src === "github" ? r.repo || "GitHub"
  : r.src === "youtube" ? (r.ctx ? `YouTube · ${r.ctx}` : "YouTube")
  : "Hacker News";

/* Cut on a word where one is near, and say that it was cut. The old code sliced
   at exactly 46 characters with no mark, inventing repo names. */
function trim(s: string, n: number) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + "…";
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/**
 * How long ago, in whole days, measured against a date the SERVER chose.
 *
 * Two things were wrong. It read the clock itself, so the server rendered one
 * string into cached HTML and the browser hydrated a different one — the value
 * visibly corrected itself on load and React logged a hydration error. And
 * asked_on is a DATE, with no time in it: computing hours from it invented a
 * time of day and reported everything as a day older than it was. Days are all
 * the data supports, so days are all this claims. Formatted from a fixed table
 * rather than toLocaleDateString, which varies with the host's locale and
 * timezone — the same divergence in a different costume.
 */
function ago(d: string, nowDay: string) {
  if (!d) return "";
  const days = Math.round((Date.parse(nowDay + "T00:00:00Z") - Date.parse(d.slice(0, 10) + "T00:00:00Z")) / 864e5);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const [y, m] = d.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}


/**
 * The stream, and the reason it is on the front page at all: the site proves
 * itself before asking for anything. No input, no account — you land on real
 * people wanting real things.
 */
export function Feed({ initial, now }: { initial: Row[]; now: string }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [today, setToday] = useState(now.slice(0, 10));
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  /* Anything discovered after THIS moment is new to you. Comparing against the
     rows' own timestamps would mark everything new on day one, because the
     backfill stamped 1,900 rows within the same second. */
  /* Seeded from the SERVER's clock, handed down as a prop: a browser whose
     clock runs fast would otherwise set a cursor in the future and never see
     another arrival. */
  const since = useRef(now);
  const seen = useRef(new Set(initial.map((r) => r.id)));

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      /* No visibilityState guard. The first draft skipped hidden tabs, which
         browsers already handle — a background tab's intervals are throttled to
         roughly once a minute on their own. So the guard bought nothing, made a
         reader who comes back to the tab wait up to another 45 seconds for the
         arrivals that were already waiting, and made the whole feature
         impossible to exercise: every browser available for testing here reports
         the document hidden, so the poll never ran once outside production. */
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
        /* Roll the day over from the server's clock, so a tab left open past
           midnight starts saying "yesterday" without a reload. */
        setToday(d.now.slice(0, 10));
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
              <p className="prose-tight leading-relaxed break-words text-body">{r.wish}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {isNew && (
                  <span className="rounded-full border border-good/50 px-2 py-0.5 text-[10px] tracking-[0.1em] text-good uppercase">
                    new
                  </span>
                )}
                <span className="font-mono text-muted">{r.who}</span>
                <span className="text-faint">· {trim(WHERE(r), 52)}</span>
                <span className="text-faint">· {ago(r.when, today)}</span>
              </p>
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noopener nofollow"
              aria-label={`Reply to ${r.who} on ${WHERE(r)}`}
              className="mt-0.5 shrink-0 px-1 py-2 text-xs text-accent hover:underline"
            >
              reply ↗
            </a>
          </li>
        );
      })}
    </ol>
  );
}
