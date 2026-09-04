import "server-only";
import { clipped, decode, ownWords } from "@/lib/readable";
import { unstable_cache } from "next/cache";
import { hasDb, sql } from "./db";
import type { Lead } from "./corpus";
import { LEADS as BUNDLED } from "./corpus";

/**
 * Reads go to Postgres, with the bundled artifact as the floor.
 *
 * The artifact stays in the repo on purpose: it is what the site serves if the
 * database is unreachable, cold, or not configured yet. An empty graveyard
 * rendered with a 200 was a day-2 finding, and here it would be worse — the
 * whole page is the leads.
 */
type Row = {
  id: string; src: string; who: string; repo: string; ctx: string;
  asked_on: string | null; wish: string; url: string; score: number;
  avatar: string | null; topic: string | null; rank: number;
};

import { terms as tokenise } from "./corpus";

/* Terms are recomputed here rather than stored. The artifact carries a `t`
   array because it is built offline; a database row does not need one, and
   deriving it on the way out keeps the two paths scoring identically. */
const toLead = (r: Row): Lead => ({
  id: r.id, src: r.src as Lead["src"], who: r.who, repo: r.repo ?? "",
  /* String(), not .slice(): the column is a `date`, and the neon driver hands
     back a JS Date for it. Calling .slice on that threw inside every mapper, so
     search() and recent() both caught their own crash and quietly served the
     bundled artifact instead of the database — for every visitor, invisibly.
     The query now casts with to_char; this is the belt to that pair of braces. */
  ctx: r.ctx ? decode(r.ctx) : undefined, when: String(r.asked_on ?? "").slice(0, 10),
  wish: clipped(r.wish), url: r.url, score: r.score, avatar: r.avatar ?? undefined,
  topic: r.topic ?? undefined,
  t: [...new Set(tokenise(`${r.wish} ${r.ctx ?? ""}`))].slice(0, 44),
});

/** Postgres full-text search, ranked the same way the artifact is: by how much
 *  of the product's vocabulary the person used, then by lead quality. */
/**
 * Postgres does recall, the artifact's scoring does precision.
 *
 * ts_rank knows how often a term appears in the LEAD but nothing about how
 * often it appears on the product's page — which is exactly the weighting that
 * fixed "ditch Google Analytics" outranking a request for page views. So the
 * database returns a wide candidate set and the same tf-idf scoring that ranks
 * the artifact ranks these, unchanged.
 */
async function search(terms: string[], limit: number): Promise<Lead[] | null> {
  if (!hasDb() || terms.length === 0) return null;
  /* "or", not "|". websearch_to_tsquery is the safe parser — it never throws on
     user input — but it speaks English, not tsquery: it reads spaces as AND and
     silently drops a "|". Sixteen terms joined with "|" therefore became a
     sixteen-way AND and matched nothing at all. */
  /* Was 16. The concept expansion hands over more terms than that — the whole
     scheduling family is eleven words on its own — and truncating at 16 threw
     away the very siblings the expansion exists to reach. */
  const q = terms.slice(0, 40).join(" or ");
  try {
    const rows = (await sql()`
      select l.id, l.src, l.who, l.repo, l.ctx, to_char(l.asked_on, 'YYYY-MM-DD') as asked_on, l.wish, l.url, l.score, l.avatar, l.topic,
             ts_rank(l.fts, websearch_to_tsquery('english', ${q})) as rank
        from leads l
        left join blocked b on lower(b.who) = lower(l.who)
       where b.who is null and lower(l.who) not in ('ghost', 'deleted', '[deleted]')
         and l.fts @@ websearch_to_tsquery('english', ${q})
       -- The expression is repeated rather than reusing the alias: Postgres
       -- will not resolve a select alias inside an ORDER BY expression, and
       -- rank is a window function besides.
       order by ts_rank(l.fts, websearch_to_tsquery('english', ${q}))
                * (0.55 + 0.45 * l.score) desc,
                l.asked_on desc nulls last
       limit ${Math.max(limit, 300)}
    `) as unknown as Row[];
    return rows.map(toLead);
  } catch (e) {
    console.error("[leads] search failed, falling back to the artifact", e);
    return null;
  }
}

export async function count(): Promise<number> {
  if (!hasDb()) return BUNDLED.length;
  try {
    const [r] = (await sql()`select count(*)::int as n from leads`) as unknown as { n: number }[];
    return r?.n ?? BUNDLED.length;
  } catch {
    return BUNDLED.length;
  }
}

export const total = unstable_cache(count, ["lead-count"], { revalidate: 300 });

/** How many asks landed in the last 7 days. */
async function fresh7(): Promise<number> {
  if (!hasDb()) return BUNDLED.filter((l) => l.when >= iso7()).length;
  try {
    const r = (await sql()`
      select count(*)::int as n from leads l
        left join blocked b on lower(b.who) = lower(l.who)
       where b.who is null and lower(l.who) not in ('ghost', 'deleted', '[deleted]')
         and l.asked_on >= current_date - 7
    `) as unknown as { n: number }[];
    return r[0]?.n ?? 0;
  } catch (e) {
    console.error("[leads] fresh7 failed", e);
    return BUNDLED.filter((l) => l.when >= iso7()).length;
  }
}
const iso7 = () => new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);

/* Counted in the database, like the total beside it. The front page used to read
   this off the bundled artifact while printing a live total in the same
   sentence: "1,931 public asks indexed · 14 of them from the last 7 days" when
   the real figure was 22. Two sources, one sentence, and the half that was
   frozen at build time would have decayed to 0 while the other kept climbing. */
export const freshCount = unstable_cache(fresh7, ["lead-fresh-7"], { revalidate: 300 });

/** What the crons found last, for the activity line. Null when they have not run. */
async function lastRun(): Promise<{ found: number; when: string | null }> {
  if (!hasDb()) return { found: 0, when: null };
  try {
    const r = (await sql()`
      select added, to_char(started_at, 'YYYY-MM-DD') as day from runs
       where added > 0 order by started_at desc limit 1
    `) as unknown as { added: number; day: string }[];
    if (!r[0]) return { found: 0, when: null };
    const days = Math.round(
      (Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(r[0].day)) / 864e5,
    );
    return {
      found: r[0].added,
      when: days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`,
    };
  } catch (e) {
    console.error("[leads] lastRun failed", e);
    return { found: 0, when: null };
  }
}

export const lastFind = unstable_cache(lastRun, ["last-run"], { revalidate: 300 });

/** How many distinct people, not how many rows. */
export function peopleIn(rows: { who: string }[]): number {
  return new Set(rows.map((r) => r.who.toLowerCase())).size;
}

/* One person can post the same thought twice, a character apart — a ">" that
   became a "→" made two rows out of one and put both at the top of the bank.
   Keyed on letters and digits only so that difference stops mattering. Cheap,
   and it runs where leads are produced rather than on each page. */
function dedupe(rows: Lead[]): Lead[] {
  const seen = new Set<string>();
  return rows.filter((l) => {
    const k = l.who + "|" + l.wish.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 90);
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

/** Newest first, for the bank. */
export async function recent(limit = 250): Promise<Lead[]> {
  if (!hasDb()) return BUNDLED.slice(0, limit);
  try {
    const rows = (await sql()`
      select l.id, l.src, l.who, l.repo, l.ctx, to_char(l.asked_on, 'YYYY-MM-DD') as asked_on, l.wish, l.url, l.score, l.avatar, l.topic, 0 as rank
        from leads l
        left join blocked b on lower(b.who) = lower(l.who)
       where b.who is null and lower(l.who) not in ('ghost', 'deleted', '[deleted]')
       order by l.asked_on desc nulls last, l.score desc
       limit ${limit}
    `) as unknown as Row[];
    const mapped = dedupe(rows.map(toLead)).filter((l) => ownWords(l.wish));
    return mapped.length ? mapped : BUNDLED.slice(0, limit);
  } catch (e) {
    console.error("[leads] recent failed, falling back", e);
    return BUNDLED.slice(0, limit);
  }
}

export { search };
