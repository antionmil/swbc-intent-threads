"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Face } from "@/components/Face";
import { TOPICS } from "@/lib/topics";

export type Row = {
  id: string; src: string; who: string; ctx?: string; repo?: string;
  when: string; wish: string; url: string; avatar?: string | null;
};

const PLATFORM: Record<string, string> = {
  github: "GitHub", hn: "Hacker News", youtube: "YouTube",
};

/* What it was said UNDER — the repo, or the video. The platform itself is on the
   byline above, so repeating it here just printed "YouTube · YouTube · title".
   Empty for Hacker News, which has no such container worth naming. */
const UNDER = (r: Row) =>
  r.src === "github" ? r.repo || "" : r.src === "youtube" ? r.ctx || "" : "";

/** The full place, for a link's accessible name where there is no byline. */
const WHERE = (r: Row) => {
  const p = PLATFORM[r.src] ?? r.src;
  const u = UNDER(r);
  return u ? `${p} · ${u}` : p;
};

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "github", label: "GitHub" },
  { key: "hn", label: "Hacker News" },
  { key: "youtube", label: "YouTube" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type TopicFilter = "all" | (typeof TOPICS)[number]["key"];

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
  const days = Math.round(
    (Date.parse(nowDay + "T00:00:00Z") - Date.parse(d.slice(0, 10) + "T00:00:00Z")) / 864e5,
  );
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const [y, m] = d.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function Chips({ label, options, value, onChange, quiet = false }: {
  label: string;
  options: readonly { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
  quiet?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${quiet ? "mt-1.5" : "mt-3"}`} role="group" aria-label={label}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1.5 transition-colors ${
              quiet ? "text-[11px]" : "text-xs"
            } ${on ? "border-accent text-accent" : "border-rule text-muted hover:border-edge hover:text-body"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The stream, and the reason it is on the front page at all: the site proves
 * itself before asking for anything. No input, no account — you land on real
 * people wanting real things.
 */
export function Feed({ initial, now }: { initial: Row[]; now: string }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [today, setToday] = useState(now.slice(0, 10));
  const [filter, setFilter] = useState<FilterKey>("all");
  const [topic, setTopic] = useState<TopicFilter>("all");
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  /* Seeded from the SERVER's clock, handed down as a prop: a browser whose
     clock runs fast would otherwise set a cursor in the future and never see
     another arrival. */
  const since = useRef(now);
  const seen = useRef(new Set(initial.map((r) => r.id)));
  /* Read inside the interval so a filter change does not need a new timer. */
  const active = useRef<FilterKey>("all");
  const activeTopic = useRef<TopicFilter>("all");
  active.current = filter;
  activeTopic.current = topic;

  const query = useCallback(
    (f: FilterKey, t: TopicFilter, extra = "") =>
      `/api/feed?limit=14${f === "all" ? "" : `&src=${f}`}${t === "all" ? "" : `&topic=${t}`}${extra}`,
    [],
  );

  /* Switching filter replaces the list rather than merging into it: a row that
     is on screen under "Everyone" and not under "GitHub" has to leave. */
  useEffect(() => {
    if (filter === "all" && topic === "all" && rows === initial) return;
    let dead = false;
    setLoading(true);
    fetch(query(filter, topic))
      .then((r) => r.json() as Promise<{ rows: Row[]; now: string }>)
      .then((d) => {
        if (dead) return;
        setRows(d.rows ?? []);
        setFresh(new Set());
        seen.current = new Set((d.rows ?? []).map((r) => r.id));
        if (d.now) { since.current = d.now; setToday(d.now.slice(0, 10)); }
      })
      .catch(() => { /* keep what is on screen rather than blanking it */ })
      .finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, topic]);

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      /* No visibilityState guard. Browsers already throttle a background tab's
         intervals to roughly once a minute, so the guard duplicated the platform
         while making a reader who comes back wait up to another 45 seconds for
         arrivals that were already sitting there — and making the feature
         impossible to test, since every browser available here reports the
         document hidden. */
      try {
        const r = await fetch(
          query(active.current, activeTopic.current, `&since=${encodeURIComponent(since.current)}`),
        );
        const d = (await r.json()) as { rows: Row[]; now: string };
        if (dead || !d.rows?.length) { if (d?.now) since.current = d.now; return; }
        const added = d.rows.filter((x) => !seen.current.has(x.id));
        for (const x of added) seen.current.add(x.id);
        if (added.length) {
          setRows((prev) => [...added, ...prev].slice(0, 40));
          setFresh((prev) => new Set([...prev, ...added.map((x) => x.id)]));
        }
        /* Only jump the cursor to the server's clock when the page came back
           SHORT. A full page means there may be more behind it, and advancing to
           "now" would step over them permanently — they were found before the
           new cursor and would never match `first_seen > since` again. */
        if (d.rows.length < 14) since.current = d.now;
        /* Roll the day over from the server's clock, so a tab left open past
           midnight starts saying "yesterday" without a reload. */
        setToday(d.now.slice(0, 10));
      } catch { /* a quiet feed beats an error banner */ }
    };
    const id = setInterval(tick, 45_000);
    return () => { dead = true; clearInterval(id); };
  }, [query]);

  return (
    <>
      {/* Two layers: where they said it, and what they were asking for. Both
          refetch rather than hiding rows — fourteen rows filtered in the browser
          would usually leave nothing on screen. */}
      <Chips
        label="Filter by where it was said"
        options={FILTERS}
        value={filter}
        onChange={(v) => setFilter(v as FilterKey)}
      />
      <Chips
        label="Filter by what they wanted"
        options={[{ key: "all", label: "Anything" }, ...TOPICS]}
        value={topic}
        onChange={(v) => setTopic(v as TopicFilter)}
        quiet
      />

      {/* aria-live, because rows arrive and the list changes without anybody
          asking it to — silent mutation is invisible to a screen reader. */}
      <ol className="mt-1" aria-live="polite" aria-busy={loading}>
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
                {/* The person first, then what they said. A name and a face at the
                    head of the row is what makes it read as somebody talking
                    rather than as a database record. */}
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-medium text-ink">{r.who}</span>
                  {isNew && (
                    <span className="rounded-full border border-good/50 px-1.5 py-px text-[10px] tracking-[0.1em] text-good uppercase">
                      new
                    </span>
                  )}
                  <span className="text-xs text-faint">
                    {PLATFORM[r.src] ?? r.src} · {ago(r.when, today)}
                  </span>
                </p>

                <p className="prose-tight mt-1 leading-relaxed break-words text-body">{r.wish}</p>

                {UNDER(r) && (
                  <p className="mt-1 text-xs text-faint">{trim(UNDER(r), 60)}</p>
                )}
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

      {rows.length === 0 && !loading && (
        <p className="py-8 text-center text-sm text-muted">
          Nothing from there yet. The crons look again every night.
        </p>
      )}
    </>
  );
}
