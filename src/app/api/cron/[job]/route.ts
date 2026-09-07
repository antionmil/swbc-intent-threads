import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasDb, sql } from "@/lib/db";
import { discoverYouTube, mineGithub, mineStack, mineYouTube } from "@/lib/mine";
import { slice } from "@/lib/queries";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The corpus grows here, not on somebody's laptop.
 *
 * Everything mined so far came from a script run by hand, which meant the site
 * froze the moment nobody was running it — for a product whose whole value is
 * a growing bank of leads, that was the real flaw, worse than where the rows
 * were stored.
 */
function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  /* timingSafeEqual throws on a length mismatch, which is itself a leak of one
     bit — compare a fixed-width digest-shaped pair instead by padding to the
     longer of the two and folding the length into the result. */
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * A day of YouTube: find some new videos, then read comments.
 *
 * Twelve searches at 100 quota units, plus 120 comment pages at 1 unit, is
 * about 1,320 of the 10,000 a day. The rotation in queries.ts means the whole
 * 125-query list comes round roughly every ten days, so the corpus keeps
 * reaching subjects it has not seen instead of re-reading the same videos.
 */
async function youtubeDay() {
  const found = await discoverYouTube(slice(12));
  /* 400, not 120. A comment page is one quota unit against a daily 10,000, and
     at 120 a day the 2,385 videos discovery just found would take twenty days
     to read. The twelve searches cost 1,200 units; this costs 400. */
  const mined = await mineYouTube(400);
  return {
    found: found.found + mined.found,
    added: mined.added,
    note: `${found.added} new videos${found.note ? " — " + found.note : ""}`,
  };
}

/** What this deployment can actually reach. No secrets, only whether and how long. */
async function status() {
  const seen = (k: string) => {
    const v = process.env[k];
    return v === undefined ? "unset" : v.trim() === "" ? "empty" : `${v.trim().length} chars`;
  };
  const note = ["YOUTUBE_API_KEY", "GITHUB_TOKEN", "DATABASE_URL", "CRON_SECRET"]
    .map((k) => `${k}=${seen(k)}`).join(" ");
  let videos = 0;
  try {
    const r = (await sql()`select count(*)::int as n from videos`) as unknown as { n: number }[];
    videos = r[0]?.n ?? 0;
  } catch { /* the note already says whether the database is configured */ }
  return { found: videos, added: 0, note };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  /* The bearer token, and nothing else.
   *
   * This used to accept any request carrying an x-vercel-cron header, on the
   * belief that only Vercel could set it. Vercel does not strip it from inbound
   * requests: `curl -H "x-vercel-cron: 1"` — and even a valueless
   * `-H "x-vercel-cron;"` — passed the guard on the live site. That handed any
   * stranger the miners: the YouTube quota (10,000 units a day), the GitHub
   * rate limit, writes to the leads table, and a 300-second function held open
   * per call. Vercel's own documentation never offers that header as an auth
   * signal; it says CRON_SECRET "will be automatically sent as an Authorization
   * header when Vercel invokes your cron job", and the sample code compares
   * exactly that. So does this.
   *
   * timingSafeEqual, because the comparison is against a secret and a plain !==
   * returns as soon as two bytes differ. */
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !sameSecret(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "no" }, { status: 401 });
  }
  if (!hasDb()) return NextResponse.json({ error: "no database configured" }, { status: 503 });

  /* YouTube's Developer Policies, III.E.4.c: an API client "may temporarily
   * store limited amounts of Non-Authorized Data ... but not longer than 30
   * calendar days". Comment text and author photos are exactly that.
   *
   * So every cron run sweeps first, before it does anything else. Putting it
   * here rather than in the YouTube job means the sweep still happens on the
   * days the miner fails, and a retention rule that only runs when everything
   * else worked is not a retention rule. first_seen is when WE retrieved it,
   * which is the clock the policy is counting. */
  try {
    const gone = (await sql()`
      delete from leads
       where src = 'youtube' and first_seen < now() - interval '30 days'
       returning id
    `) as unknown as { id: string }[];
    if (gone.length) console.log(`[cron] retention: dropped ${gone.length} YouTube rows past 30 days`);
  } catch (e) {
    console.error("[cron] retention sweep failed", e);
  }

  const { job } = await params;
  const started = Date.now();
  try {
    const r =
      job === "github" ? await mineGithub()
      : job === "youtube" ? await youtubeDay()
      /* Reading only, no searching. A search costs 100 quota units and a
         comment page costs 1, so after a big discovery run the backlog is
         cleared with this rather than by paying for discovery again. */
      : job === "youtube-read" ? await mineYouTube(400)
      /* Costs nothing and answers the question the runs table kept raising.
         For four days every YouTube run recorded "no YOUTUBE_API_KEY" while the
         Vercel dashboard listed that very variable, and there was no way to
         tell from outside whether the value was empty, the wrong environment,
         or something else. Names and lengths only — never a value. */
      : job === "stack"
        ? await mineStack(
            Math.min(40, Number(req.nextUrl.searchParams.get("pages")) || 8),
            Math.max(1, Number(req.nextUrl.searchParams.get("from")) || 1),
          )
      : job === "status" ? await status()
      : null;
    if (!r) return NextResponse.json({ error: "unknown job" }, { status: 404 });

    await sql()`
      insert into runs (source, found, added, note)
      values (${job}, ${r.found}, ${r.added}, ${r.note ?? null})
    `;
    return NextResponse.json({ ...r, ms: Date.now() - started });
  } catch (e) {
    const note = e instanceof Error ? e.message.slice(0, 200) : "failed";
    /* Recorded, not swallowed. A cron that quietly stops looks exactly like a
       quiet day, and you find out weeks later. */
    try {
      await sql()`insert into runs (source, found, added, note) values (${job}, 0, 0, ${note})`;
    } catch {}
    console.error("[cron]", job, e);
    /* The message goes to the runs table and the logs, not down the wire. It
       can carry a connection string, a table name or a stack frame, and the
       caller does not need any of that to know the job failed. */
    return NextResponse.json({ error: "job failed" }, { status: 500 });
  }
}
