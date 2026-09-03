import "server-only";
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
  asked_on: string | null; wish: string; url: string; score: number; rank: number;
};

import { terms as tokenise } from "./corpus";

/* Terms are recomputed here rather than stored. The artifact carries a `t`
   array because it is built offline; a database row does not need one, and
   deriving it on the way out keeps the two paths scoring identically. */
const toLead = (r: Row): Lead => ({
  id: r.id, src: r.src as Lead["src"], who: r.who, repo: r.repo ?? "",
  ctx: r.ctx || undefined, when: (r.asked_on ?? "").slice(0, 10),
  wish: r.wish, url: r.url, score: r.score,
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
  const q = terms.slice(0, 16).join(" or ");
  try {
    const rows = (await sql()`
      select l.id, l.src, l.who, l.repo, l.ctx, l.asked_on, l.wish, l.url, l.score,
             ts_rank(l.fts, websearch_to_tsquery('english', ${q})) as rank
        from leads l
        left join blocked b on lower(b.who) = lower(l.who)
       where b.who is null
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

/** Newest first, for the bank. */
export async function recent(limit = 250): Promise<Lead[]> {
  if (!hasDb()) return BUNDLED.slice(0, limit);
  try {
    const rows = (await sql()`
      select l.id, l.src, l.who, l.repo, l.ctx, l.asked_on, l.wish, l.url, l.score, 0 as rank
        from leads l
        left join blocked b on lower(b.who) = lower(l.who)
       where b.who is null
       order by l.asked_on desc nulls last, l.score desc
       limit ${limit}
    `) as unknown as Row[];
    return rows.length ? rows.map(toLead) : BUNDLED.slice(0, limit);
  } catch (e) {
    console.error("[leads] recent failed, falling back", e);
    return BUNDLED.slice(0, limit);
  }
}

export { search };
