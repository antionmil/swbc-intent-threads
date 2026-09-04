import { NextResponse, type NextRequest } from "next/server";
import { hasDb, sql } from "@/lib/db";
import { clipped, decode, humanAsk, ownWords } from "@/lib/readable";
import { TOPICS } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Wire = {
  id: string; src: string; who: string; repo: string; ctx: string;
  when: string; wish: string; url: string; avatar: string | null;
};

/**
 * The stream on the front page.
 *
 * `since` is a DISCOVERY timestamp, not an asked-on date: what is new to you is
 * what the crons have found since your page loaded, which is the only sense in
 * which anything can arrive while you are reading. The feed itself is ordered by
 * asked_on, because that is the true chronology of somebody wanting a thing.
 */
/* Closed sets, checked here rather than interpolated: both reach a query. */
const SOURCES = new Set(["github", "hn", "youtube"]);
const TOPIC_KEYS = new Set(TOPICS.map((t) => t.key as string));

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since");
  const asked = req.nextUrl.searchParams.get("src");
  const src = asked && SOURCES.has(asked) ? asked : null;
  const wanted = req.nextUrl.searchParams.get("topic");
  const topic = wanted && TOPIC_KEYS.has(wanted) ? wanted : null;
  const limit = Math.min(30, Number(req.nextUrl.searchParams.get("limit")) || 12);
  const now = new Date().toISOString();
  const dead = { headers: { "cache-control": "no-store" } };

  if (!hasDb()) return NextResponse.json({ rows: [], now }, dead);

  try {
    /* `${src}` is a bound parameter like every other value here — the tagged
       template makes it one — and `src is null or` lets one query serve both the
       filtered and unfiltered case without concatenating SQL. */
    const rows = (since
      ? await sql()`
          select l.id, l.src, l.who, l.repo, l.ctx, to_char(l.asked_on, 'YYYY-MM-DD') as asked_on, l.wish, l.url, l.avatar
            from leads l left join blocked b on lower(b.who) = lower(l.who)
           where b.who is null and lower(l.who) not in ('ghost', 'deleted', '[deleted]')
             and (${src}::text is null or l.src = ${src})
             and (${topic}::text is null or l.topic = ${topic})
             and l.first_seen > ${since}
           order by l.first_seen desc limit ${limit}`
      : await sql()`
          select l.id, l.src, l.who, l.repo, l.ctx, to_char(l.asked_on, 'YYYY-MM-DD') as asked_on, l.wish, l.url, l.avatar
            from leads l left join blocked b on lower(b.who) = lower(l.who)
           where b.who is null and lower(l.who) not in ('ghost', 'deleted', '[deleted]')
             and (${src}::text is null or l.src = ${src})
             and (${topic}::text is null or l.topic = ${topic})
           order by l.asked_on desc nulls last, l.score desc limit ${limit}`
    ) as unknown as Record<string, string | null>[];

    const wire: Wire[] = rows.map((r) => ({
      id: String(r.id), src: String(r.src), who: String(r.who),
      repo: r.repo ?? "", ctx: r.ctx ? decode(r.ctx) : "", when: String(r.asked_on ?? ""),
      wish: clipped(String(r.wish)), url: String(r.url), avatar: r.avatar,
    }));
    return NextResponse.json({ rows: wire.filter((r) => ownWords(r.wish) && humanAsk(r.wish)), now }, dead);
  } catch (e) {
    /* A quiet feed beats an error banner: the page already has rows on it. */
    console.error("[feed]", e);
    return NextResponse.json({ rows: [], now }, dead);
  }
}
